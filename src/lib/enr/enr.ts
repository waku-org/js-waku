import * as RLP from "@ethersproject/rlp";
import debug from "debug";
import { Multiaddr, protocols } from "multiaddr";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import muConvert from "multiaddr/src/convert";
import PeerId from "peer-id";
import { fromString } from "uint8arrays/from-string";
import { toString } from "uint8arrays/to-string";
import { encode as varintEncode } from "varint";

import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "../utils";

import { ERR_INVALID_ID, ERR_NO_SIGNATURE, MAX_RECORD_SIZE } from "./constants";
import {
  createKeypair,
  createKeypairFromPeerId,
  createPeerIdFromKeypair,
  IKeypair,
  KeypairType,
} from "./keypair";
import { decodeMultiaddrs, encodeMultiaddrs } from "./multiaddrs_codec";
import { ENRKey, ENRValue, NodeId, SequenceNumber } from "./types";
import * as v4 from "./v4";
import { compressPublicKey } from "./v4";
import { decodeWaku2, encodeWaku2, Waku2 } from "./waku2_codec";

const dbg = debug("waku:enr");

export class ENR extends Map<ENRKey, ENRValue> {
  public static readonly RECORD_PREFIX = "enr:";
  public seq: SequenceNumber;
  public signature: Uint8Array | null;
  public peerId?: PeerId;

  constructor(
    kvs: Record<ENRKey, ENRValue> = {},
    seq: SequenceNumber = BigInt(1),
    signature: Uint8Array | null = null
  ) {
    super(Object.entries(kvs));
    this.seq = seq;
    this.signature = signature;

    try {
      const publicKey = this.publicKey;
      if (publicKey) {
        const keypair = createKeypair(this.keypairType, undefined, publicKey);
        this.peerId = createPeerIdFromKeypair(keypair);
      }
    } catch (e) {
      dbg("Could not calculate peer id for ENR", e);
    }
  }

  static createV4(
    publicKey: Uint8Array,
    kvs: Record<ENRKey, ENRValue> = {}
  ): ENR {
    // EIP-778 specifies that the key must be in compressed format, 33 bytes
    if (publicKey.length !== 33) {
      publicKey = compressPublicKey(publicKey);
    }
    return new ENR({
      ...kvs,
      id: utf8ToBytes("v4"),
      secp256k1: publicKey,
    });
  }

  static createFromPeerId(
    peerId: PeerId,
    kvs: Record<ENRKey, ENRValue> = {}
  ): ENR {
    const keypair = createKeypairFromPeerId(peerId);
    switch (keypair.type) {
      case KeypairType.secp256k1:
        return ENR.createV4(keypair.publicKey, kvs);
      default:
        throw new Error();
    }
  }

  static decodeFromValues(decoded: Uint8Array[]): ENR {
    if (!Array.isArray(decoded)) {
      throw new Error("Decoded ENR must be an array");
    }
    if (decoded.length % 2 !== 0) {
      throw new Error("Decoded ENR must have an even number of elements");
    }
    const [signature, seq, ...kvs] = decoded;
    if (!signature || Array.isArray(signature)) {
      throw new Error("Decoded ENR invalid signature: must be a byte array");
    }
    if (!seq || Array.isArray(seq)) {
      throw new Error(
        "Decoded ENR invalid sequence number: must be a byte array"
      );
    }
    const obj: Record<ENRKey, ENRValue> = {};
    for (let i = 0; i < kvs.length; i += 2) {
      try {
        obj[bytesToUtf8(kvs[i])] = kvs[i + 1];
      } catch (e) {
        dbg("Failed to decode ENR key to UTF-8, skipping it", kvs[i], e);
      }
    }
    // If seq is an empty array, translate as value 0
    const hexSeq = "0x" + (seq.length ? bytesToHex(seq) : "00");

    const enr = new ENR(obj, BigInt(hexSeq), signature);

    const rlpEncodedBytes = hexToBytes(RLP.encode([seq, ...kvs]));
    if (!enr.verify(rlpEncodedBytes, signature)) {
      throw new Error("Unable to verify ENR signature");
    }
    return enr;
  }

