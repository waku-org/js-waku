import * as protobuf from "protobufjs/light";

export interface PublicKeyMessagePayload {
  encryptionPublicKey: Uint8Array;
  ethAddress: Uint8Array;
  signature: Uint8Array;
}

const Root = protobuf.Root,
  Type = protobuf.Type,
  Field = protobuf.Field;

/**
 * Message used to communicate the encryption public key linked to a given Ethereum account
 */
export class PublicKeyMessage {
  private static Type = new Type("PublicKeyMessage")
    .add(new Field("encryptionPublicKey", 1, "bytes"))
    .add(new Field("ethAddress", 2, "bytes"))
    .add(new Field("signature", 3, "bytes"));
  private static Root = new Root()
    .define("messages")
    .add(PublicKeyMessage.Type);

  constructor(public payload: PublicKeyMessagePayload) {}

  public encode(): Uint8Array {
    const message = PublicKeyMessage.Type.create(this.payload);
    return PublicKeyMessage.Type.encode(message).finish();
  }

  public static decode(
    bytes: Uint8Array | Buffer
  ): PublicKeyMessage | undefined {
    const payload = PublicKeyMessage.Type.decode(
      bytes
    ) as unknown as PublicKeyMessagePayload;
    if (
      !payload.signature ||
      !payload.encryptionPublicKey ||
      !payload.ethAddress
    ) {
      console.log("Field missing on decoded Public Key Message", payload);
      return;
    }
    return new PublicKeyMessage(payload);
  }

  get encryptionPublicKey(): Uint8Array {
    return this.payload.encryptionPublicKey;
  }

  get ethAddress(): Uint8Array {
    return this.payload.ethAddress;
  }

  get signature(): Uint8Array {
    return this.payload.signature;
  }
}

export interface PrivateMessagePayload {
  toAddress: Uint8Array;
  message: string;
}

/**
 * Encrypted Message used for private communication over the Waku network.
 */
export class PrivateMessage {
  private static Type = new Type("PrivateMessage")
    .add(new Field("toAddress", 1, "bytes"))
    .add(new Field("message", 2, "string"));
  private static Root = new Root().define("messages").add(PrivateMessage.Type);

  constructor(public payload: PrivateMessagePayload) {}

  public encode(): Uint8Array {
    const message = PrivateMessage.Type.create(this.payload);
    return PrivateMessage.Type.encode(message).finish();
  }

  public static decode(bytes: Uint8Array | Buffer): PrivateMessage | undefined {
    const payload = PrivateMessage.Type.decode(
      bytes
    ) as unknown as PrivateMessagePayload;
    if (!payload.toAddress || !payload.message) {
      console.log("Field missing on decoded PrivateMessage", payload);
      return;
    }
    return new PrivateMessage(payload);
  }

  get toAddress(): Uint8Array {
    return this.payload.toAddress;
  }

  get message(): string {
    return this.payload.message;
  }
}
