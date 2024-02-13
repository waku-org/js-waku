import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  waitForRemotePeer
} from "@waku/core";
import { IFilterSubscription, Protocols } from "@waku/interfaces";
import type { LightNode } from "@waku/interfaces";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "@waku/message-encryption";
import {
  createDecoder as eciesDecoder,
  createEncoder as eciesEncoder
} from "@waku/message-encryption/ecies";
import {
  createDecoder as symDecoder,
  createEncoder as symEncoder
} from "@waku/message-encryption/symmetric";
import { createLightNode } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  delay,
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  NOISE_KEY_1,
  NOISE_KEY_2,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../src/index.js";

const log = new Logger("test:ephemeral");

const TestContentTopic = "/test/1/ephemeral/utf8";
const TestEncoder = createEncoder({
  contentTopic: TestContentTopic
});
const TestDecoder = createDecoder(TestContentTopic);

describe("Waku Message Ephemeral field", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  let subscription: IFilterSubscription;

  this.afterEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const teardown: () => Promise<void> = async () => {
      await tearDownNodes(nwaku, waku);
    };
    withGracefulTimeout(teardown, done);
  });

  this.beforeEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const runNodes: () => Promise<void> = async () => {
      nwaku = new ServiceNode(makeLogFileName(this));
      await nwaku.start({
        filter: true,
        lightpush: true,
        store: true,
        relay: true
      });
      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      });
      await waku.start();
      await waku.dial(await nwaku.getMultiaddrWithId());

      await waitForRemotePeer(waku, [
        Protocols.Filter,
        Protocols.LightPush,
        Protocols.Store
      ]);

      subscription = await waku.filter.createSubscription();
    };
    withGracefulTimeout(runNodes, done);
  });

  it("Ephemeral messages are not stored", async function () {
    this.timeout(50_000);

    const asymText =
      "This message is encrypted for me using asymmetric encryption";
    const symText =
      "This message is encrypted for me using symmetric encryption";
    const clearText = "This is a clear text message";

    const asymMsg = { payload: utf8ToBytes(asymText) };
    const symMsg = {
      payload: utf8ToBytes(symText)
    };
    const clearMsg = {
      payload: utf8ToBytes(clearText)
    };

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const AsymContentTopic = "/test/1/ephemeral-asym/utf8";
    const SymContentTopic = "/test/1/ephemeral-sym/utf8";

    const asymEncoder = eciesEncoder({
      contentTopic: AsymContentTopic,
      publicKey,
      ephemeral: true
    });
    const symEncoder = eciesEncoder({
      contentTopic: SymContentTopic,
      publicKey: symKey,
      ephemeral: true
    });
    const clearEncoder = createEncoder({
      contentTopic: TestContentTopic,
      ephemeral: true
    });

    const asymDecoder = eciesDecoder(AsymContentTopic, privateKey);
    const symDecoder = eciesDecoder(SymContentTopic, symKey);

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      createLightNode({
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createLightNode({
        staticNoiseKey: NOISE_KEY_2
      }).then((waku) => waku.start().then(() => waku)),
      nwaku.getMultiaddrWithId()
    ]);

    log.info("Waku nodes created");

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr)
    ]);

    log.info("Waku nodes connected to nwaku");

    await waitForRemotePeer(waku1, [Protocols.LightPush]);

    log.info("Sending messages using light push");
    await Promise.all([
      waku1.lightPush.send(asymEncoder, asymMsg),
      waku1.lightPush.send(symEncoder, symMsg),
      waku1.lightPush.send(clearEncoder, clearMsg)
    ]);

    await waitForRemotePeer(waku2, [Protocols.Store]);

    const messages: DecodedMessage[] = [];

    log.info("Retrieving messages from store");
    for await (const msgPromises of waku2.store.queryGenerator([
      asymDecoder,
      symDecoder,
      TestDecoder
    ])) {
      for (const promise of msgPromises) {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
        }
      }
    }

    expect(messages?.length).eq(0);

    await tearDownNodes([], [waku1, waku2]);
  });

  it("Ephemeral field is preserved - encoder v0", async function () {
    this.timeout(10000);

    const ephemeralEncoder = createEncoder({
      contentTopic: TestContentTopic,
      ephemeral: true
    });

    const messages: DecodedMessage[] = [];
    const callback = (msg: DecodedMessage): void => {
      messages.push(msg);
    };
    await subscription.subscribe([TestDecoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(normalTxt)
    });
    await waku.lightPush.send(ephemeralEncoder, {
      payload: utf8ToBytes(ephemeralTxt)
    });
    while (messages.length < 2) {
      await delay(250);
    }

    const normalMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === normalTxt
    );
    const ephemeralMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === ephemeralTxt
    );

    expect(normalMsg).to.not.be.undefined;
    expect(ephemeralMsg).to.not.be.undefined;

    expect(normalMsg!.ephemeral).to.be.false;
    expect(ephemeralMsg!.ephemeral).to.be.true;
  });

  it("Ephemeral field is preserved - symmetric encryption", async function () {
    this.timeout(10000);

    const symKey = generateSymmetricKey();

    const ephemeralEncoder = symEncoder({
      contentTopic: TestContentTopic,
      symKey,
      ephemeral: true
    });
    const encoder = symEncoder({
      contentTopic: TestContentTopic,
      symKey
    });
    const decoder = symDecoder(TestContentTopic, symKey);

    const messages: DecodedMessage[] = [];
    const callback = (msg: DecodedMessage): void => {
      messages.push(msg);
    };
    await subscription.subscribe([decoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";
    await waku.lightPush.send(encoder, {
      payload: utf8ToBytes(normalTxt)
    });
    await waku.lightPush.send(ephemeralEncoder, {
      payload: utf8ToBytes(ephemeralTxt)
    });
    while (messages.length < 2) {
      await delay(250);
    }

    const normalMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === normalTxt
    );
    const ephemeralMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === ephemeralTxt
    );

    expect(normalMsg).to.not.be.undefined;
    expect(ephemeralMsg).to.not.be.undefined;

    expect(normalMsg!.ephemeral).to.be.false;
    expect(ephemeralMsg!.ephemeral).to.be.true;
  });

  it("Ephemeral field is preserved - asymmetric encryption", async function () {
    this.timeout(10000);

    const privKey = generatePrivateKey();
    const pubKey = getPublicKey(privKey);

    const ephemeralEncoder = eciesEncoder({
      contentTopic: TestContentTopic,
      publicKey: pubKey,
      ephemeral: true
    });
    const encoder = eciesEncoder({
      contentTopic: TestContentTopic,
      publicKey: pubKey
    });
    const decoder = eciesDecoder(TestContentTopic, privKey);

    const messages: DecodedMessage[] = [];
    const callback = (msg: DecodedMessage): void => {
      messages.push(msg);
    };
    await subscription.subscribe([decoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";
    await waku.lightPush.send(encoder, {
      payload: utf8ToBytes(normalTxt)
    });
    await waku.lightPush.send(ephemeralEncoder, {
      payload: utf8ToBytes(ephemeralTxt)
    });
    while (messages.length < 2) {
      await delay(250);
    }

    const normalMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === normalTxt
    );
    const ephemeralMsg = messages.find(
      (msg) => bytesToUtf8(msg.payload) === ephemeralTxt
    );

    expect(normalMsg).to.not.be.undefined;
    expect(ephemeralMsg).to.not.be.undefined;

    expect(normalMsg!.ephemeral).to.be.false;
    expect(ephemeralMsg!.ephemeral).to.be.true;
  });
});