  static decode(encoded: Uint8Array): ENR {
    const decoded = RLP.decode(encoded).map(hexToBytes);
    return ENR.decodeFromValues(decoded);
  }

  static decodeTxt(encoded: string): ENR {
    if (!encoded.startsWith(this.RECORD_PREFIX)) {
      throw new Error(
        `"string encoded ENR must start with '${this.RECORD_PREFIX}'`
      );
    }
    return ENR.decode(fromString(encoded.slice(4), "base64url"));
  }

  set(k: ENRKey, v: ENRValue): this {
    this.signature = null;
    this.seq++;
    return super.set(k, v);
  }

  get id(): string {
    const id = this.get("id");
    if (!id) throw new Error("id not found.");
    return bytesToUtf8(id);
  }

  get keypairType(): KeypairType {
    switch (this.id) {
      case "v4":
        return KeypairType.secp256k1;
      default:
        throw new Error(ERR_INVALID_ID);
    }
  }

  get publicKey(): Uint8Array | undefined {
    switch (this.id) {
      case "v4":
        return this.get("secp256k1");
      default:
        throw new Error(ERR_INVALID_ID);
    }
  }

  get keypair(): IKeypair | undefined {
    if (this.publicKey) {
      const publicKey = this.publicKey;
      return createKeypair(this.keypairType, undefined, publicKey);
    }
    return;
  }

  get nodeId(): NodeId | undefined {
    switch (this.id) {
      case "v4":
        return this.publicKey ? v4.nodeId(this.publicKey) : undefined;
      default:
        throw new Error(ERR_INVALID_ID);
    }
  }

  get ip(): string | undefined {
    const raw = this.get("ip");
    if (raw) {
      return muConvert.toString(protocols.names.ip4.code, raw) as string;
    } else {
      return undefined;
    }
  }

  set ip(ip: string | undefined) {
    if (ip) {
      this.set("ip", muConvert.toBytes(protocols.names.ip4.code, ip));
    } else {
      this.delete("ip");
    }
  }

  get tcp(): number | undefined {
    const raw = this.get("tcp");
    if (raw) {
      return Number(muConvert.toString(protocols.names.tcp.code, raw));
    } else {
      return undefined;
    }
  }

  set tcp(port: number | undefined) {
    if (port === undefined) {
      this.delete("tcp");
    } else {
      this.set("tcp", muConvert.toBytes(protocols.names.tcp.code, port));
    }
  }

  get udp(): number | undefined {
    const raw = this.get("udp");
    if (raw) {
      return Number(muConvert.toString(protocols.names.udp.code, raw));
    } else {
      return undefined;
    }
  }

  set udp(port: number | undefined) {
    if (port === undefined) {
      this.delete("udp");
    } else {
      this.set("udp", muConvert.toBytes(protocols.names.udp.code, port));
    }
  }

  get ip6(): string | undefined {
    const raw = this.get("ip6");
    if (raw) {
      return muConvert.toString(protocols.names.ip6.code, raw) as string;
    } else {
      return undefined;
    }
  }

  set ip6(ip: string | undefined) {
    if (ip) {
      this.set("ip6", muConvert.toBytes(protocols.names.ip6.code, ip));
    } else {
      this.delete("ip6");
    }
  }

  get tcp6(): number | undefined {
    const raw = this.get("tcp6");
    if (raw) {
      return Number(muConvert.toString(protocols.names.tcp.code, raw));
    } else {
      return undefined;
    }
  }

  set tcp6(port: number | undefined) {
    if (port === undefined) {
      this.delete("tcp6");
    } else {
      this.set("tcp6", muConvert.toBytes(protocols.names.tcp.code, port));
    }
  }

  get udp6(): number | undefined {
    const raw = this.get("udp6");
    if (raw) {
      return Number(muConvert.toString(protocols.names.udp.code, raw));
    } else {
      return undefined;
    }
  }

  set udp6(port: number | undefined) {
    if (port === undefined) {
      this.delete("udp6");
    } else {
      this.set("udp6", muConvert.toBytes(protocols.names.udp.code, port));
    }
  }

