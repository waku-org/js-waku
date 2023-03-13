import type { Multiaddr } from "@multiformats/multiaddr";
import {
  convertToBytes,
  convertToString,
} from "@multiformats/multiaddr/convert";
import type { ENRKey, ENRValue, SequenceNumber, Waku2 } from "@waku/interfaces";
import { bytesToUtf8 } from "@waku/utils/bytes";

import { ERR_INVALID_ID } from "./constants.js";
import { decodeMultiaddrs, encodeMultiaddrs } from "./multiaddrs_codec.js";
import { decodeWaku2, encodeWaku2 } from "./waku2_codec.js";

export class RawEnr extends Map<ENRKey, ENRValue> {
  public seq: SequenceNumber;
  public signature?: Uint8Array;

  protected constructor(
    kvs: Record<ENRKey, ENRValue> = {},
    seq: SequenceNumber = BigInt(1),
    signature?: Uint8Array
  ) {
    super(Object.entries(kvs));
    this.seq = seq;
    this.signature = signature;
  }

  set(k: ENRKey, v: ENRValue): this {
    this.signature = undefined;
    this.seq++;
    return super.set(k, v);
  }

  get id(): string {
    const id = this.get("id");
    if (!id) throw new Error("id not found.");
    return bytesToUtf8(id);
  }

  get publicKey(): Uint8Array | undefined {
    switch (this.id) {
      case "v4":
        return this.get("secp256k1");
      default:
        throw new Error(ERR_INVALID_ID);
    }
  }

  get ip(): string | undefined {
    const raw = this.get("ip");
    if (raw) {
      return convertToString("ip4", raw) as string;
    } else {
      return undefined;
    }
  }

  set ip(ip: string | undefined) {
    if (ip) {
      this.set("ip", convertToBytes("ip4", ip));
    } else {
      this.delete("ip");
    }
  }

  get tcp(): number | undefined {
    const raw = this.get("tcp");
    if (raw) {
      return Number(convertToString("tcp", raw));
    } else {
      return undefined;
    }
  }

  set tcp(port: number | undefined) {
    if (port === undefined) {
      this.delete("tcp");
    } else {
      this.set("tcp", convertToBytes("tcp", port.toString(10)));
    }
  }

  get udp(): number | undefined {
    const raw = this.get("udp");
    if (raw) {
      return Number(convertToString("udp", raw));
    } else {
      return undefined;
    }
  }

  set udp(port: number | undefined) {
    if (port === undefined) {
      this.delete("udp");
    } else {
      this.set("udp", convertToBytes("udp", port.toString(10)));
    }
  }

  get ip6(): string | undefined {
    const raw = this.get("ip6");
    if (raw) {
      return convertToString("ip6", raw) as string;
    } else {
      return undefined;
    }
  }

  set ip6(ip: string | undefined) {
    if (ip) {
      this.set("ip6", convertToBytes("ip6", ip));
    } else {
      this.delete("ip6");
    }
  }

  get tcp6(): number | undefined {
    const raw = this.get("tcp6");
    if (raw) {
      return Number(convertToString("tcp", raw));
    } else {
      return undefined;
    }
  }

  set tcp6(port: number | undefined) {
    if (port === undefined) {
      this.delete("tcp6");
    } else {
      this.set("tcp6", convertToBytes("tcp", port.toString(10)));
    }
  }

  get udp6(): number | undefined {
    const raw = this.get("udp6");
    if (raw) {
      return Number(convertToString("udp", raw));
    } else {
      return undefined;
    }
  }

  set udp6(port: number | undefined) {
    if (port === undefined) {
      this.delete("udp6");
    } else {
      this.set("udp6", convertToBytes("udp", port.toString(10)));
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
   * (ip, tcp, etc) then the usage of { @link ENR.getLocationMultiaddr } should be preferred.
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
   * (ip, tcp, etc) then the usage of { @link ENR.setLocationMultiaddr } should be preferred.
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
}
