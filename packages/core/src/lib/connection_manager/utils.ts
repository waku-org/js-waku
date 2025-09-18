import { isPeerId, type Peer, type PeerId } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import { Multiaddr, multiaddr, MultiaddrInput } from "@multiformats/multiaddr";
import { Libp2p } from "@waku/interfaces";
import { bytesToUtf8 } from "@waku/utils/bytes";

/**
 * Reads peer's metadata and retrieves ping value.
 * @param peer Peer or null
 * @returns -1 if no ping attached, otherwise returns ping value
 */
export const getPeerPing = (peer: Peer | null): number => {
  if (!peer) {
    return -1;
  }

  try {
    const bytes = peer.metadata.get("ping");

    if (!bytes) {
      return -1;
    }

    return Number(bytesToUtf8(bytes));
  } catch (e) {
    return -1;
  }
};

/**
 * Maps a PeerId or MultiaddrInput to a PeerId or Multiaddr.
 * @param input - The PeerId or MultiaddrInput to map.
 * @returns The PeerId or Multiaddr.
 * @throws {Error} If the input is not a valid PeerId or MultiaddrInput.
 */
export const mapToPeerIdOrMultiaddr = (
  input: PeerId | MultiaddrInput
): PeerId | Multiaddr => {
  return isPeerId(input) ? input : multiaddr(input);
};

/**
 * Maps a PeerId or MultiaddrInput to a PeerId.
 * @param input - The PeerId or MultiaddrInput to map.
 * @returns The PeerId.
 * @throws {Error} If the input is not a valid PeerId or MultiaddrInput.
 */
export const mapToPeerId = (input: PeerId | MultiaddrInput): PeerId => {
  return isPeerId(input)
    ? input
    : peerIdFromString(multiaddr(input).getPeerId()!);
};

/**
 * Checks if the address is supported by the libp2p instance.
 * @param libp2p - The libp2p instance.
 * @param addresses - The addresses to check.
 * @returns True if the addresses are supported, false otherwise.
 */
export const isAddressesSupported = (
  libp2p: Libp2p,
  addresses: Multiaddr[]
): boolean => {
  const transports =
    libp2p?.components?.transportManager?.getTransports() || [];

  if (transports.length === 0) {
    return false;
  }

  return transports
    .map((transport) => transport.dialFilter(addresses))
    .some((supportedAddresses) => supportedAddresses.length > 0);
};