  /**
   * Get the `multiaddrs` field from ENR.
   *
   * This field is used to store multiaddresses that cannot be stored with the current ENR pre-defined keys.
   * These can be a multiaddresses that include encapsulation (e.g. wss) or do not use `ip4` nor `ip6` for the host
   * address (e.g. `dns4`, `dnsaddr`, etc)..
   *
   * If the peer information only contains information that can be represented with the ENR pre-defined keys
   * (ip, tcp, etc) then the usage of [[getLocationMultiaddr]] should be preferred.
   *
   * The multiaddresses stored in this field are expected to be location multiaddresses, ie, peer id less.
   */
  get multiaddrs(): Multiaddr[] | undefined {
    const raw = this.get("multiaddrs");

    if (raw) return decodeMultiaddrs(raw);

    return;
  }

  /**
   * Set the `multiaddrs` field on the ENR.
   *
   * This field is used to store multiaddresses that cannot be stored with the current ENR pre-defined keys.
   * These can be a multiaddresses that include encapsulation (e.g. wss) or do not use `ip4` nor `ip6` for the host
   * address (e.g. `dns4`, `dnsaddr`, etc)..
   *
   * If the peer information only contains information that can be represented with the ENR pre-defined keys
   * (ip, tcp, etc) then the usage of [[setLocationMultiaddr]] should be preferred.
   * The multiaddresses stored in this field must be location multiaddresses,
   * ie, without a peer id.
   */
  set multiaddrs(multiaddrs: Multiaddr[] | undefined) {
    if (multiaddrs === undefined) {
      this.delete("multiaddrs");
    } else {
      const multiaddrsBuf = encodeMultiaddrs(multiaddrs);
      this.set("multiaddrs", multiaddrsBuf);
    }
  }

  getLocationMultiaddr(
    protocol: "udp" | "udp4" | "udp6" | "tcp" | "tcp4" | "tcp6"
  ): Multiaddr | undefined {
    if (protocol === "udp") {
      return (
        this.getLocationMultiaddr("udp4") || this.getLocationMultiaddr("udp6")
      );
    }
    if (protocol === "tcp") {
      return (
        this.getLocationMultiaddr("tcp4") || this.getLocationMultiaddr("tcp6")
      );
    }
    const isIpv6 = protocol.endsWith("6");
    const ipVal = this.get(isIpv6 ? "ip6" : "ip");
    if (!ipVal) {
      return undefined;
    }

    const isUdp = protocol.startsWith("udp");
    const isTcp = protocol.startsWith("tcp");
    let protoName, protoVal;
    if (isUdp) {
      protoName = "udp";
      protoVal = isIpv6 ? this.get("udp6") : this.get("udp");
    } else if (isTcp) {
      protoName = "tcp";
      protoVal = isIpv6 ? this.get("tcp6") : this.get("tcp");
    } else {
      return undefined;
    }
    if (!protoVal) {
      return undefined;
    }

    // Create raw multiaddr buffer
    // multiaddr length is:
    //  1 byte for the ip protocol (ip4 or ip6)
    //  N bytes for the ip address
    //  1 or 2 bytes for the protocol as buffer (tcp or udp)
    //  2 bytes for the port
    const ipMa = protocols.names[isIpv6 ? "ip6" : "ip4"];
    const ipByteLen = ipMa.size / 8;
    const protoMa = protocols.names[protoName];
    const protoBuf = varintEncode(protoMa.code);
    const maBuf = new Uint8Array(3 + ipByteLen + protoBuf.length);
    maBuf[0] = ipMa.code;
    maBuf.set(ipVal, 1);
    maBuf.set(protoBuf, 1 + ipByteLen);
    maBuf.set(protoVal, 1 + ipByteLen + protoBuf.length);

    return new Multiaddr(maBuf);
  }

