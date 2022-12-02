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
  decryptAsymmetric,
  encryptAsymmetric,
  postCipher,
  preCipher,
} from "./waku_payload.js";

import {
  DecodedMessage,
  generatePrivateKey,
  getPublicKey,
  OneMillion,
  Version,
} from "./index.js";

export { DecodedMessage, generatePrivateKey, getPublicKey };

const log = debug("waku:message-encryption:ecies");

class Encoder implements IEncoder {
  constructor(
    public contentTopic: string,
    private publicKey: Uint8Array,
    private sigPrivKey?: Uint8Array,
    public ephemeral: boolean = false
  ) {}

  async toWire(message: Message): Promise<Uint8Array | undefined> {
    const protoMessage = await this.toProtoObj(message);
    if (!protoMessage) return;

    return proto.WakuMessage.encode(protoMessage);
  }

  async toProtoObj(message: Message): Promise<ProtoMessage | undefined> {
    const timestamp = message.timestamp ?? new Date();
    if (!message.payload) {
      log("No payload to encrypt, skipping: ", message);
      return;
    }
    const preparedPayload = await preCipher(message.payload, this.sigPrivKey);

    const payload = await encryptAsymmetric(preparedPayload, this.publicKey);

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

export function createEncoder(
  contentTopic: string,
  publicKey: Uint8Array,
  sigPrivKey?: Uint8Array,
  ephemeral = false
): Encoder {
  return new Encoder(contentTopic, publicKey, sigPrivKey, ephemeral);
}

class Decoder extends DecoderV0 implements IDecoder<DecodedMessage> {
  constructor(contentTopic: string, private privateKey: Uint8Array) {
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
      payload = await decryptAsymmetric(cipherPayload, this.privateKey);
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

export function createDecoder(
  contentTopic: string,
  privateKey: Uint8Array
): Decoder {
  return new Decoder(contentTopic, privateKey);
}
