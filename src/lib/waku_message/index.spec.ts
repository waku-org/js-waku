import { expect } from 'chai';
import debug from 'debug';
import fc from 'fast-check';
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

describe('Waku Message', function () {
  it('Waku message round trip binary serialization [clear]', async function () {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (s) => {
        const msg = await WakuMessage.fromUtf8String(s);
        const binary = msg.encode();
        const actual = await WakuMessage.decode(binary);

        expect(actual).to.deep.equal(msg);
      })
    );
  });

  it('Payload to utf-8', async function () {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (s) => {
        const msg = await WakuMessage.fromUtf8String(s);
        const utf8 = msg.payloadAsUtf8;

        return utf8 === s;
      })
    );
  });

  it('Waku message round trip binary encryption [asymmetric, no signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, privKey) => {
          const publicKey = getPublicKey(privKey);

          const msg = await WakuMessage.fromBytes(payload, {
            encPublicKey: publicKey,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [privKey]);

          expect(actual?.payload).to.deep.equal(payload);
        }
      )
    );
  });

  it('Waku message round trip binary encryption [asymmetric, signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, sigPrivKey, encPrivKey) => {
          const sigPubKey = getPublicKey(sigPrivKey);
          const encPubKey = getPublicKey(encPrivKey);

          const msg = await WakuMessage.fromBytes(payload, {
            encPublicKey: encPubKey,
            sigPrivKey: sigPrivKey,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [encPrivKey]);

          expect(actual?.payload).to.deep.equal(payload);
          expect(actual?.signaturePublicKey).to.deep.equal(sigPubKey);
        }
      )
    );
  });
});

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

    waku.relay.addDecryptionPrivateKey(privateKey);

    const receivedMsgPromise: Promise<WakuMessage> = new Promise((resolve) => {
      waku.relay.addObserver(resolve);
    });

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
});
