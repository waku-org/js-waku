import { expect } from 'chai';
import TCP from 'libp2p-tcp';

import { makeLogFileName, NimWaku, NOISE_KEY_1 } from '../../test_utils';
import Waku from '../waku';
import { WakuMessage } from '../waku_message';

describe('Waku Store', () => {
  let waku: Waku;
  let nimWaku: NimWaku;

  afterEach(async function () {
    nimWaku ? nimWaku.stop() : null;
    waku ? await waku.stop() : null;
  });

  it('Retrieves history', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ store: true });

    for (let i = 0; i < 2; i++) {
      expect(
        await nimWaku.sendMessage(WakuMessage.fromUtf8String(`Message ${i}`))
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      modules: { transport: [TCP] },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory(nimPeerId);

    expect(messages?.length).eq(2);
    const result = messages?.findIndex((msg) => {
      return msg.payloadAsUtf8 === 'Message 0';
    });
    expect(result).to.not.eq(-1);
  });

  it('Retrieves all historical elements in chronological order through paging', async function () {
    this.timeout(5_000);

    nimWaku = new NimWaku(makeLogFileName(this));
    await nimWaku.start({ store: true });

    for (let i = 0; i < 15; i++) {
      expect(
        await nimWaku.sendMessage(WakuMessage.fromUtf8String(`Message ${i}`))
      ).to.be.true;
    }

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
      modules: { transport: [TCP] },
    });
    await waku.dial(await nimWaku.getMultiaddrWithId());

    // Wait for identify protocol to finish
    await new Promise((resolve) => {
      waku.libp2p.peerStore.once('change:protocols', resolve);
    });

    const nimPeerId = await nimWaku.getPeerId();

    const messages = await waku.store.queryHistory(nimPeerId);

    expect(messages?.length).eq(15);
    for (let index = 0; index < 2; index++) {
      expect(
        messages?.findIndex((msg) => {
          return msg.payloadAsUtf8 === `Message ${index}`;
        })
      ).to.eq(index);
    }
  });
});
