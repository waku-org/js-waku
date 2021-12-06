import { Address } from 'libp2p/src/peer-store/address-book';
import PeerId from 'peer-id';

export interface Peer {
  /**
   * peer's peer-id instance.
   */
  id: PeerId;
  /**
   * peer's addresses containing its multiaddrs and metadata.
   */
  addresses: Address[];
  /**
   * peer's supported protocols.
   */
  protocols: string[];
  /**
   * peer's metadata map.
   */
  metadata: Map<string, Uint8Array> | undefined;
}
