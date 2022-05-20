import debug from "debug";
import Long from "long";
import protobufjs from "protobufjs/minimal";

import * as proto from "../../proto/waku/v2/message";
import { bytesToUtf8, utf8ToBytes } from "../utils";

import * as version_1 from "./version_1";

const { Reader } = protobufjs;
const DefaultVersion = 0;
const dbg = debug("waku:message");

export enum DecryptionMethod {
  Asymmetric = "asymmetric",
  Symmetric = "symmetric",
}

export interface Options {
  /**
   * Timestamp to set on the message, defaults to now if not passed.
   */
  timestamp?: Date;
  /**
   * Public Key to use to encrypt the messages using ECIES (Asymmetric Encryption).
   *
   * @throws if both `encPublicKey` and `symKey` are passed
   */
  encPublicKey?: Uint8Array | string;
  /**
   * Key to use to encrypt the messages using AES (Symmetric Encryption).
   *
   * @throws if both `encPublicKey` and `symKey` are passed
   */
  symKey?: Uint8Array | string;
  /**
   * Private key to use to sign the message, either `encPublicKey` or `symKey` must be provided as only
   * encrypted messages are signed.
   */
  sigPrivKey?: Uint8Array;
}

export class WakuMessage {
  private constructor(
    public proto: proto.WakuMessage,
    private _signaturePublicKey?: Uint8Array,
    private _signature?: Uint8Array
  ) {}

  /**
   * Create Message with an utf-8 string as payload.
   */
  static async fromUtf8String(
    utf8: string,
    contentTopic: string,
    opts?: Options
  ): Promise<WakuMessage> {
    const payload = utf8ToBytes(utf8);
    return WakuMessage.fromBytes(payload, contentTopic, opts);
  }

  /**
   * Create a Waku Message with the given payload.
   *
   * By default, the payload is kept clear (version 0).
   * If `opts.encPublicKey` is passed, the payload is encrypted using
   * asymmetric encryption (version 1).
   *
   * If `opts.sigPrivKey` is passed and version 1 is used, the payload is signed
   * before encryption.
   *
   * @throws if both `opts.encPublicKey` and `opt.symKey` are passed
   */
  static async fromBytes(
    payload: Uint8Array,
    contentTopic: string,
    opts?: Options
  ): Promise<WakuMessage> {
    const { timestamp, encPublicKey, symKey, sigPrivKey } = Object.assign(
      { timestamp: new Date() },
      opts ? opts : {}
    );

    let _payload = payload;
    let version = DefaultVersion;
    let sig;

    if (encPublicKey && symKey) {
      throw "Pass either `encPublicKey` or `symKey`, not both.";
    }

    if (encPublicKey) {
      const enc = await version_1.clearEncode(_payload, sigPrivKey);
      _payload = await version_1.encryptAsymmetric(enc.payload, encPublicKey);
      sig = enc.sig;
      version = 1;
    } else if (symKey) {
      const enc = await version_1.clearEncode(_payload, sigPrivKey);
      _payload = await version_1.encryptSymmetric(enc.payload, symKey);
      sig = enc.sig;
      version = 1;
    }

    return new WakuMessage(
      {
        payload: _payload,
        timestampDeprecated: timestamp.valueOf() / 1000,
        // milliseconds 10^-3 to nanoseconds 10^-9
        timestamp: Long.fromNumber(timestamp.valueOf()).mul(1_000_000),
        version,
        contentTopic,
      },
      sig?.publicKey,
      sig?.signature
    );
  }

  /**
   * Decode a byte array into Waku Message.
   *
   * @params bytes The message encoded using protobuf as defined in [14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14/).
   * @params decryptionKeys If the payload is encrypted (version = 1), then the
   * keys are used to attempt decryption of the message. The passed key can either
   * be asymmetric private keys or symmetric keys, both method are tried for each
   * key until the message is decrypted or combinations are run out.
   */
  static async decode(
    bytes: Uint8Array,
    decryptionKeys?: Array<{
      key: Uint8Array;
      method?: DecryptionMethod;
      contentTopic?: string[];
    }>
  ): Promise<WakuMessage | undefined> {
    const protoBuf = proto.WakuMessage.decode(Reader.create(bytes));

    return WakuMessage.decodeProto(protoBuf, decryptionKeys);
  }

