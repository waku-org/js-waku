import test from 'ava';
import Pubsub from 'libp2p-interfaces/src/pubsub';

import { delay } from '../test_utils/delay';
import { NimWaku } from '../test_utils/nim_waku';

import { createNode } from './node';
import { Message } from './waku_message';
import { CODEC, TOPIC, WakuRelay } from './waku_relay';

test('Can publish message', async (t) => {
  const message = Message.fromString('Bird bird bird, bird is the word!');

  const [node1, node2] = await Promise.all([createNode(), createNode()]);
  const wakuRelayNode1 = new WakuRelay(node1.pubsub);
  const wakuRelayNode2 = new WakuRelay(node2.pubsub);

  // Add node's 2 data to the PeerStore
  node1.peerStore.addressBook.set(node2.peerId, node2.multiaddrs);
  await node1.dial(node2.peerId);

  await wakuRelayNode1.subscribe();
  await wakuRelayNode2.subscribe();

  // Setup the promise before publishing to ensure the event is not missed
  const promise = waitForNextData(node1.pubsub);

  await delay(500);

  await wakuRelayNode2.publish(message);

  const node1Received = await promise;

  t.true(node1Received.isEqualTo(message));
});

test('Register waku relay protocol', async (t) => {
  const node = await createNode();

  const protocols = Array.from(node.upgrader.protocols.keys());

  t.truthy(protocols.findIndex((value) => value == CODEC));
});

test('Does not register any sub protocol', async (t) => {
  const node = await createNode();

  const protocols = Array.from(node.upgrader.protocols.keys());
  t.truthy(protocols.findIndex((value) => value.match(/sub/)));
});

test('Nim-waku: nim-waku node connects to js node', async (t) => {
  const node = await createNode();

  const peerId = node.peerId.toB58String();

  const localMultiaddr = node.multiaddrs.find((addr) =>
    addr.toString().match(/127\.0\.0\.1/)
  );
  const multiAddrWithId = localMultiaddr + '/p2p/' + peerId;

  const nimWaku = new NimWaku();
  await nimWaku.start({ staticnode: multiAddrWithId });

  const nimPeers = await nimWaku.peers();

  t.deepEqual(nimPeers, [
    {
      multiaddr: multiAddrWithId,
      protocol: CODEC,
      connected: true,
    },
  ]);

  const nimAddress = await nimWaku.info().then((info) => info.listenStr);
  const nimPeerId = nimAddress.match(/[\d\w]+$/)[0];
  const jsPeers = node.peerStore.peers;

  t.true(jsPeers.has(nimPeerId));
});

function waitForNextData(pubsub: Pubsub): Promise<Message> {
  return new Promise((resolve) => {
    pubsub.once(TOPIC, resolve);
  }).then((msg: any) => {
    return Message.fromBinary(msg.data);
  });
}
