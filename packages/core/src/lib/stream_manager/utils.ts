import type { Connection } from "@libp2p/interface";

export function selectConnection(
  connections: Connection[]
): Connection | undefined {
  if (!connections.length) return;
  if (connections.length === 1) return connections[0];

  let latestConnection: Connection | undefined;

  connections.forEach((connection) => {
    if (connection.status === "open") {
      if (!latestConnection) {
        latestConnection = connection;
      } else if (connection.timeline.open > latestConnection.timeline.open) {
        latestConnection = connection;
      }
    }
  });

  return latestConnection;
}
