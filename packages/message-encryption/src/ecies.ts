import { Decoder as DecoderV0 } from "@waku/core/lib/message/version_0";
import {
  type IDecoder,
  type IEncoder,
  type IEncryptedMessage,
  type IMessage,
  type IMetaSetter,
  type IProtoMessage,
  type IRoutingInfo
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { generatePrivateKey } from "./crypto/utils.js";
import { DecodedMessage } from "./decoded_message.js";
import {
  decryptAsymmetric,
  encryptAsymmetric,
  postCipher,
  preCipher
} from "./encryption.js";
import { OneMillion, Version } from "./misc.js";

export {
  decryptAsymmetric,
  encryptAsymmetric,
  postCipher,
  preCipher,
  generatePrivateKey
};

const log = new Logger("message-encryption:ecies");

class Encoder implements IEncoder {
  public constructor(
    public contentTopic: string,
    public routingInfo: IRoutingInfo,
    private publicKey: Uint8Array,
    private sigPrivKey?: Uint8Array,
    public ephemeral: boolean = false,
    public metaSetter?: IMetaSetter
  ) {
    if (!contentTopic || contentTopic === "") {
      throw new Error("Content topic must be specified");
    }
  }

  public async toWire(message: IMessage): Promise<Uint8Array | undefined> {
    const protoMessage = await this.toProtoObj(message);
    if (!protoMessage) return;

    return WakuMessage.encode(protoMessage);
  }

  public async toProtoObj(
    message: IMessage
  ): Promise<IProtoMessage | undefined> {
    const timestamp = message.timestamp ?? new Date();
    const preparedPayload = await preCipher(message.payload, this.sigPrivKey);

    const payload = await encryptAsymmetric(preparedPayload, this.publicKey);

    const protoMessage = {
      payload,
      version: Version,
      contentTopic: this.contentTopic,
      timestamp: BigInt(timestamp.valueOf()) * OneMillion,
      meta: undefined,
      rateLimitProof: message.rateLimitProof,
      ephemeral: this.ephemeral
    };

    if (this.metaSetter) {
      const meta = this.metaSetter(protoMessage);
      return { ...protoMessage, meta };
    }

    return protoMessage;
  }
}

export interface EncoderOptions {
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
  /** The public key to encrypt the payload for. */
  publicKey: Uint8Array;
  /**  An optional private key to be used to sign the payload before encryption. */
  sigPrivKey?: Uint8Array;
}

/**
 * Creates an encoder that encrypts messages using ECIES for the given public,
 * as defined in [26/WAKU2-PAYLOAD](https://rfc.vac.dev/spec/26/).
 *
 * An encoder is used to encode messages in the [`14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format to be sent over the Waku network. The resulting encoder can then be
 * pass to { @link @waku/interfaces!ISender.send } or
 * { @link @waku/interfaces!ISender.send } to automatically encrypt
 * and encode outgoing messages.
 * The payload can optionally be signed with the given private key as defined
 * in [26/WAKU2-PAYLOAD](https://rfc.vac.dev/spec/26/).
 */
export function createEncoder({
  contentTopic,
  routingInfo,
  publicKey,
  sigPrivKey,
  ephemeral = false,
  metaSetter
}: EncoderOptions): Encoder {
  return new Encoder(
    contentTopic,
    routingInfo,
    publicKey,
    sigPrivKey,
    ephemeral,
    metaSetter
  );
}

class Decoder extends DecoderV0 implements IDecoder<IEncryptedMessage> {
  public constructor(
    contentTopic: string,
    routingInfo: IRoutingInfo,
    private privateKey: Uint8Array
  ) {
    super(contentTopic, routingInfo);
  }

  public async fromProtoObj(
    pubsubTopic: string,
    protoMessage: IProtoMessage
  ): Promise<IEncryptedMessage | undefined> {
    const cipherPayload = protoMessage.payload;

    if (protoMessage.version !== Version) {
      log.error(
        "Failed to decrypt due to incorrect version, expected:",
        Version,
        ", actual:",
        protoMessage.version
      );
      return;
    }

    let payload;

    try {
      payload = await decryptAsymmetric(cipherPayload, this.privateKey);
    } catch (e) {
      log.error(
        `Failed to decrypt message using asymmetric decryption for contentTopic: ${this.contentTopic}`,
        e
      );
      return;
    }

    if (!payload) {
      log.error(
        `Failed to decrypt payload for contentTopic ${this.contentTopic}`
      );
      return;
    }

    const res = postCipher(payload);

    if (!res) {
      log.error(
        `Failed to decode payload for contentTopic ${this.contentTopic}`
      );
      return;
    }

    log.info("Message decrypted", protoMessage);
    return new DecodedMessage(
      pubsubTopic,
      protoMessage,
      res.payload,
      res.sig?.signature,
      res.sig?.publicKey
    );
  }
}

/**
 * Creates a decoder that decrypts messages using ECIES, using the given private
 * key as defined in [26/WAKU2-PAYLOAD](https://rfc.vac.dev/spec/26/).
 *
 * A decoder is used to decode messages from the [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/)
 * format when received from the Waku network. The resulting decoder can then be
 * pass to { @link @waku/interfaces!IReceiver.subscribe } to automatically decrypt and
 * decode incoming messages.
 *
 * @param contentTopic The resulting decoder will only decode messages with this content topic.
 * @param routingInfo
 * @param privateKey The private key used to decrypt the message.
 */
export function createDecoder(
  contentTopic: string,
  routingInfo: IRoutingInfo,
  privateKey: Uint8Array
): Decoder {
  return new Decoder(contentTopic, routingInfo, privateKey);
}
