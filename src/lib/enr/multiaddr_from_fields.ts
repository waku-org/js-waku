import { Multiaddr } from "@multiformats/multiaddr";
import { convertToString } from "@multiformats/multiaddr/convert";

export function mulitaddrFromFields(
  ipFamily: string,
  protocol: string,
  ipBytes: Uint8Array,
  protocolBytes: Uint8Array
): Multiaddr {
  let ma = new Multiaddr(
    "/" + ipFamily + "/" + convertToString(ipFamily, ipBytes)
  );

  ma = ma.encapsulate(
    new Multiaddr(
      "/" + protocol + "/" + convertToString(protocol, protocolBytes)
    )
  );

  return ma;
}
