import type { Connection } from "@libp2p/interface";

export function selectOpenConnection(
  connections: Connection[]
): Connection | undefined {
  return connections
    .filter((c) => c.status === "open")
    .sort((left, right) => right.timeline.open - left.timeline.open)
    .at(0);
}
