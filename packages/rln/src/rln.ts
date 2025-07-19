import { createDecoder, createEncoder } from "@waku/core";
import type {
  ContentTopic,
  IDecodedMessage,
  IMetaSetter,
  IRoutingInfo
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import init from "@waku/zerokit-rln-wasm";
import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import {
  createRLNDecoder,
  createRLNEncoder,
  type RLNDecoder,
  type RLNEncoder
} from "./codec.js";
import { DEFAULT_RATE_LIMIT } from "./contract/constants.js";
import { RLNCredentialsManager } from "./credentials_manager.js";
import type {
  DecryptedCredentials,
  EncryptedCredentials
} from "./keystore/index.js";
import verificationKey from "./resources/verification_key";
import * as wc from "./resources/witness_calculator";
import { WitnessCalculator } from "./resources/witness_calculator";
import { Zerokit } from "./zerokit.js";

const log = new Logger("waku:rln");

type WakuRLNEncoderOptions = {
  /**
   * The routing information for messages to encode.
   */
  routingInfo: IRoutingInfo;
  /** The content topic to set on outgoing messages. */
  contentTopic: string;
  /**
   * An optional flag to mark message as ephemeral, i.e., not to be stored by Waku Store nodes.
   * @defaultValue `false`
   */
  ephemeral?: boolean;
  /**
   * A function called when encoding messages to set the meta field.
   * @param IProtoMessage The message encoded for wire, without the meta field.
   * If encryption is used, `metaSetter` only accesses _encrypted_ payload.
   */
  metaSetter?: IMetaSetter;
  /**
   * RLN Credentials
   */
  credentials: EncryptedCredentials | DecryptedCredentials;
};

export class RLNInstance extends RLNCredentialsManager {
  /**
   * Create an instance of RLN
   * @returns RLNInstance
   */
  public static async create(): Promise<RLNInstance> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (init as any)?.();
      zerokitRLN.init_panic_hook();

      const witnessCalculator = await RLNInstance.loadWitnessCalculator();
      const zkey = await RLNInstance.loadZkey();

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

  private constructor(public zerokit: Zerokit) {
    super(zerokit);
  }

  public async createEncoder(
    options: WakuRLNEncoderOptions
  ): Promise<RLNEncoder> {
    const { credentials: decryptedCredentials } =
      await RLNInstance.decryptCredentialsIfNeeded(options.credentials);
    const credentials = decryptedCredentials || this.credentials;

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

  public createDecoder(
    contentTopic: ContentTopic,
    routingInfo: IRoutingInfo
  ): RLNDecoder<IDecodedMessage> {
    return createRLNDecoder({
      rlnInstance: this,
      decoder: createDecoder(contentTopic, routingInfo)
    });
  }

  public static async loadWitnessCalculator(): Promise<WitnessCalculator> {
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

  public static async loadZkey(): Promise<Uint8Array> {
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
}
