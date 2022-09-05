import { Connection } from "@libp2p/interface-connection";

export function selectConnection(
  connections: Connection[]
): Connection | undefined {
  if (!connections.length) return;
  if (connections.length === 1) return connections[0];

  let latestConnection: Connection | undefined;

  connections.forEach((connection) => {
    if (connection.stat.status === "OPEN") {
      if (!latestConnection) {
        latestConnection = connection;
      } else if (
        connection.stat.timeline.open > latestConnection.stat.timeline.open
      ) {
        latestConnection = connection;
      }
    }
  });

  return latestConnection;
}
