import { expect } from 'chai';
import Pubsub from 'libp2p-interfaces/src/pubsub';

import { NOISE_KEY_1, NOISE_KEY_2 } from '../test_utils/constants';
import { makeLogFileName } from '../test_utils/log_file';
import { NimWaku } from '../test_utils/nim_waku';

import Waku from './waku';
import { Message } from './waku_message';
import { CODEC, TOPIC } from './waku_relay';

describe('Waku Relay', () => {
  let waku1: Waku;
  let waku2: Waku;
  beforeEach(async function () {
    [waku1, waku2] = await Promise.all([
      Waku.create(NOISE_KEY_1),
      Waku.create(NOISE_KEY_2),
    ]);

    await waku1.dialWithMultiAddr(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);

    await Promise.all([
      new Promise((resolve) =>
        waku1.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      ),
      new Promise((resolve) =>
        waku2.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      ),
    ]);

    await waku1.relay.subscribe();
    await waku2.relay.subscribe();

    await Promise.all([
      new Promise((resolve) =>
        waku1.libp2p.pubsub.once('pubsub:subscription-change', (...args) =>
          resolve(args)
        )
      ),
      new Promise((resolve) =>
        waku2.libp2p.pubsub.once('pubsub:subscription-change', (...args) =>
          resolve(args)
        )
      ),
    ]);
  });

  afterEach(async function () {
    await waku1.stop();
    await waku2.stop();
  });

  it('Subscribe', async function () {
    const subscribers1 = waku1.libp2p.pubsub.getSubscribers(TOPIC);
    const subscribers2 = waku2.libp2p.pubsub.getSubscribers(TOPIC);

    expect(subscribers1).to.contain(waku2.libp2p.peerId.toB58String());
    expect(subscribers2).to.contain(waku1.libp2p.peerId.toB58String());
  });

  it('Register correct protocols', async function () {
    const protocols = Array.from(waku1.libp2p.upgrader.protocols.keys());

    expect(protocols).to.contain(CODEC);
    expect(protocols.findIndex((value) => value.match(/sub/))).to.eq(-1);
  });

  // TODO: Fix this
  it.skip('Publish', async function () {
    this.timeout(10000);

    const message = Message.fromUtf8String('JS to JS communication works');
    // waku.libp2p.pubsub.globalSignaturePolicy = 'StrictSign';

    const receivedPromise = waitForNextData(waku2.libp2p.pubsub);

    await Promise.all([
      new Promise((resolve) =>
        waku1.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      ),
      new Promise((resolve) =>
        waku2.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      ),
    ]);

    await waku1.relay.publish(message);

    const receivedMsg = await receivedPromise;

    expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
    expect(receivedMsg.version).to.eq(message.version);

    const payload = Buffer.from(receivedMsg.payload!);
    expect(Buffer.compare(payload, message.payload!)).to.eq(0);
  });

  describe('Interop: Nim', function () {
    describe('Nim connects to js', function () {
      let waku: Waku;
      let nimWaku: NimWaku;

      beforeEach(async function () {
        this.timeout(10_000);
        waku = await Waku.create(NOISE_KEY_1);

        const peerId = waku.libp2p.peerId.toB58String();
        const localMultiaddr = waku.libp2p.multiaddrs.find((addr) =>
          addr.toString().match(/127\.0\.0\.1/)
        );
        const multiAddrWithId = localMultiaddr + '/p2p/' + peerId;

        nimWaku = new NimWaku(makeLogFileName(this));
        await nimWaku.start({ staticnode: multiAddrWithId });

        await waku.relay.subscribe();
        await new Promise((resolve) =>
          waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
        );
      });

      afterEach(async function () {
        nimWaku ? nimWaku.stop() : null;
        waku ? await waku.stop() : null;
      });

      it('nim subscribes to js', async function () {
        const nimPeerId = await nimWaku.getPeerId();
        const subscribers = waku.libp2p.pubsub.getSubscribers(TOPIC);

        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        this.timeout(5000);

        const message = Message.fromUtf8String('This is a message');

        await waku.relay.publish(message);

        await nimWaku.waitForLog('WakuMessage received');

        const msgs = await nimWaku.messages();

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);

        const payload = Buffer.from(msgs[0].payload);
        expect(Buffer.compare(payload, message.payload!)).to.equal(0);
      });

      it('Nim publishes to js', async function () {
        this.timeout(5000);
        const message = Message.fromUtf8String('Here is another message.');

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

    describe('Js connects to nim', function () {
      let waku: Waku;
      let nimWaku: NimWaku;

      beforeEach(async function () {
        this.timeout(10_000);
        waku = await Waku.create(NOISE_KEY_1);

        nimWaku = new NimWaku(makeLogFileName(this));
        await nimWaku.start();

        const nimPeerId = await nimWaku.getPeerId();

        await waku.dialWithMultiAddr(nimPeerId, [nimWaku.multiaddr]);

        await new Promise((resolve) =>
          waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
        );

        await waku.relay.subscribe();

        await new Promise((resolve) =>
          waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
        );
      });

      afterEach(async function () {
        nimWaku ? nimWaku.stop() : null;
        waku ? await waku.stop() : null;
      });

      it('nim subscribes to js', async function () {
        const subscribers = waku.libp2p.pubsub.getSubscribers(TOPIC);

        const nimPeerId = await nimWaku.getPeerId();
        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        const message = Message.fromUtf8String('This is a message');

        await waku.relay.publish(message);

        await nimWaku.waitForLog('WakuMessage received');

        const msgs = await nimWaku.messages();

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);

        const payload = Buffer.from(msgs[0].payload);
        expect(Buffer.compare(payload, message.payload!)).to.equal(0);
      });

      it('Nim publishes to js', async function () {
        const message = Message.fromUtf8String('Here is another message.');

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
});

function waitForNextData(pubsub: Pubsub): Promise<Message> {
  return new Promise((resolve) => {
    pubsub.once(TOPIC, resolve);
  }).then((msg: any) => {
    return Message.fromBinary(msg.data);
  });
}
