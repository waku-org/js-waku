import {
  Decoder as DecoderV0,
  proto,
} from "@waku/core/lib/waku_message/version_0";
import type {
  Decoder as IDecoder,
  Encoder as IEncoder,
  Message,
  ProtoMessage,
} from "@waku/interfaces";
import debug from "debug";

import {
  decryptSymmetric,
  encryptSymmetric,
  postCipher,
  preCipher,
} from "./waku_payload.js";

import { DecodedMessage, OneMillion, Version } from "./index.js";

const log = debug("waku:message-encryption:symmetric");

class SymEncoder implements IEncoder {
  constructor(
    public contentTopic: string,
    private symKey: Uint8Array,
    private sigPrivKey?: Uint8Array,
    public ephemeral: boolean = false
  ) {}

  async toWire(message: Partial<Message>): Promise<Uint8Array | undefined> {
    const protoMessage = await this.toProtoObj(message);
    if (!protoMessage) return;

    return proto.WakuMessage.encode(protoMessage);
  }

  async toProtoObj(
    message: Partial<Message>
  ): Promise<ProtoMessage | undefined> {
    const timestamp = message.timestamp ?? new Date();
    if (!message.payload) {
      log("No payload to encrypt, skipping: ", message);
      return;
    }
    const preparedPayload = await preCipher(message.payload, this.sigPrivKey);

    const payload = await encryptSymmetric(preparedPayload, this.symKey);
    return {
      payload,
      version: Version,
      contentTopic: this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
      rateLimitProof: message.rateLimitProof,
      ephemeral: this.ephemeral,
    };
  }
}

export function createSymEncoder(
  contentTopic: string,
  symKey: Uint8Array,
  sigPrivKey?: Uint8Array,
  ephemeral = false
): SymEncoder {
  return new SymEncoder(contentTopic, symKey, sigPrivKey, ephemeral);
}

class SymDecoder extends DecoderV0 implements IDecoder<DecodedMessage> {
  constructor(contentTopic: string, private symKey: Uint8Array) {
    super(contentTopic);
  }

  async fromProtoObj(
    protoMessage: ProtoMessage
  ): Promise<DecodedMessage | undefined> {
    const cipherPayload = protoMessage.payload;

    if (protoMessage.version !== Version) {
      log(
        "Failed to decrypt due to incorrect version, expected:",
        Version,
        ", actual:",
        protoMessage.version
      );
      return;
    }

    let payload;
    if (!cipherPayload) {
      log(`No payload to decrypt for contentTopic ${this.contentTopic}`);
      return;
    }

    try {
      payload = await decryptSymmetric(cipherPayload, this.symKey);
    } catch (e) {
      log(
        `Failed to decrypt message using asymmetric decryption for contentTopic: ${this.contentTopic}`,
        e
      );
      return;
    }

    if (!payload) {
      log(`Failed to decrypt payload for contentTopic ${this.contentTopic}`);
      return;
    }

    const res = await postCipher(payload);

    if (!res) {
      log(`Failed to decode payload for contentTopic ${this.contentTopic}`);
      return;
    }

    log("Message decrypted", protoMessage);
    return new DecodedMessage(
      protoMessage,
      res.payload,
      res.sig?.signature,
      res.sig?.publicKey
    );
  }
}

export function createSymDecoder(
  contentTopic: string,
  symKey: Uint8Array
): SymDecoder {
  return new SymDecoder(contentTopic, symKey);
}
