import { chacha20orig } from "@noble/ciphers/chacha";
import { keccak_256 as keccak256 } from "@noble/hashes/sha3";
import { Logger } from "@waku/utils";
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

import { RLN_CONTRACT, RLN_Q } from "./contract/constants.js";
import { RLNBaseContract } from "./contract/rln_base_contract.js";
import { IdentityCredential } from "./identity.js";
import { Keystore } from "./keystore/index.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/index.js";
import { KeystoreEntity, Password } from "./keystore/types.js";
import { RegisterMembershipOptions, StartRLNOptions } from "./types.js";
import { BytesUtils } from "./utils/bytes.js";
import { extractMetaMaskSigner } from "./utils/index.js";
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

  public contract: undefined | RLNBaseContract;
  public signer: undefined | ethers.Signer;

  protected keystore = Keystore.create();
  public credentials: undefined | DecryptedCredentials;

  public zerokit: undefined | Zerokit;

  public constructor(zerokit?: Zerokit) {
    log.info("RLNCredentialsManager initialized");
    this.zerokit = zerokit;
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

      this.credentials = credentials;
      this.signer = signer!;
      this.contract = await RLNBaseContract.create({
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
        identity = await this.generateSeededIdentityCredential(
          options.signature
        );
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
    this.credentials = await this.keystore?.readCredential(id, password);
    if (this.credentials) {
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
      RLN_CONTRACT.address;

    if (address === RLN_CONTRACT.address) {
      chainId = RLN_CONTRACT.chainId.toString();
      log.info(`Using Linea contract with chainId: ${chainId}`);
    }

    const signer = options.signer || (await extractMetaMaskSigner());
    const currentChainId = await signer.getChainId();
    log.info(`Current chain ID: ${currentChainId}`);

    if (chainId && chainId !== currentChainId.toString()) {
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
    if (chainId !== currentChainId.toString()) {
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
  private async generateSeededIdentityCredential(
    seed: string
  ): Promise<IdentityCredential> {
    log.info("Generating seeded identity credential (uniform field)");

    const seedHash = keccak256(new TextEncoder().encode(seed));

    const key = seedHash;
    // ChaCha20Rng in Rust (rand_chacha) uses the original ChaCha20 variant
    // with a 64-bit nonce (stream identifier) and 64-bit counter. To reproduce
    // the **exact same** byte stream here we:
    //   1. Feed ChaCha20 with the 32-byte key `seedHash`.
    //   2. Use an 8-byte all-zero nonce (equivalent to stream id = 0).
    //   3. Start from counter 0 and read the first 64 bytes of keystream.
    // Note: noble's `chacha20` implementation switches to the 64-bit-nonce
    // layout automatically when an 8-byte nonce is supplied.

    // The Rust `ark_ff::UniformRand` implementation interprets the random
    // bytes as **little-endian** integers before the rejection-sampling step.
    // Convert the 32-byte chunks to bigint using LE order to stay in sync.
    const bytesToBigIntLE = (bytes: Uint8Array): bigint => {
      let res = 0n;
      for (let i = bytes.length - 1; i >= 0; i--) {
        res = (res << 8n) + BigInt(bytes[i]);
      }
      return res;
    };

    // Create a ChaCha20 stream that we can read bytes from incrementally
    // to simulate arkworks Fr::rand() rejection sampling
    const nonce = new Uint8Array(8); // 64-bit nonce = 0
    let streamOffset = 0;
    const getRandomBytes = (numBytes: number): Uint8Array => {
      const stream = chacha20orig(
        key,
        nonce,
        new Uint8Array(streamOffset + numBytes)
      );
      const result = stream.slice(streamOffset, streamOffset + numBytes);
      streamOffset += numBytes;
      return result;
    };

    // Simulate Fr::rand() for trapdoor with rejection sampling
    const simulateFrRand = (): bigint => {
      while (true) {
        const randomBytes = getRandomBytes(32);
        const randomLE = bytesToBigIntLE(randomBytes);
        if (randomLE < RLN_Q) {
          return randomLE;
        }
        // Rejection: try again with next 32 bytes
      }
    };

    const trapdoorField = simulateFrRand();
    const nullifierField = simulateFrRand();

    const secretHashField = await this.poseidonHash([
      trapdoorField,
      nullifierField
    ]);
    const commitmentField = await this.poseidonHash([secretHashField]);

    // Convert bigints to bytes using little-endian order to match how we read them
    const bigIntToUint8Array32LE = (value: bigint): Uint8Array => {
      const bytes = new Uint8Array(32);
      let temp = value;
      for (let i = 0; i < 32; i++) {
        bytes[i] = Number(temp & 0xffn);
        temp >>= 8n;
      }
      return bytes;
    };

    return new IdentityCredential(
      bigIntToUint8Array32LE(trapdoorField),
      bigIntToUint8Array32LE(nullifierField),
      bigIntToUint8Array32LE(secretHashField),
      bigIntToUint8Array32LE(commitmentField)
    );
  }

  /**
   * Poseidon hash function
   * This is a pure implementation that doesn't rely on Zerokit
   * @param inputs The inputs to hash
   * @returns The hash
   */
  private async poseidonHash(inputs: bigint[]): Promise<bigint> {
    const poseidon = await buildPoseidon();
    const fieldInputs = inputs.map((x) => x);
    const raw = poseidon(fieldInputs);
    const hash =
      typeof raw === "bigint"
        ? raw
        : BytesUtils.buildBigIntFromUint8ArrayBE(raw as Uint8Array);
    return hash;
  }
}
