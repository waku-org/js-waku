// Ensure that this class matches the proto interface while
import { Buffer } from 'buffer';

import debug from 'debug';
import { Reader } from 'protobufjs/minimal';

// Protecting the user from protobuf oddities
import * as proto from '../../proto/waku/v2/message';

import * as version_1 from './version_1';

export const DefaultContentTopic = '/waku/2/default-content/proto';
const DefaultVersion = 0;
const dbg = debug('waku:message');

export interface Options {
  /**
   * Content topic to set on the message, defaults to {@link DefaultContentTopic}
   * if not passed.
   */
  contentTopic?: string;
  /**
   * Timestamp to set on the message, defaults to now if not passed.
   */
  timestamp?: Date;
  /**
   * Public Key to use to encrypt the messages using ECIES (Asymmetric Encryption).
   */
  encPublicKey?: Uint8Array | string;
  /**
   * Private key to use to sign the message, `encPublicKey` must be provided as only
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
   * Create Message with a utf-8 string as payload.
   */
  static async fromUtf8String(
    utf8: string,
    opts?: Options
  ): Promise<WakuMessage> {
    const payload = Buffer.from(utf8, 'utf-8');
    return WakuMessage.fromBytes(payload, opts);
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
   */
  static async fromBytes(
    payload: Uint8Array,
    opts?: Options
  ): Promise<WakuMessage> {
    const { timestamp, contentTopic, encPublicKey, sigPrivKey } = Object.assign(
      { timestamp: new Date(), contentTopic: DefaultContentTopic },
      opts ? opts : {}
    );

    let _payload = payload;
    let version = DefaultVersion;
    let sig;
    if (encPublicKey) {
      const enc = version_1.clearEncode(_payload, sigPrivKey);
      _payload = await version_1.encryptAsymmetric(enc.payload, encPublicKey);
      sig = enc.sig;
      version = 1;
    }

    return new WakuMessage(
      {
        payload: _payload,
        timestamp: timestamp.valueOf() / 1000,
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
   * If the payload is encrypted, then `decPrivateKey` is used for decryption.
   */
  static async decode(
    bytes: Uint8Array,
    decPrivateKeys?: Uint8Array[]
  ): Promise<WakuMessage | undefined> {
    const protoBuf = proto.WakuMessage.decode(Reader.create(bytes));

    return WakuMessage.decodeProto(protoBuf, decPrivateKeys);
  }

  /**
   * Decode a Waku Message Protobuf Object into Waku Message.
   *
   * If the payload is encrypted, then `decPrivateKey` is used for decryption.
   */
  static async decodeProto(
    protoBuf: proto.WakuMessage,
    decPrivateKeys?: Uint8Array[]
  ): Promise<WakuMessage | undefined> {
    if (protoBuf.payload === undefined) {
      dbg('Payload is undefined');
      return;
    }
    const payload = protoBuf.payload;

    let signaturePublicKey;
    let signature;
    if (protoBuf.version === 1 && protoBuf.payload) {
      if (decPrivateKeys === undefined) {
        dbg('Payload is encrypted but no private keys have been provided.');

        return;
      }

      // Returns a bunch of `undefined` and hopefully one decrypted result
      const allResults = await Promise.all(
        decPrivateKeys.map(async (privateKey) => {
          try {
            return await version_1.decryptAsymmetric(payload, privateKey);
          } catch (e) {
            dbg('Failed to decrypt asymmetric message', e);
            return;
          }
        })
      );

      const isDefined = (dec: Uint8Array | undefined): dec is Uint8Array => {
        return !!dec;
      };

      const decodedResults = allResults.filter(isDefined);

      if (decodedResults.length === 0) {
        dbg('Failed to decrypt payload.');
        return;
      }
      const dec = decodedResults[0];

      const res = await version_1.clearDecode(dec);
      if (!res) {
        dbg('Failed to decode payload.');
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
    if (!this.proto.payload) {
      return '';
    }

    return Array.from(this.proto.payload)
      .map((char) => {
        return String.fromCharCode(char);
      })
      .join('');
  }

  get payload(): Uint8Array | undefined {
    return this.proto.payload;
  }

  get contentTopic(): string | undefined {
    return this.proto.contentTopic;
  }

  get version(): number | undefined {
    return this.proto.version;
  }

  get timestamp(): Date | undefined {
    if (this.proto.timestamp) {
      return new Date(this.proto.timestamp * 1000);
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
