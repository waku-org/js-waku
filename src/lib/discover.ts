/**
 * Returns multiaddrs (inc. ip) of nim-waku nodes ran by Status.
 * Used as a temporary discovery helper until more parties run their own nodes.
 */
import axios from 'axios';

export enum Protocol {
  websocket = 'websocket',
  tcp = 'tcp',
}

export enum Environment {
  Test = 'test',
  Prod = 'prod',
}

export async function getStatusFleetNodes(
  env: Environment = Environment.Prod,
  protocol: Protocol = Protocol.websocket
): Promise<string[]> {
  const res = await axios.get('https://fleets.status.im/', {
    headers: { 'Content-Type': 'application/json' },
  });

  const wakuFleet = res.data.fleets[`wakuv2.${env}`];

  switch (protocol) {
    case Protocol.tcp:
      return Object.values(wakuFleet['waku']);
    default:
      return Object.values(wakuFleet['waku-websocket']);
  }
}
