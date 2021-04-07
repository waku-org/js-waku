import { expect } from 'chai';

import {
  delay,
  makeLogFileName,
  NimWaku,
  NOISE_KEY_1,
  NOISE_KEY_2,
} from '../../test_utils';
import Waku from '../waku';
import { WakuMessage } from '../waku_message';

describe('Waku Store', () => {
  let waku: Waku;
  let nimWaku: NimWaku;

  beforeEach(async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ store: true });

    const waku0 = await Waku.create({ staticNoiseKey: NOISE_KEY_2 });
    await waku0.dial(await nimWaku.getMultiaddrWithId());

    await delay(100);
    await new Promise((resolve) =>
      waku0.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
    );

    await waku0.relay.subscribe();

    await new Promise((resolve) =>
      waku0.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
    );

    await waku0.relay.publish(
      WakuMessage.fromUtf8String('A message from relay.')
    );

    await nimWaku.sendMessage(
      WakuMessage.fromUtf8String('Another message from json rpc.')
    );

    waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    await delay(500);
  });

  afterEach(async function () {
    nimWaku ? nimWaku.stop() : null;
    waku ? await waku.stop() : null;
  });

  it('Retrieves history', async function () {
    const nimPeerId = await nimWaku.getPeerId();

    const response = await waku.store.queryHistory(nimPeerId);
    const messages = response?.messages;

    // TODO: Should be fixed with https://github.com/status-im/nim-waku/issues/471
    // expect(messages?.length).eq(2);
    const result = messages
      ?.map((protoMsg) => {
        return WakuMessage.fromProto(protoMsg);
      })
      .findIndex((msg) => {
        return msg.utf8Payload() === 'A message from relay.';
      });
    expect(result).to.not.eq(-1);
  });
});
