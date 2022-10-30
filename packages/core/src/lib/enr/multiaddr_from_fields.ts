import { multiaddr } from "@multiformats/multiaddr";
import type { Multiaddr } from "@multiformats/multiaddr";
import { convertToString } from "@multiformats/multiaddr/convert";

export function multiaddrFromFields(
  ipFamily: string,
  protocol: string,
  ipBytes: Uint8Array,
  protocolBytes: Uint8Array
): Multiaddr {
  let ma = multiaddr("/" + ipFamily + "/" + convertToString(ipFamily, ipBytes));

  ma = ma.encapsulate(
    multiaddr("/" + protocol + "/" + convertToString(protocol, protocolBytes))
  );

  return ma;
}
