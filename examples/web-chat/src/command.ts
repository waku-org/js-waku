import { multiaddr } from "multiaddr";
import PeerId from "peer-id";
import { Waku } from "js-waku";

function help(): string[] {
  return [
    "/nick <nickname>: set a new nickname",
    "/info: some information about the node",
    "/connect <Multiaddr>: connect to the given peer",
    "/help: Display this help",
  ];
}

function nick(
  nick: string | undefined,
  setNick: (nick: string) => void
): string[] {
  if (!nick) {
    return ["No nick provided"];
  }
  setNick(nick);
  return [`New nick: ${nick}`];
}

function info(waku: Waku | undefined): string[] {
  if (!waku) {
    return ["Waku node is starting"];
  }
  return [`PeerId: ${waku.libp2p.peerId.toB58String()}`];
}

function connect(peer: string | undefined, waku: Waku | undefined): string[] {
  if (!waku) {
    return ["Waku node is starting"];
  }
  if (!peer) {
    return ["No peer provided"];
  }
  try {
    const peerMultiaddr = multiaddr(peer);
    const peerId = peerMultiaddr.getPeerId();
    if (!peerId) {
      return ["Peer Id needed to dial"];
    }
    waku.addPeerToAddressBook(PeerId.createFromB58String(peerId), [
      peerMultiaddr,
    ]);
    return [
      `${peerId}: ${peerMultiaddr.toString()} added to address book, autodial in progress`,
    ];
  } catch (e) {
    return ["Invalid multiaddr: " + e];
  }
}

async function peers(waku: Waku | undefined): Promise<string[]> {
  if (!waku) {
    return ["Waku node is starting"];
  }
  let response: string[] = [];
  const peers = [];

  for await (const peer of waku.libp2p.peerStore.getPeers()) {
    peers.push(peer);
  }
  Array.from(peers).forEach((peer) => {
    response.push(peer.id.toB58String() + ":");
    let addresses = "  addresses: [";
    peer.addresses.forEach(({ multiaddr }) => {
      addresses += " " + multiaddr.toString() + ",";
    });
    addresses = addresses.replace(/,$/, "");
    addresses += "]";
    response.push(addresses);
    let protocols = "  protocols: [";
    protocols += peer.protocols;
    protocols += "]";
    response.push(protocols);
  });
  if (response.length === 0) {
    response.push("Not connected to any peer.");
  }
  return response;
}

function connections(waku: Waku | undefined): string[] {
  if (!waku) {
    return ["Waku node is starting"];
  }
  let response: string[] = [];
  waku.libp2p.connections.forEach(
    (
      connections: import("libp2p-interfaces/src/connection/connection")[],
      peerId
    ) => {
      response.push(peerId + ":");
      let strConnections = "  connections: [";
      connections.forEach((connection) => {
        strConnections += JSON.stringify(connection.stat);
        strConnections += "; " + JSON.stringify(connection.streams);
      });
      strConnections += "]";
      response.push(strConnections);
    }
  );
  if (response.length === 0) {
    response.push("Not connected to any peer.");
  }
  return response;
}

export default async function handleCommand(
  input: string,
  waku: Waku | undefined,
  setNick: (nick: string) => void
): Promise<{ command: string; response: string[] }> {
  let response: string[] = [];
  const args = parseInput(input);
  const command = args.shift()!;
  switch (command) {
    case "/help":
      help().map((str) => response.push(str));
      break;
    case "/nick":
      nick(args.shift(), setNick).map((str) => response.push(str));
      break;
    case "/info":
      info(waku).map((str) => response.push(str));
      break;
    case "/connect":
      connect(args.shift(), waku).map((str) => response.push(str));
      break;
    case "/peers":
      (await peers(waku)).map((str) => response.push(str));
      break;
    case "/connections":
      connections(waku).map((str) => response.push(str));
      break;
    default:
      response.push(`Unknown Command '${command}'`);
  }
  return { command, response };
}

export function parseInput(input: string): string[] {
  const clean = input.trim().replaceAll(/\s\s+/g, " ");
  return clean.split(" ");
}
