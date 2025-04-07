import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { Logger } from "@waku/utils";
import { ethers } from "ethers";

import { LINEA_CONTRACT } from "./contract/constants.js";
import { RLNBaseContract } from "./contract/rln_base_contract.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import { RegisterMembershipOptions, StartRLNOptions } from "./types.js";
import {
  buildBigIntFromUint8Array,
  extractMetaMaskSigner
} from "./utils/index.js";
import { Zerokit } from "./zerokit.js";

const log = new Logger("waku:credentials");

/**
 * Manages credentials for RLN
 * This is a lightweight implementation of the RLN contract that doesn't require Zerokit
 * It is used to register membership and generate identity credentials
 */
export class RLNCredentialsManager {
  protected started = false;
  protected starting = false;

  private _contract: undefined | RLNBaseContract;
  private _signer: undefined | ethers.Signer;

  protected keystore = Keystore.create();
  private _credentials: undefined | DecryptedCredentials;

  public zerokit: undefined | Zerokit;

  public constructor(zerokit?: Zerokit) {
    log.info("RLNCredentialsManager initialized");
    this.zerokit = zerokit;
  }

  public get contract(): undefined | RLNBaseContract {
    return this._contract;
  }

  public set contract(contract: RLNBaseContract | undefined) {
    this._contract = contract;
  }

  public get signer(): undefined | ethers.Signer {
    return this._signer;
  }

  public set signer(signer: ethers.Signer | undefined) {
    this._signer = signer;
  }

  public get credentials(): undefined | DecryptedCredentials {
    return this._credentials;
  }

  public set credentials(credentials: DecryptedCredentials | undefined) {
    this._credentials = credentials;
  }

  public get provider(): undefined | ethers.providers.Provider {
    return this.contract?.provider;
  }

  public async start(options: StartRLNOptions = {}): Promise<void> {
    if (this.started || this.starting) {
      log.info("RLNCredentialsManager already started or starting");
      return;
    }

    log.info("Starting RLNCredentialsManager");
    this.starting = true;

    try {
      const { credentials, keystore } =
        await RLNCredentialsManager.decryptCredentialsIfNeeded(
          options.credentials
        );

      if (credentials) {
        log.info("Credentials successfully decrypted");
      }

      const { signer, address, rateLimit } = await this.determineStartOptions(
        options,
        credentials
      );

      log.info(`Using contract address: ${address}`);

      if (keystore) {
        this.keystore = keystore;
        log.info("Using provided keystore");
      }

      this._credentials = credentials;
      this._signer = signer!;
      this._contract = new RLNBaseContract({
        address: address!,
        signer: signer!,
        rateLimit: rateLimit ?? this.zerokit?.rateLimit
      });

      log.info("RLNCredentialsManager successfully started");
      this.started = true;
    } catch (error) {
      log.error("Failed to start RLNCredentialsManager", error);
      throw error;
    } finally {
      this.starting = false;
    }
  }

  public async registerMembership(
    options: RegisterMembershipOptions
  ): Promise<undefined | DecryptedCredentials> {
    if (!this.contract) {
      log.error("RLN Contract is not initialized");
      throw Error("RLN Contract is not initialized.");
    }

    log.info("Registering membership");
    let identity = "identity" in options && options.identity;

    if ("signature" in options) {
      log.info("Generating identity from signature");
      if (this.zerokit) {
        log.info("Using Zerokit to generate identity");
        identity = this.zerokit.generateSeededIdentityCredential(
          options.signature
        );
      } else {
        log.info("Using local implementation to generate identity");
        identity = this.generateSeededIdentityCredential(options.signature);
      }
    }

    if (!identity) {
      log.error("Missing signature or identity to register membership");
      throw Error("Missing signature or identity to register membership.");
    }

    log.info("Registering identity with contract");
    return this.contract.registerWithIdentity(identity);
  }

  /**
   * Changes credentials in use by relying on provided Keystore earlier in rln.start
   * @param id: string, hash of credentials to select from Keystore
   * @param password: string or bytes to use to decrypt credentials from Keystore
   */
  public async useCredentials(id: string, password: Password): Promise<void> {
    log.info(`Attempting to use credentials with ID: ${id}`);
    this._credentials = await this.keystore?.readCredential(id, password);
    if (this._credentials) {
      log.info("Successfully loaded credentials");
    } else {
      log.warn("Failed to load credentials");
    }
  }

  protected async determineStartOptions(
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
      log.info(`Using Linea contract with chainId: ${chainId}`);
    }

    const signer = options.signer || (await extractMetaMaskSigner());
    const currentChainId = await signer.getChainId();
    log.info(`Current chain ID: ${currentChainId}`);

    if (chainId && chainId !== currentChainId) {
      log.error(
        `Chain ID mismatch: contract=${chainId}, current=${currentChainId}`
      );
      throw Error(
        `Failed to start RLN contract, chain ID of contract is different from current one: contract-${chainId}, current network-${currentChainId}`
      );
    }

    return {
      signer,
      address
    };
  }

  protected static async decryptCredentialsIfNeeded(
    credentials?: EncryptedCredentials | DecryptedCredentials
  ): Promise<{ credentials?: DecryptedCredentials; keystore?: Keystore }> {
    if (!credentials) {
      log.info("No credentials provided");
      return {};
    }

    if ("identity" in credentials) {
      log.info("Using already decrypted credentials");
      return { credentials };
    }

    log.info("Attempting to decrypt credentials");
    const keystore = Keystore.fromString(credentials.keystore);

    if (!keystore) {
      log.warn("Failed to create keystore from string");
      return {};
    }

    try {
      const decryptedCredentials = await keystore.readCredential(
        credentials.id,
        credentials.password
      );
      log.info(`Successfully decrypted credentials with ID: ${credentials.id}`);

      return {
        keystore,
        credentials: decryptedCredentials
      };
    } catch (error) {
      log.error("Failed to decrypt credentials", error);
      throw error;
    }
  }

  protected async verifyCredentialsAgainstContract(
    credentials: KeystoreEntity
  ): Promise<void> {
    if (!this.contract) {
      throw Error(
        "Failed to verify chain coordinates: no contract initialized."
      );
    }

    const registryAddress = credentials.membership.address;
    const currentRegistryAddress = this.contract.address;
    if (registryAddress !== currentRegistryAddress) {
      throw Error(
        `Failed to verify chain coordinates: credentials contract address=${registryAddress} is not equal to registryContract address=${currentRegistryAddress}`
      );
    }

    const chainId = credentials.membership.chainId;
    const network = await this.contract.provider.getNetwork();
    const currentChainId = network.chainId;
    if (chainId !== currentChainId) {
      throw Error(
        `Failed to verify chain coordinates: credentials chainID=${chainId} is not equal to registryContract chainID=${currentChainId}`
      );
    }
  }

  /**
   * Generates an identity credential from a seed string
   * This is a pure implementation that doesn't rely on Zerokit
   * @param seed A string seed to generate the identity from
   * @returns IdentityCredential
   */
  private generateSeededIdentityCredential(seed: string): IdentityCredential {
    log.info("Generating seeded identity credential");
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

    log.info("Successfully generated identity credential");
    return new IdentityCredential(
      idTrapdoor,
      idNullifier,
      idSecretHash,
      idCommitment,
      idCommitmentBigInt
    );
  }
}
