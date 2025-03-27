import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { Logger } from "@waku/utils";
import { ethers } from "ethers";

import { LINEA_CONTRACT } from "./contract/constants.js";
import { RLNLightContract } from "./contract/rln_light_contract.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import {
  buildBigIntFromUint8Array,
  extractMetaMaskSigner
} from "./utils/index.js";

const log = new Logger("waku:rln");

/**
 * Create an instance of RLN
 * @returns RLNInstance
 */
export async function create(): Promise<RLNLightInstance> {
  try {
    return new RLNLightInstance();
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
   * If not set - will use default SEPOLIA_CONTRACT address.
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

export class RLNLightInstance {
  private started = false;
  private starting = false;

  private _contract: undefined | RLNLightContract;
  private _signer: undefined | ethers.Signer;

  private keystore = Keystore.create();
  private _credentials: undefined | DecryptedCredentials;

  public constructor() {}

  public get contract(): undefined | RLNLightContract {
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
        await RLNLightInstance.decryptCredentialsIfNeeded(options.credentials);
      const { signer, address, rateLimit } = await this.determineStartOptions(
        options,
        credentials
      );

      if (keystore) {
        this.keystore = keystore;
      }

      this._credentials = credentials;
      this._signer = signer!;
      this._contract = await RLNLightContract.init({
        address: address!,
        signer: signer!,
        rateLimit: rateLimit
      });
      this.started = true;
    } finally {
      this.starting = false;
    }
  }

  public get credentials(): DecryptedCredentials | undefined {
    return this._credentials;
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

  /**
   * Generates an identity credential from a seed string
   * This is a pure implementation that doesn't rely on Zerokit
   * @param seed A string seed to generate the identity from
   * @returns IdentityCredential
   */
  private generateSeededIdentityCredential(seed: string): IdentityCredential {
    // Convert the seed to bytes
    const encoder = new TextEncoder();
    const seedBytes = encoder.encode(seed);

    // Generate deterministic values using HMAC-SHA256
    // We use different context strings for each component to ensure they're different
    const idTrapdoor = hmac(sha256, seedBytes, encoder.encode("IDTrapdoor"));
    const idNullifier = hmac(sha256, seedBytes, encoder.encode("IDNullifier"));

    // Generate IDSecretHash as a hash of IDTrapdoor and IDNullifier
    const combinedBytes = new Uint8Array([...idTrapdoor, ...idNullifier]);
    const idSecretHash = sha256(combinedBytes);

    // Generate IDCommitment as a hash of IDSecretHash
    const idCommitment = sha256(idSecretHash);

    // Convert IDCommitment to BigInt
    const idCommitmentBigInt = buildBigIntFromUint8Array(idCommitment);

    return new IdentityCredential(
      idTrapdoor,
      idNullifier,
      idSecretHash,
      idCommitment,
      idCommitmentBigInt
    );
  }

  public async registerMembership(
    options: RegisterMembershipOptions
  ): Promise<undefined | DecryptedCredentials> {
    if (!this.contract) {
      throw Error("RLN Contract is not initialized.");
    }

    let identity = "identity" in options && options.identity;

    if ("signature" in options) {
      identity = this.generateSeededIdentityCredential(options.signature);
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
}
