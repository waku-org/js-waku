import { expect } from 'chai';
import Libp2p from 'libp2p';
import Pubsub from 'libp2p-interfaces/src/pubsub';

import { NimWaku } from '../test_utils/nim_waku';

import Waku from './waku';
import { Message } from './waku_message';
import { CODEC, TOPIC } from './waku_relay';

describe('Waku Relay', () => {
  // TODO: Fix this, see https://github.com/ChainSafe/js-libp2p-gossipsub/issues/151
  it.skip('Publish', async () => {
    const message = Message.fromUtf8String('Bird bird bird, bird is the word!');

    const [waku1, waku2] = await Promise.all([Waku.create(), Waku.create()]);

    // Add node's 2 data to the PeerStore
    waku1.libp2p.peerStore.addressBook.set(
      waku2.libp2p.peerId,
      waku2.libp2p.multiaddrs
    );
    await waku1.libp2p.dial(waku2.libp2p.peerId);

    await waku2.relay.subscribe();
    await new Promise((resolve) =>
      waku2.libp2p.pubsub.once('pubsub:subscription-change', (...args) =>
        resolve(args)
      )
    );

    // Setup the promise before publishing to ensure the event is not missed
    const promise = waitForNextData(waku1.libp2p.pubsub);

    await waku2.relay.publish(message);

    const node1Received = await promise;

    expect(node1Received.isEqualTo(message)).to.be.true;

    await Promise.all([waku1.stop(), waku2.stop()]);
  });

  it('Registers waku relay protocol', async () => {
    const waku = await Waku.create();

    const protocols = Array.from(waku.libp2p.upgrader.protocols.keys());

    expect(protocols.findIndex((value) => value == CODEC)).to.be.true;

    await waku.stop();
  });

  it('Does not register any sub protocol', async () => {
    const waku = await Waku.create();

    const protocols = Array.from(waku.libp2p.upgrader.protocols.keys());
    expect(protocols.findIndex((value) => value.match(/sub/))).to.be.true;

    await waku.stop();
  });

  describe('Interop: Nim', () => {
    let waku: Waku;
    let nimWaku: NimWaku;

    beforeEach(async () => {
      waku = await Waku.create();

      const peerId = waku.libp2p.peerId.toB58String();
      const localMultiaddr = waku.libp2p.multiaddrs.find((addr) =>
        addr.toString().match(/127\.0\.0\.1/)
      );
      const multiAddrWithId = localMultiaddr + '/p2p/' + peerId;

      console.log(this);
      nimWaku = new NimWaku('foo');
      await nimWaku.start({ staticnode: multiAddrWithId });
    });

    afterEach(async () => {
      nimWaku ? nimWaku.stop() : null;
      waku ? await waku.stop() : null;
    });

    it('nim subscribes to js', async () => {
      const nimPeerId = await nimWaku.getPeerId();
      const subscribers = waku.libp2p.pubsub.getSubscribers(TOPIC);

      expect(subscribers).to.contain(nimPeerId.toB58String());
    });

    it('Js publishes to nim', async () => {
      const message = Message.fromUtf8String('This is a message');
      // TODO: nim-waku does follow the `StrictNoSign` policy hence we need to change
      // it for nim-waku to process our messages. Can be removed once
      // https://github.com/status-im/nim-waku/issues/422 is fixed
      waku.libp2p.pubsub.globalSignaturePolicy = 'StrictSign';

      await patchPeerStore(nimWaku, waku.libp2p);

      await waku.relay.publish(message);

      await nimWaku.waitForLog('WakuMessage received');

      const msgs = await nimWaku.messages();

      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(msgs[0].version).to.equal(message.version);

      const payload = Buffer.from(msgs[0].payload);
      expect(Buffer.compare(payload, message.payload!)).to.equal(0);
    });

    it('Nim publishes to js', async () => {
      const message = Message.fromUtf8String('Here is another message.');

      await patchPeerStore(nimWaku, waku.libp2p);

      await waku.relay.subscribe();

      await new Promise((resolve) =>
        waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      );

      const receivedPromise = waitForNextData(waku.libp2p.pubsub);

      await nimWaku.sendMessage(message);

      const receivedMsg = await receivedPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(message.version);

      const payload = Buffer.from(receivedMsg.payload!);
      expect(Buffer.compare(payload, message.payload!)).to.eq(0);
    });
  });
});

function waitForNextData(pubsub: Pubsub): Promise<Message> {
  return new Promise((resolve) => {
    pubsub.once(TOPIC, resolve);
  }).then((msg: any) => {
    return Message.fromBinary(msg.data);
  });
}

// TODO: Remove this hack, tracked with https://github.com/status-im/nim-waku/issues/419
async function patchPeerStore(nimWaku: NimWaku, node: Libp2p) {
  const nimPeerId = await nimWaku.getPeerId();
  node.identifyService!.peerStore.protoBook.set(nimPeerId, [CODEC]);
  const peer = node.peerStore.peers.get(nimPeerId.toB58String());
  if (!peer) {
    throw 'Did not find nim-waku node in peers';
  }
  peer.protocols = [CODEC];
  node.peerStore.peers.set(nimPeerId.toB58String(), peer);

  await new Promise((resolve) =>
    node.pubsub.once('gossipsub:heartbeat', resolve)
  );
}