  /**
   * Decode and decrypt Waku Message Protobuf Object into Waku Message.
   *
   * @params protoBuf The message to decode and decrypt.
   * @params decryptionKeys If the payload is encrypted (version = 1), then the
   * keys are used to attempt decryption of the message. The passed key can either
   * be asymmetric private keys or symmetric keys, both method are tried for each
   * key until the message is decrypted or combinations are run out.
   */
  static async decodeProto(
    protoBuf: proto.WakuMessage,
    decryptionKeys?: Array<{
      key: Uint8Array;
      method?: DecryptionMethod;
      contentTopics?: string[];
    }>
  ): Promise<WakuMessage | undefined> {
    if (protoBuf.payload === undefined) {
      dbg("Payload is undefined");
      return;
    }
    const payload = protoBuf.payload;

    let signaturePublicKey;
    let signature;
    if (protoBuf.version === 1 && protoBuf.payload) {
      if (decryptionKeys === undefined) {
        dbg("Payload is encrypted but no private keys have been provided.");
        return;
      }

      // Returns a bunch of `undefined` and hopefully one decrypted result
      const allResults = await Promise.all(
        decryptionKeys.map(async ({ key, method, contentTopics }) => {
          if (
            !contentTopics ||
            (protoBuf.contentTopic &&
              contentTopics.includes(protoBuf.contentTopic))
          ) {
            switch (method) {
              case DecryptionMethod.Asymmetric:
                try {
                  return await version_1.decryptAsymmetric(payload, key);
                } catch (e) {
                  dbg(
                    "Failed to decrypt message using asymmetric encryption despite decryption method being specified",
                    e
                  );
                  return;
                }
              case DecryptionMethod.Symmetric:
                try {
                  return await version_1.decryptSymmetric(payload, key);
                } catch (e) {
                  dbg(
                    "Failed to decrypt message using asymmetric encryption despite decryption method being specified",
                    e
                  );
                  return;
                }
              default:
                try {
                  return await version_1.decryptSymmetric(payload, key);
                } catch (e) {
                  dbg(
                    "Failed to decrypt message using symmetric encryption",
                    e
                  );
                  try {
                    return await version_1.decryptAsymmetric(payload, key);
                  } catch (e) {
                    dbg(
                      "Failed to decrypt message using asymmetric encryption",
                      e
                    );
                    return;
                  }
                }
            }
          } else {
            // No key available for this content topic
            return;
          }
        })
      );

      const isDefined = (dec: Uint8Array | undefined): dec is Uint8Array => {
        return !!dec;
      };

      const decodedResults = allResults.filter(isDefined);

      if (decodedResults.length === 0) {
        dbg("Failed to decrypt payload.");
        return;
      }
      const dec = decodedResults[0];

      const res = await version_1.clearDecode(dec);
      if (!res) {
        dbg("Failed to decode payload.");
        return;
      }
      Object.assign(protoBuf, { payload: res.payload });
      signaturePublicKey = res.sig?.publicKey;
      signature = res.sig?.signature;
    }

    return new WakuMessage(protoBuf, signaturePublicKey, signature);
  }

  encode(): Uint8Array {
    return proto.WakuMessage.encode(this.proto).finish();
  }

  get payloadAsUtf8(): string {
    if (!this.payload) {
      return "";
    }

    try {
      return bytesToUtf8(this.payload);
    } catch (e) {
      dbg("Could not decode byte as UTF-8", e);
      return "";
    }
  }

  get payload(): Uint8Array | undefined {
    if (this.proto.payload) {
      return new Uint8Array(this.proto.payload);
    }
    return;
  }

  get contentTopic(): string | undefined {
    return this.proto.contentTopic;
  }

  get version(): number | undefined {
    return this.proto.version;
  }

  get timestamp(): Date | undefined {
    // In the case we receive a value that is bigger than JS's max number,
    // we catch the error and return undefined.
    try {
      if (this.proto.timestamp) {
        // nanoseconds 10^-9 to milliseconds 10^-3
        const timestamp = this.proto.timestamp.div(1_000_000).toNumber();
        return new Date(timestamp);
      }

      if (this.proto.timestampDeprecated) {
        return new Date(this.proto.timestampDeprecated * 1000);
      }
    } catch (e) {
      return;
    }
    return;
  }

  /**
   * The public key used to sign the message.
   *
   * MAY be present if the message is version 1.
   */
  get signaturePublicKey(): Uint8Array | undefined {
    return this._signaturePublicKey;
  }

  /**
   * The signature of the message.
   *
   * MAY be present if the message is version 1.
   */
  get signature(): Uint8Array | undefined {
    return this._signature;
  }
}