  setLocationMultiaddr(multiaddr: Multiaddr): void {
    const protoNames = multiaddr.protoNames();
    if (
      protoNames.length !== 2 &&
      protoNames[1] !== "udp" &&
      protoNames[1] !== "tcp"
    ) {
      throw new Error("Invalid multiaddr");
    }
    const tuples = multiaddr.tuples();
    if (!tuples[0][1] || !tuples[1][1]) {
      throw new Error("Invalid multiaddr");
    }

    // IPv4
    if (tuples[0][0] === 4) {
      this.set("ip", tuples[0][1]);
      this.set(protoNames[1], tuples[1][1]);
    } else {
      this.set("ip6", tuples[0][1]);
      this.set(protoNames[1] + "6", tuples[1][1]);
    }
  }

  /**
   * Returns the full multiaddr from the ENR fields matching the provided
   * `protocol` parameter.
   * To return full multiaddrs from the `multiaddrs` ENR field,
   * use [[ENR.getFullMultiaddrs]]
   *
   * @param protocol
   */
  getFullMultiaddr(
    protocol: "udp" | "udp4" | "udp6" | "tcp" | "tcp4" | "tcp6"
  ): Multiaddr | undefined {
    if (this.peerId) {
      const locationMultiaddr = this.getLocationMultiaddr(protocol);
      if (locationMultiaddr) {
        return locationMultiaddr.encapsulate(
          `/p2p/${this.peerId.toB58String()}`
        );
      }
    }
    return;
  }

  /**
   * Returns the full multiaddrs from the `multiaddrs` ENR field.
   */
  getFullMultiaddrs(): Multiaddr[] {
    if (this.peerId && this.multiaddrs) {
      const peerId = this.peerId;
      return this.multiaddrs.map((ma) => {
        return ma.encapsulate(`/p2p/${peerId.toB58String()}`);
      });
    }
    return [];
  }

  /**
   * Get the `waku2` field from ENR.
   */
  get waku2(): Waku2 | undefined {
    const raw = this.get("waku2");
    if (raw) return decodeWaku2(raw[0]);

    return;
  }

  /**
   * Set the `waku2` field on the ENR.
   */
  set waku2(waku2: Waku2 | undefined) {
    if (waku2 === undefined) {
      this.delete("waku2");
    } else {
      const byte = encodeWaku2(waku2);
      this.set("waku2", new Uint8Array([byte]));
    }
  }

  verify(data: Uint8Array, signature: Uint8Array): boolean {
    if (!this.get("id") || this.id !== "v4") {
      throw new Error(ERR_INVALID_ID);
    }
    if (!this.publicKey) {
      throw new Error("Failed to verify ENR: No public key");
    }
    return v4.verify(this.publicKey, data, signature);
  }

  async sign(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    switch (this.id) {
      case "v4":
        this.signature = await v4.sign(privateKey, data);
        break;
      default:
        throw new Error(ERR_INVALID_ID);
    }
    return this.signature;
  }

  async encodeToValues(
    privateKey?: Uint8Array
  ): Promise<(ENRKey | ENRValue | number[])[]> {
    // sort keys and flatten into [k, v, k, v, ...]
    const content: Array<ENRKey | ENRValue | number[]> = Array.from(this.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, this.get(k)] as [ENRKey, ENRValue])
      .map(([k, v]) => [utf8ToBytes(k), v])
      .flat();
    content.unshift(new Uint8Array([Number(this.seq)]));
    if (privateKey) {
      content.unshift(
        await this.sign(hexToBytes(RLP.encode(content)), privateKey)
      );
    } else {
      if (!this.signature) {
        throw new Error(ERR_NO_SIGNATURE);
      }
      content.unshift(this.signature);
    }
    return content;
  }

  async encode(privateKey?: Uint8Array): Promise<Uint8Array> {
    const encoded = hexToBytes(
      RLP.encode(await this.encodeToValues(privateKey))
    );
    if (encoded.length >= MAX_RECORD_SIZE) {
      throw new Error("ENR must be less than 300 bytes");
    }
    return encoded;
  }

  async encodeTxt(privateKey?: Uint8Array): Promise<string> {
    return (
      ENR.RECORD_PREFIX + toString(await this.encode(privateKey), "base64url")
    );
  }
}
