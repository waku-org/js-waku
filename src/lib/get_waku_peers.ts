import { shuffle } from 'libp2p-gossipsub/src/utils';

import { CODEC, WakuRelayPubsub } from './waku_relay';

/**
 * Given a topic, returns up to count peers subscribed to that topic
 * that pass an optional filter function
 *
 * @param {Gossipsub} router
 * @param {String} topic
 * @param {Number} count
 * @param {Function} [filter] a function to filter acceptable peers
 * @returns {Set<string>}
 *
 */
export function getWakuPeers(
  router: WakuRelayPubsub,
  topic: string,
  count: number,
  filter: (id: string) => boolean = () => true
): Set<string> {
  const peersInTopic = router.topics.get(topic);
  if (!peersInTopic) {
    return new Set();
  }

  // Adds all peers using our protocol
  // that also pass the filter function
  let peers: string[] = [];
  peersInTopic.forEach((id) => {
    const peerStreams = router.peers.get(id);
    if (!peerStreams) {
      return;
    }
    if (peerStreams.protocol == CODEC && filter(id)) {
      peers.push(id);
    }
  });

  // Pseudo-randomly shuffles peers
  peers = shuffle(peers);
  if (count > 0 && peers.length > count) {
    peers = peers.slice(0, count);
  }

  return new Set(peers);
}
