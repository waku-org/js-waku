import { Multiaddr } from "@multiformats/multiaddr";

export function mulitaddrFromFields(
  isIpv6: boolean,
  protocol: string,
  ipBytes: Uint8Array,
  portBytes: Uint8Array
): Multiaddr {
  const familyStr = isIpv6 ? "ip6" : "ip4";
  let ma = new Multiaddr("/" + familyStr);

  ma = ma.encapsulate(new Multiaddr(ipBytes));
  ma = ma.encapsulate(new Multiaddr("/" + protocol));
  ma = ma.encapsulate(portBytes);

  return ma;
}
