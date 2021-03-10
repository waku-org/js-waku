import { TextDecoder, TextEncoder } from 'util';

import test from 'ava';

import { createNode } from './node';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Can publish message', async (t) => {
  const topic = 'news';

  const [node1, node2] = await Promise.all([createNode(), createNode()]);

  // Add node's 2 data to the PeerStore
  node1.peerStore.addressBook.set(node2.peerId, node2.multiaddrs);
  await node1.dial(node2.peerId);

  let node1Received = '';

  node1.pubsub.on(topic, (msg) => {
    node1Received = new TextDecoder().decode(msg.data);
    console.log(`node1 received: ${node1Received}`);
  });

  await node1.pubsub.subscribe(topic);

  // Will not receive own published messages by default
  node2.pubsub.on(topic, (msg) => {
    console.log(`node2 received: ${new TextDecoder().decode(msg.data)}`);
  });

  await node2.pubsub.subscribe(topic);

  const message = 'Bird bird bird, bird is the word!';

  await delay(1000);

  await node2.pubsub.publish(topic, new TextEncoder().encode(message));

  await delay(1000);

  t.deepEqual(node1Received, message);
});
