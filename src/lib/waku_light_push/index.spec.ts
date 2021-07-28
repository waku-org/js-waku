import { expect } from 'chai';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import TCP from 'libp2p-tcp';

import { makeLogFileName, NimWaku, NOISE_KEY_1 } from '../../test_utils';
import { delay } from '../delay';
import { Waku } from '../waku';
import { WakuMessage } from '../waku_message';

const TestContentTopic = '/test/1/waku-light-push/utf8';

describe('Waku Light Push', () => {
  let waku: Waku;
  let nimWaku: NimWaku;

  afterEach(async function () {
    nimWaku ? nimWaku.stop() : null;
    waku ? await waku.stop() : null;
  });

  it('Push successfully', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ lightpush: true });

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const messageText = 'Light Push works!';
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic
    );

    const pushResponse = await waku.lightPush.push(message);
    expect(pushResponse?.isSuccess).to.be.true;

    let msgs: WakuMessage[] = [];

    while (msgs.length === 0) {
      await delay(200);
      msgs = await nimWaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(message.contentTopic);
    expect(msgs[0].version).to.equal(message.version);
    expect(msgs[0].payloadAsUtf8).to.equal(messageText);
  });

  it('Push on custom pubsub topic', async function () {
    this.timeout(5_000);

    const customPubSubTopic = '/waku/2/custom-dapp/proto';

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ lightpush: true, topics: customPubSubTopic });

    waku = await Waku.create({
      pubsubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { modules: { transport: [TCP] } },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const messageText = 'Light Push works!';
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic
    );

    const pushResponse = await waku.lightPush.push(message, {
      peerId: nimPeerId,
    });
    expect(pushResponse?.isSuccess).to.be.true;

    let msgs: WakuMessage[] = [];

    while (msgs.length === 0) {
      await delay(200);
      msgs = await nimWaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(message.contentTopic);
    expect(msgs[0].version).to.equal(message.version);
    expect(msgs[0].payloadAsUtf8).to.equal(messageText);
  });
});
