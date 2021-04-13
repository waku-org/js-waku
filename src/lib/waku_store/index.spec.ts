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
  });

  afterEach(async function () {
    nimWaku ? nimWaku.stop() : null;
    waku ? await waku.stop() : null;
  });

  it('Retrieves history', async function () {
    this.timeout(5_000);

    for (let i = 0; i < 2; i++) {
      await nimWaku.sendMessage(WakuMessage.fromUtf8String(`Message ${i}`));
    }

    waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    await delay(500);

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory(nimPeerId);

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.utf8Payload() === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves all history element through paging', async function () {
    this.timeout(5_000);

    for (let i = 0; i < 20; i++) {
      await nimWaku.sendMessage(WakuMessage.fromUtf8String(`Message ${i}`));
    }

    waku = await Waku.create({ staticNoiseKey: NOISE_KEY_1 });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    await delay(500);

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory(nimPeerId);

    expect(messages?.length).eq(20);
    expect(
      messages?.findIndex((msg) => {
        return msg.utf8Payload() === 'Message 0';
      })
    ).to.not.eq(-1);
    expect(
      messages?.findIndex((msg) => {
        return msg.utf8Payload() === 'Message 19';
      })
    ).to.not.eq(-1);
  });
});
