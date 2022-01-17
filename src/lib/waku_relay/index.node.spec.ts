import { expect } from 'chai';
import debug from 'debug';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../../test_utils';
import { delay } from '../delay';
import { DefaultPubSubTopic, Waku } from '../waku';
import { DecryptionMethod, WakuMessage } from '../waku_message';
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from '../waku_message/version_1';

const log = debug('waku:test');

const TestContentTopic = '/test/1/waku-relay/utf8';

describe('Waku Relay [node only]', () => {
  // Node needed as we don't have a way to connect 2 js waku
  // nodes in the browser yet
  describe('2 js nodes', () => {
    afterEach(function () {
      if (this.currentTest?.state === 'failed') {
        console.log(`Test failed, log file name is ${makeLogFileName(this)}`);
      }
    });

    let waku1: Waku;
    let waku2: Waku;
    beforeEach(async function () {
      this.timeout(10000);

      log('Starting JS Waku instances');
      [waku1, waku2] = await Promise.all([
        Waku.create({ staticNoiseKey: NOISE_KEY_1 }),
        Waku.create({
          staticNoiseKey: NOISE_KEY_2,
          libp2p: { addresses: { listen: ['/ip4/0.0.0.0/tcp/0/ws'] } },
        }),
      ]);
      log("Instances started, adding waku2 to waku1's address book");
      waku1.addPeerToAddressBook(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);

      log('Wait for mutual pubsub subscription');
      await Promise.all([
        new Promise((resolve) =>
          waku1.libp2p.pubsub.once('pubsub:subscription-change', () =>
            resolve(null)
          )
        ),
        new Promise((resolve) =>
          waku2.libp2p.pubsub.once('pubsub:subscription-change', () =>
            resolve(null)
          )
        ),
      ]);
      log('before each hook done');
    });

    afterEach(async function () {
      this.timeout(5000);
      await waku1.stop();
      await waku2.stop();
    });

    it('Subscribe', async function () {
      log('Getting subscribers');
      const subscribers1 =
        waku1.libp2p.pubsub.getSubscribers(DefaultPubSubTopic);
      const subscribers2 =
        waku2.libp2p.pubsub.getSubscribers(DefaultPubSubTopic);

      log('Asserting mutual subscription');
      expect(subscribers1).to.contain(waku2.libp2p.peerId.toB58String());
      expect(subscribers2).to.contain(waku1.libp2p.peerId.toB58String());
    });

    it('Register correct protocols', async function () {
      const protocols = Array.from(waku1.libp2p.upgrader.protocols.keys());

      expect(protocols).to.contain('/vac/waku/relay/2.0.0');
      expect(protocols.findIndex((value) => value.match(/sub/))).to.eq(-1);
    });

    it('Publish', async function () {
      this.timeout(10000);

      const messageText = 'JS to JS communication works';
      const messageTimestamp = new Date('1995-12-17T03:24:00');
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic,
        {
          timestamp: messageTimestamp,
        }
      );

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku2.relay.addObserver(resolve);
        }
      );

      await waku1.relay.send(message);

      const receivedMsg = await receivedMsgPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(message.version);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
      expect(receivedMsg.timestamp?.valueOf()).to.eq(
        messageTimestamp.valueOf()
      );
    });

    it('Filter on content topics', async function () {
      this.timeout(10000);

      const fooMessageText = 'Published on content topic foo';
      const barMessageText = 'Published on content topic bar';
      const fooMessage = await WakuMessage.fromUtf8String(
        fooMessageText,
        'foo'
      );
      const barMessage = await WakuMessage.fromUtf8String(
        barMessageText,
        'bar'
      );

      const receivedBarMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku2.relay.addObserver(resolve, ['bar']);
        }
      );

      const allMessages: WakuMessage[] = [];
      waku2.relay.addObserver((wakuMsg) => {
        allMessages.push(wakuMsg);
      });

      await waku1.relay.send(fooMessage);
      await waku1.relay.send(barMessage);

      const receivedBarMsg = await receivedBarMsgPromise;

      expect(receivedBarMsg.contentTopic).to.eq(barMessage.contentTopic);
      expect(receivedBarMsg.version).to.eq(barMessage.version);
      expect(receivedBarMsg.payloadAsUtf8).to.eq(barMessageText);
      expect(allMessages.length).to.eq(2);
      expect(allMessages[0].contentTopic).to.eq(fooMessage.contentTopic);
      expect(allMessages[0].version).to.eq(fooMessage.version);
      expect(allMessages[0].payloadAsUtf8).to.eq(fooMessageText);
      expect(allMessages[1].contentTopic).to.eq(barMessage.contentTopic);
      expect(allMessages[1].version).to.eq(barMessage.version);
      expect(allMessages[1].payloadAsUtf8).to.eq(barMessageText);
    });

    it('Decrypt messages', async function () {
      this.timeout(10000);

      const encryptedAsymmetricMessageText =
        'This message is encrypted using asymmetric';
      const encryptedAsymmetricContentTopic = '/test/1/asymmetric/proto';
      const encryptedSymmetricMessageText =
        'This message is encrypted using symmetric encryption';
      const encryptedSymmetricContentTopic = '/test/1/symmetric/proto';

      const privateKey = generatePrivateKey();
      const symKey = generateSymmetricKey();
      const publicKey = getPublicKey(privateKey);

      const [encryptedAsymmetricMessage, encryptedSymmetricMessage] =
        await Promise.all([
          WakuMessage.fromUtf8String(
            encryptedAsymmetricMessageText,
            encryptedAsymmetricContentTopic,
            {
              encPublicKey: publicKey,
            }
          ),
          WakuMessage.fromUtf8String(
            encryptedSymmetricMessageText,
            encryptedSymmetricContentTopic,
            {
              symKey: symKey,
            }
          ),
        ]);

      waku2.addDecryptionKey(privateKey, {
        contentTopics: [encryptedAsymmetricContentTopic],
        method: DecryptionMethod.Asymmetric,
      });
      waku2.addDecryptionKey(symKey, {
        contentTopics: [encryptedSymmetricContentTopic],
        method: DecryptionMethod.Symmetric,
      });

      const msgs: WakuMessage[] = [];
      waku2.relay.addObserver((wakuMsg) => {
        msgs.push(wakuMsg);
      });

      await waku1.relay.send(encryptedAsymmetricMessage);
      await waku1.relay.send(encryptedSymmetricMessage);

      while (msgs.length < 2) {
        await delay(200);
      }

      expect(msgs.length).to.eq(2);
      expect(msgs[0].contentTopic).to.eq(
        encryptedAsymmetricMessage.contentTopic
      );
      expect(msgs[0].version).to.eq(encryptedAsymmetricMessage.version);
      expect(msgs[0].payloadAsUtf8).to.eq(encryptedAsymmetricMessageText);
      expect(msgs[1].contentTopic).to.eq(
        encryptedSymmetricMessage.contentTopic
      );
      expect(msgs[1].version).to.eq(encryptedSymmetricMessage.version);
      expect(msgs[1].payloadAsUtf8).to.eq(encryptedSymmetricMessageText);
    });

    it('Delete observer', async function () {
      this.timeout(10000);

      const messageText =
        'Published on content topic with added then deleted observer';
      const message = await WakuMessage.fromUtf8String(
        messageText,
        'added-then-deleted-observer'
      );

      // The promise **fails** if we receive a message on this observer.
      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve, reject) => {
          waku2.relay.addObserver(reject, ['added-then-deleted-observer']);
          waku2.relay.deleteObserver(reject, ['added-then-deleted-observer']);
          setTimeout(resolve, 500);
        }
      );
      await waku1.relay.send(message);

      await receivedMsgPromise;
      // If it does not throw then we are good.
    });
  });

  describe('Custom pubsub topic', () => {
    it('Publish', async function () {
      this.timeout(10000);

      const pubSubTopic = '/some/pubsub/topic';

      // 1 and 2 uses a custom pubsub
      const [waku1, waku2, waku3] = await Promise.all([
        Waku.create({
          pubSubTopic: pubSubTopic,
          staticNoiseKey: NOISE_KEY_1,
        }),
        Waku.create({
          pubSubTopic: pubSubTopic,
          staticNoiseKey: NOISE_KEY_2,
          libp2p: { addresses: { listen: ['/ip4/0.0.0.0/tcp/0/ws'] } },
        }),
        Waku.create({
          staticNoiseKey: NOISE_KEY_2,
        }),
      ]);

      waku1.addPeerToAddressBook(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);
      waku3.addPeerToAddressBook(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);

      await Promise.all([
        new Promise((resolve) =>
          waku1.libp2p.pubsub.once('pubsub:subscription-change', () =>
            resolve(null)
          )
        ),
        new Promise((resolve) =>
          waku2.libp2p.pubsub.once('pubsub:subscription-change', () =>
            resolve(null)
          )
        ),
        // No subscription change expected for Waku 3
      ]);

      const messageText = 'Communicating using a custom pubsub topic';
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic
      );

      const waku2ReceivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku2.relay.addObserver(resolve);
        }
      );

      // The promise **fails** if we receive a message on the default
      // pubsub topic.
      const waku3NoMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve, reject) => {
          waku3.relay.addObserver(reject);
          setTimeout(resolve, 1000);
        }
      );

      await waku1.relay.send(message);

      const waku2ReceivedMsg = await waku2ReceivedMsgPromise;
      await waku3NoMsgPromise;

      expect(waku2ReceivedMsg.payloadAsUtf8).to.eq(messageText);
    });
  });

  describe('Interop: Nim', function () {
    describe('Nim connects to js', function () {
      let waku: Waku;
      let nimWaku: NimWaku;

      beforeEach(async function () {
        this.timeout(30_000);

        log('Create waku node');
        waku = await Waku.create({
          staticNoiseKey: NOISE_KEY_1,
          libp2p: {
            addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
            modules: { transport: [TCP] },
          },
        });

        const multiAddrWithId = waku.getLocalMultiaddrWithID();
        nimWaku = new NimWaku(makeLogFileName(this));
        log('Starting nim-waku');
        await nimWaku.start({ staticnode: multiAddrWithId });

        log('Waiting for heartbeat');
        await new Promise((resolve) =>
          waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
        );
      });

      afterEach(async function () {
        this.timeout(5000);
        nimWaku ? nimWaku.stop() : null;
        waku ? await waku.stop() : null;
      });

      it('nim subscribes to js', async function () {
        const nimPeerId = await nimWaku.getPeerId();
        const subscribers =
          waku.libp2p.pubsub.getSubscribers(DefaultPubSubTopic);

        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        this.timeout(5000);

        const messageText = 'This is a message';
        const message = await WakuMessage.fromUtf8String(
          messageText,
          TestContentTopic
        );

        await waku.relay.send(message);

        let msgs: WakuMessage[] = [];

        while (msgs.length === 0) {
          await delay(200);
          msgs = await nimWaku.messages();
        }

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);
        expect(msgs[0].payloadAsUtf8).to.equal(messageText);
      });

      it('Nim publishes to js', async function () {
        this.timeout(5000);
        const messageText = 'Here is another message.';
        const message = await WakuMessage.fromUtf8String(
          messageText,
          TestContentTopic
        );

        const receivedMsgPromise: Promise<WakuMessage> = new Promise(
          (resolve) => {
            waku.relay.addObserver(resolve);
          }
        );

        await nimWaku.sendMessage(message);

        const receivedMsg = await receivedMsgPromise;

        expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
        expect(receivedMsg.version).to.eq(message.version);
        expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
      });
    });

    describe('Js connects to nim', function () {
      let waku: Waku;
      let nimWaku: NimWaku;

      beforeEach(async function () {
        this.timeout(30_000);
        waku = await Waku.create({
          staticNoiseKey: NOISE_KEY_1,
          libp2p: { modules: { transport: [TCP] } },
        });

        nimWaku = new NimWaku(this.test?.ctx?.currentTest?.title + '');
        await nimWaku.start();

        await waku.dial(await nimWaku.getMultiaddrWithId());

        // Wait for identify protocol to finish
        await new Promise((resolve) => {
          waku.libp2p.peerStore.once('change:protocols', resolve);
        });

        // Wait for one heartbeat to ensure mesh is updated
        await new Promise((resolve) => {
          waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve);
        });
      });

      afterEach(async function () {
        nimWaku ? nimWaku.stop() : null;
        waku ? await waku.stop() : null;
      });

      it('nim subscribes to js', async function () {
        let subscribers: string[] = [];

        while (subscribers.length === 0) {
          await delay(200);
          subscribers = waku.libp2p.pubsub.getSubscribers(DefaultPubSubTopic);
        }

        const nimPeerId = await nimWaku.getPeerId();
        expect(subscribers).to.contain(nimPeerId.toB58String());
      });

      it('Js publishes to nim', async function () {
        this.timeout(30000);

        const messageText = 'This is a message';
        const message = await WakuMessage.fromUtf8String(
          messageText,
          TestContentTopic
        );
        await delay(1000);
        await waku.relay.send(message);

        let msgs: WakuMessage[] = [];

        while (msgs.length === 0) {
          console.log('Waiting for messages');
          await delay(200);
          msgs = await nimWaku.messages();
        }

        expect(msgs[0].contentTopic).to.equal(message.contentTopic);
        expect(msgs[0].version).to.equal(message.version);
        expect(msgs[0].payloadAsUtf8).to.equal(messageText);
      });

      it('Nim publishes to js', async function () {
        await delay(200);

        const messageText = 'Here is another message.';
        const message = await WakuMessage.fromUtf8String(
          messageText,
          TestContentTopic
        );

        const receivedMsgPromise: Promise<WakuMessage> = new Promise(
          (resolve) => {
            waku.relay.addObserver(resolve);
          }
        );

        await nimWaku.sendMessage(message);

        const receivedMsg = await receivedMsgPromise;

        expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
        expect(receivedMsg.version).to.eq(message.version);
        expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
      });
    });

    describe.skip('js to nim to js', function () {
      let waku1: Waku;
      let waku2: Waku;
      let nimWaku: NimWaku;

      afterEach(async function () {
        nimWaku ? nimWaku.stop() : null;
        await Promise.all([
          waku1 ? await waku1.stop() : null,
          waku2 ? await waku2.stop() : null,
        ]);
      });

      it('Js publishes, other Js receives', async function () {
        this.timeout(60_000);
        [waku1, waku2] = await Promise.all([
          Waku.create({
            staticNoiseKey: NOISE_KEY_1,
            libp2p: { modules: { transport: [TCP] } },
          }),
          Waku.create({
            staticNoiseKey: NOISE_KEY_2,
            libp2p: { modules: { transport: [TCP] } },
          }),
        ]);

        nimWaku = new NimWaku(makeLogFileName(this));
        await nimWaku.start();

        const nimWakuMultiaddr = await nimWaku.getMultiaddrWithId();
        await Promise.all([
          waku1.dial(nimWakuMultiaddr),
          waku2.dial(nimWakuMultiaddr),
        ]);

        // Wait for identify protocol to finish
        await Promise.all([
          new Promise((resolve) =>
            waku1.libp2p.peerStore.once('change:protocols', resolve)
          ),
          new Promise((resolve) =>
            waku2.libp2p.peerStore.once('change:protocols', resolve)
          ),
        ]);

        await Promise.all([
          new Promise((resolve) =>
            waku1.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
          new Promise((resolve) =>
            waku2.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
          ),
        ]);

        await delay(2000);
        // Check that the two JS peers are NOT directly connected
        expect(
          waku1.libp2p.peerStore.peers.has(waku2.libp2p.peerId.toB58String())
        ).to.be.false;
        expect(
          waku2.libp2p.peerStore.peers.has(waku1.libp2p.peerId.toB58String())
        ).to.be.false;

        const msgStr = 'Hello there!';
        const message = await WakuMessage.fromUtf8String(
          msgStr,
          TestContentTopic
        );

        const waku2ReceivedMsgPromise: Promise<WakuMessage> = new Promise(
          (resolve) => {
            waku2.relay.addObserver(resolve);
          }
        );

        await waku1.relay.send(message);
        console.log('Waiting for message');
        const waku2ReceivedMsg = await waku2ReceivedMsgPromise;

        expect(waku2ReceivedMsg.payloadAsUtf8).to.eq(msgStr);
      });
    });
  });
});
