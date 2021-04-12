import { expect } from 'chai';
import Pubsub from 'libp2p-interfaces/src/pubsub';

import { NOISE_KEY_1, NOISE_KEY_2 } from '../../test_utils/constants';
import { delay } from '../../test_utils/delay';
import { makeLogFileName } from '../../test_utils/log_file';
import { NimWaku } from '../../test_utils/nim_waku';
import Waku from '../waku';
import { WakuMessage } from '../waku_message';

import { RelayCodec, RelayDefaultTopic } from './index';

describe('Waku Relay', () => {
  afterEach(function () {
    if (this.currentTest!.state === 'failed') {
      console.log(`Test failed, log file name is ${makeLogFileName(this)}`);
    }
  });

  let waku1: Waku;
  let waku2: Waku;
  beforeEach(async function () {
    [waku1, waku2] = await Promise.all([
      Waku.create({ staticNoiseKey: NOISE_KEY_1 }),
      Waku.create({ staticNoiseKey: NOISE_KEY_2 }),
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
        waku1.libp2p.pubsub.once(
          'pubsub:subscription-change',
          (...args: any[]) => resolve(args)
        )
      ),
      new Promise((resolve) =>
        waku2.libp2p.pubsub.once(
          'pubsub:subscription-change',
          (...args: any[]) => resolve(args)
        )
      ),
    ]);
  });

  afterEach(async function () {
    await waku1.stop();
    await waku2.stop();
  });

  it('Subscribe', async function () {
    const subscribers1 = waku1.libp2p.pubsub.getSubscribers(RelayDefaultTopic);
    const subscribers2 = waku2.libp2p.pubsub.getSubscribers(RelayDefaultTopic);

    expect(subscribers1).to.contain(waku2.libp2p.peerId.toB58String());
    expect(subscribers2).to.contain(waku1.libp2p.peerId.toB58String());
  });

  it('Register correct protocols', async function () {
    const protocols = Array.from(waku1.libp2p.upgrader.protocols.keys());

    expect(protocols).to.contain(RelayCodec);
    expect(protocols.findIndex((value) => value.match(/sub/))).to.eq(-1);
  });

  it('Publish', async function () {
    this.timeout(10000);

    const message = WakuMessage.fromUtf8String('JS to JS communication works');

    const receivedPromise = waitForNextData(waku2.libp2p.pubsub);

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
        this.timeout(12_000);
        waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });

        const multiAddrWithId = waku.getLocalMultiaddrWithID();
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
        const subscribers = waku.libp2p.pubsub.getSubscribers(
          RelayDefaultTopic
        );

        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        this.timeout(5000);

        const message = WakuMessage.fromUtf8String('This is a message');

        await waku.relay.publish(message);

        let msgs = [];

        while (msgs.length === 0) {
          await delay(200);
          msgs = await nimWaku.messages();
        }

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);

        const payload = Buffer.from(msgs[0].payload);
        expect(Buffer.compare(payload, message.payload!)).to.equal(0);
      });

      it('Nim publishes to js', async function () {
        this.timeout(5000);
        const message = WakuMessage.fromUtf8String('Here is another message.');

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
        waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });

        nimWaku = new NimWaku(this.test!.ctx!.currentTest!.title);
        await nimWaku.start();

        await waku.dial(await nimWaku.getMultiaddrWithId());

        await delay(100);
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
        const subscribers = waku.libp2p.pubsub.getSubscribers(
          RelayDefaultTopic
        );

        const nimPeerId = await nimWaku.getPeerId();
        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        const message = WakuMessage.fromUtf8String('This is a message');

        await waku.relay.publish(message);

        let msgs = [];

        while (msgs.length === 0) {
          await delay(200);
          msgs = await nimWaku.messages();
        }

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);

        const payload = Buffer.from(msgs[0].payload);
        expect(Buffer.compare(payload, message.payload!)).to.equal(0);
      });

      it('Nim publishes to js', async function () {
        const message = WakuMessage.fromUtf8String('Here is another message.');

        const receivedPromise = waitForNextData(waku.libp2p.pubsub);

        await nimWaku.sendMessage(message);

        const receivedMsg = await receivedPromise;

        expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
        expect(receivedMsg.version).to.eq(message.version);

        const payload = Buffer.from(receivedMsg.payload!);
        expect(Buffer.compare(payload, message.payload!)).to.eq(0);
      });
    });

    describe('js to nim to js', function () {
      let waku1: Waku;
      let waku2: Waku;
      let nimWaku: NimWaku;

      beforeEach(async function () {
        this.timeout(10_000);
        [waku1, waku2] = await Promise.all([
          Waku.create({ staticNoiseKey: NOISE_KEY_1 }),
          Waku.create({ staticNoiseKey: NOISE_KEY_2 }),
        ]);

        nimWaku = new NimWaku(this.test!.ctx!.currentTest!.title);
        await nimWaku.start();

        const nimWakuMultiaddr = await nimWaku.getMultiaddrWithId();
        await Promise.all([
          waku1.dial(nimWakuMultiaddr),
          waku2.dial(nimWakuMultiaddr),
        ]);

        await delay(100);
        await Promise.all([
          new Promise((resolve) =>
            waku1.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
          new Promise((resolve) =>
            waku2.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
        ]);

        await Promise.all([waku1.relay.subscribe(), waku2.relay.subscribe()]);

        await Promise.all([
          new Promise((resolve) =>
            waku1.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
          new Promise((resolve) =>
            waku2.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
        ]);
      });

      afterEach(async function () {
        nimWaku ? nimWaku.stop() : null;
        await Promise.all([
          waku1 ? await waku1.stop() : null,
          waku2 ? await waku2.stop() : null,
        ]);
      });

      it('Js publishes, other Js receives', async function () {
        // Check that the two JS peers are NOT directly connected
        expect(
          waku1.libp2p.peerStore.peers.has(waku2.libp2p.peerId.toB58String())
        ).to.be.false;
        expect(
          waku2.libp2p.peerStore.peers.has(waku1.libp2p.peerId.toB58String())
        ).to.be.false;

        const msgStr = 'Hello there!';
        const message = WakuMessage.fromUtf8String(msgStr);

        const waku2ReceivedPromise = waitForNextData(waku2.libp2p.pubsub);

        await waku1.relay.publish(message);

        const waku2ReceivedMsg = await waku2ReceivedPromise;

        expect(waku2ReceivedMsg.utf8Payload()).to.eq(msgStr);
      });
    });
  });
});

function waitForNextData(pubsub: Pubsub): Promise<WakuMessage> {
  return new Promise((resolve) => {
    pubsub.once(RelayDefaultTopic, resolve);
  }).then((msg: any) => {
    return WakuMessage.decode(msg.data);
  });
}
