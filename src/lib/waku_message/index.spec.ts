import { expect } from 'chai';
import debug from 'debug';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';

import {
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  WakuRelayMessage,
} from '../../test_utils';
import { delay } from '../delay';
import { hexToBuf } from '../utils';
import { Waku } from '../waku';

import { generatePrivateKey, getPublicKey } from './version_1';

import { DefaultContentTopic, WakuMessage } from './index';

const dbg = debug('waku:test:message');

describe('Waku Message: Node only', function () {
  describe('Interop: Nim', function () {
    let waku: Waku;
    let nimWaku: NimWaku;

    beforeEach(async function () {
      this.timeout(30_000);

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
          modules: { transport: [TCP] },
        },
      });

      const multiAddrWithId = waku.getLocalMultiaddrWithID();
      nimWaku = new NimWaku(makeLogFileName(this));
      await nimWaku.start({ staticnode: multiAddrWithId, rpcPrivate: true });

      await new Promise((resolve) =>
        waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
      );
    });

    afterEach(async function () {
      nimWaku ? nimWaku.stop() : null;
      waku ? await waku.stop() : null;
    });

    it('JS decrypts nim message [asymmetric, no signature]', async function () {
      this.timeout(10000);
      await delay(200);

      const messageText = 'Here is an encrypted message.';
      const message: WakuRelayMessage = {
        contentTopic: DefaultContentTopic,
        payload: Buffer.from(messageText, 'utf-8').toString('hex'),
      };

      const privateKey = generatePrivateKey();

      waku.relay.addDecryptionKey(privateKey);

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku.relay.addObserver(resolve);
        }
      );

      const publicKey = getPublicKey(privateKey);
      dbg('Post message');
      await nimWaku.postAsymmetricMessage(message, publicKey);

      const receivedMsg = await receivedMsgPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it('Js encrypts message for nim [asymmetric, no signature]', async function () {
      this.timeout(5000);

      const keyPair = await nimWaku.getAsymmetricKeyPair();
      const privateKey = hexToBuf(keyPair.privateKey);
      const publicKey = hexToBuf(keyPair.publicKey);

      const messageText = 'This is a message I am going to encrypt';
      const message = await WakuMessage.fromUtf8String(messageText, {
        encPublicKey: publicKey,
      });

      await waku.relay.send(message);

      let msgs: WakuRelayMessage[] = [];

      while (msgs.length === 0) {
        await delay(200);
        msgs = await nimWaku.getAsymmetricMessages(privateKey);
      }

      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(hexToBuf(msgs[0].payload).toString('utf-8')).to.equal(messageText);
    });

    it('JS decrypts nim message [symmetric, no signature]', async function () {
      this.timeout(10000);
      await delay(200);

      const messageText = 'Here is a message encrypted in a symmetric manner.';
      const message: WakuRelayMessage = {
        contentTopic: DefaultContentTopic,
        payload: Buffer.from(messageText, 'utf-8').toString('hex'),
      };

      const symKey = generatePrivateKey();

      waku.relay.addDecryptionKey(symKey);

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku.relay.addObserver(resolve);
        }
      );

      dbg('Post message');
      await nimWaku.postSymmetricMessage(message, symKey);

      const receivedMsg = await receivedMsgPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it('Js encrypts message for nim [symmetric, no signature]', async function () {
      this.timeout(5000);

      const symKey = await nimWaku.getSymmetricKey();

      const messageText =
        'This is a message I am going to encrypt with a symmetric key';
      const message = await WakuMessage.fromUtf8String(messageText, {
        symKey: symKey,
      });

      await waku.relay.send(message);

      let msgs: WakuRelayMessage[] = [];

      while (msgs.length === 0) {
        await delay(200);
        msgs = await nimWaku.getSymmetricMessages(symKey);
      }

      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(hexToBuf(msgs[0].payload).toString('utf-8')).to.equal(messageText);
    });
  });
});
