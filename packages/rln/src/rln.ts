import { createDecoder, createEncoder } from "@waku/core";
import type {
  ContentTopic,
  IDecodedMessage,
  EncoderOptions as WakuEncoderOptions
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import init from "@waku/zerokit-rln-wasm";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";
import { ethers } from "ethers";

import {
  createRLNDecoder,
  createRLNEncoder,
  type RLNDecoder,
  type RLNEncoder
} from "./codec.js";
import { DEFAULT_RATE_LIMIT } from "./contract/constants.js";
import { LINEA_CONTRACT, RLNContract } from "./contract/index.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import verificationKey from "./resources/verification_key";
import * as wc from "./resources/witness_calculator";
import { WitnessCalculator } from "./resources/witness_calculator";
import { extractMetaMaskSigner } from "./utils/index.js";
import { Zerokit } from "./zerokit.js";

const log = new Logger("waku:rln");

async function loadWitnessCalculator(): Promise<WitnessCalculator> {
  try {
    const url = new URL("./resources/rln.wasm", import.meta.url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch witness calculator: ${response.status} ${response.statusText}`
      );
    }

    return await wc.builder(
      new Uint8Array(await response.arrayBuffer()),
      false
    );
  } catch (error) {
    log.error("Error loading witness calculator:", error);
    throw new Error(
      `Failed to load witness calculator: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function loadZkey(): Promise<Uint8Array> {
  try {
    const url = new URL("./resources/rln_final.zkey", import.meta.url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch zkey: ${response.status} ${response.statusText}`
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    log.error("Error loading zkey:", error);
    throw new Error(
      `Failed to load zkey: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create an instance of RLN
 * @returns RLNInstance
 */
export async function create(): Promise<RLNInstance> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (init as any)?.();
    zerokitRLN.init_panic_hook();

    const witnessCalculator = await loadWitnessCalculator();
    const zkey = await loadZkey();

    const stringEncoder = new TextEncoder();
    const vkey = stringEncoder.encode(JSON.stringify(verificationKey));

    const DEPTH = 20;
    const zkRLN = zerokitRLN.newRLN(DEPTH, zkey, vkey);
    const zerokit = new Zerokit(zkRLN, witnessCalculator, DEFAULT_RATE_LIMIT);

    return new RLNInstance(zerokit);
  } catch (error) {
    log.error("Failed to initialize RLN:", error);
    throw error;
  }
}

type StartRLNOptions = {
  /**
   * If not set - will extract MetaMask account and get signer from it.
   */
  signer?: ethers.Signer;
  /**
   * If not set - will use default LINEA_CONTRACT address.
   */
  address?: string;
  /**
   * Credentials to use for generating proofs and connecting to the contract and network.
   * If provided used for validating the network chainId and connecting to registry contract.
   */
  credentials?: EncryptedCredentials | DecryptedCredentials;
  /**
   * Rate limit for the member.
   */
  rateLimit?: number;
};

type RegisterMembershipOptions =
  | { signature: string }
  | { identity: IdentityCredential };

type WakuRLNEncoderOptions = WakuEncoderOptions & {
  credentials: EncryptedCredentials | DecryptedCredentials;
};

export class RLNInstance {
  private started = false;
  private starting = false;

  private _contract: undefined | RLNContract;
  private _signer: undefined | ethers.Signer;

  private keystore = Keystore.create();
  private _credentials: undefined | DecryptedCredentials;

  public constructor(public zerokit: Zerokit) {}

  public get contract(): undefined | RLNContract {
    return this._contract;
  }

  public get signer(): undefined | ethers.Signer {
    return this._signer;
  }

  public async start(options: StartRLNOptions = {}): Promise<void> {
    if (this.started || this.starting) {
      return;
    }

    this.starting = true;

    try {
      const { credentials, keystore } =
        await RLNInstance.decryptCredentialsIfNeeded(options.credentials);
      const { signer, address, rateLimit } = await this.determineStartOptions(
        options,
        credentials
      );

      if (keystore) {
        this.keystore = keystore;
      }

      this._credentials = credentials;
      this._signer = signer!;
      this._contract = await RLNContract.init(this, {
        address: address!,
        signer: signer!,
        rateLimit: rateLimit ?? this.zerokit.getRateLimit
      });
      this.started = true;
    } finally {
      this.starting = false;
    }
  }

  private async determineStartOptions(
    options: StartRLNOptions,
    credentials: KeystoreEntity | undefined
  ): Promise<StartRLNOptions> {
    let chainId = credentials?.membership.chainId;
    const address =
      credentials?.membership.address ||
      options.address ||
      LINEA_CONTRACT.address;

    if (address === LINEA_CONTRACT.address) {
      chainId = LINEA_CONTRACT.chainId;
    }

    const signer = options.signer || (await extractMetaMaskSigner());
    const currentChainId = await signer.getChainId();

    if (chainId && chainId !== currentChainId) {
      throw Error(
        `Failed to start RLN contract, chain ID of contract is different from current one: contract-${chainId}, current network-${currentChainId}`
      );
    }

    return {
      signer,
      address
    };
  }

  private static async decryptCredentialsIfNeeded(
    credentials?: EncryptedCredentials | DecryptedCredentials
  ): Promise<{ credentials?: DecryptedCredentials; keystore?: Keystore }> {
    if (!credentials) {
      return {};
    }

    if ("identity" in credentials) {
      return { credentials };
    }

    const keystore = Keystore.fromString(credentials.keystore);

    if (!keystore) {
      return {};
    }

    const decryptedCredentials = await keystore.readCredential(
      credentials.id,
      credentials.password
    );

    return {
      keystore,
      credentials: decryptedCredentials
    };
  }

  public async registerMembership(
    options: RegisterMembershipOptions
  ): Promise<undefined | DecryptedCredentials> {
    if (!this.contract) {
      throw Error("RLN Contract is not initialized.");
    }

    let identity = "identity" in options && options.identity;

    if ("signature" in options) {
      identity = this.zerokit.generateSeededIdentityCredential(
        options.signature
      );
    }

    if (!identity) {
      throw Error("Missing signature or identity to register membership.");
    }

    return this.contract.registerWithIdentity(identity);
  }

  /**
   * Changes credentials in use by relying on provided Keystore earlier in rln.start
   * @param id: string, hash of credentials to select from Keystore
   * @param password: string or bytes to use to decrypt credentials from Keystore
   */
  public async useCredentials(id: string, password: Password): Promise<void> {
    this._credentials = await this.keystore?.readCredential(id, password);
  }

  public async createEncoder(
    options: WakuRLNEncoderOptions
  ): Promise<RLNEncoder> {
    const { credentials: decryptedCredentials } =
      await RLNInstance.decryptCredentialsIfNeeded(options.credentials);
    const credentials = decryptedCredentials || this._credentials;

    if (!credentials) {
      throw Error(
        "Failed to create Encoder: missing RLN credentials. Use createRLNEncoder directly."
      );
    }

    await this.verifyCredentialsAgainstContract(credentials);

    return createRLNEncoder({
      encoder: createEncoder(options),
      rlnInstance: this,
      index: credentials.membership.treeIndex,
      credential: credentials.identity
    });
  }

  private async verifyCredentialsAgainstContract(
    credentials: KeystoreEntity
  ): Promise<void> {
    if (!this._contract) {
      throw Error(
        "Failed to verify chain coordinates: no contract initialized."
      );
    }

    const registryAddress = credentials.membership.address;
    const currentRegistryAddress = this._contract.address;
    if (registryAddress !== currentRegistryAddress) {
      throw Error(
        `Failed to verify chain coordinates: credentials contract address=${registryAddress} is not equal to registryContract address=${currentRegistryAddress}`
      );
    }

    const chainId = credentials.membership.chainId;
    const network = await this._contract.provider.getNetwork();
    const currentChainId = network.chainId;
    if (chainId !== currentChainId) {
      throw Error(
        `Failed to verify chain coordinates: credentials chainID=${chainId} is not equal to registryContract chainID=${currentChainId}`
      );
    }
  }

  public createDecoder(
    contentTopic: ContentTopic
  ): RLNDecoder<IDecodedMessage> {
    return createRLNDecoder({
      rlnInstance: this,
      decoder: createDecoder(contentTopic)
    });
  }
}
