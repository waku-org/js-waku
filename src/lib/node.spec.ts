import { TextDecoder, TextEncoder } from 'util';

import test from 'ava';
import Pubsub from 'libp2p-interfaces/src/pubsub';

import { createNode } from './node';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Can publish message', async (t) => {
  const topic = 'news';
  const message = 'Bird bird bird, bird is the word!';

  const [node1, node2] = await Promise.all([createNode(), createNode()]);

  // Add node's 2 data to the PeerStore
  node1.peerStore.addressBook.set(node2.peerId, node2.multiaddrs);
  await node1.dial(node2.peerId);
  await node1.pubsub.subscribe(topic);
  await node2.pubsub.subscribe(topic);

  // Setup the promise before publishing to ensure the event is not missed
  // TODO: Is it possible to import `Message` type?
  const promise = waitForNextData(node1.pubsub, topic).then((msg: any) => {
    return new TextDecoder().decode(msg.data);
  });

  await delay(500);

  await node2.pubsub.publish(topic, new TextEncoder().encode(message));

  const node1Received = await promise;

  t.deepEqual(node1Received, message);
});

function waitForNextData(pubsub: Pubsub, topic: string) {
  return new Promise((resolve) => {
    pubsub.once(topic, resolve);
  });
}
