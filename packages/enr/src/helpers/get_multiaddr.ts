import { Multiaddr } from "@multiformats/multiaddr";
import type { IEnr } from "@waku/interfaces";

import { multiaddrFromFields } from "./multiaddr_from_fields";

export function locationMultiaddrFromEnrFields(
  enr: IEnr,
  protocol: "udp" | "udp4" | "udp6" | "tcp" | "tcp4" | "tcp6"
): Multiaddr | undefined {
  switch (protocol) {
    case "udp":
      return (
        locationMultiaddrFromEnrFields(enr, "udp4") ||
        locationMultiaddrFromEnrFields(enr, "udp6")
      );
    case "tcp":
      return (
        locationMultiaddrFromEnrFields(enr, "tcp4") ||
        locationMultiaddrFromEnrFields(enr, "tcp6")
      );
  }
  const isIpv6 = protocol.endsWith("6");
  const ipVal = enr.get(isIpv6 ? "ip6" : "ip");
  if (!ipVal) return;

  const protoName = protocol.slice(0, 3);
  let protoVal;
  switch (protoName) {
    case "udp":
      protoVal = isIpv6 ? enr.get("udp6") : enr.get("udp");
      break;
    case "tcp":
      protoVal = isIpv6 ? enr.get("tcp6") : enr.get("tcp");
      break;
    default:
      return;
  }

  if (!protoVal) return;

  return multiaddrFromFields(
    isIpv6 ? "ip6" : "ip4",
    protoName,
    ipVal,
    protoVal
  );
}
