import { expect } from 'chai';
import debug from 'debug';

import { makeLogFileName, NimWaku, NOISE_KEY_1 } from '../../test_utils';
import { delay } from '../delay';
import { Protocols, Waku } from '../waku';
import { WakuMessage } from '../waku_message';

const dbg = debug('waku:test:lightpush');

const TestContentTopic = '/test/1/waku-light-push/utf8';

describe('Waku Light Push [node only]', () => {
  let waku: Waku;
  let nimWaku: NimWaku;

  afterEach(async function () {
    !!nimWaku && nimWaku.stop();
    !!waku && waku.stop().catch((e) => console.log('Waku failed to stop', e));
  });

  it('Push successfully', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ lightpush: true });

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.LightPush]);

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
      pubSubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());
    await waku.waitForRemotePeer([Protocols.LightPush]);

    const nimPeerId = await nimWaku.getPeerId();

    const messageText = 'Light Push works!';
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic
    );

    dbg('Send message via lightpush');
    const pushResponse = await waku.lightPush.push(message, {
      peerId: nimPeerId,
    });
    dbg('Ack received', pushResponse);
    expect(pushResponse?.isSuccess).to.be.true;

    let msgs: WakuMessage[] = [];

    dbg('Waiting for message to show on nim-waku side');
    while (msgs.length === 0) {
      await delay(200);
      msgs = await nimWaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(message.contentTopic);
    expect(msgs[0].version).to.equal(message.version);
    expect(msgs[0].payloadAsUtf8).to.equal(messageText);
  });
});
