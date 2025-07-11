import { createDecoder, createEncoder } from "@waku/core";
import { AutoSharding, Protocols } from "@waku/interfaces";
import type { IDecodedMessage, LightNode } from "@waku/interfaces";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "@waku/message-encryption";
import {
  createDecoder as createEciesDecoder,
  createEncoder as createEciesEncoder
} from "@waku/message-encryption/ecies";
import {
  createDecoder as createSymDecoder,
  createEncoder as createSymEncoder
} from "@waku/message-encryption/symmetric";
import { createLightNode } from "@waku/sdk";
import { createRoutingInfo, Logger } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  makeLogFileName,
  NOISE_KEY_1,
  NOISE_KEY_2,
  ServiceNode,
  tearDownNodes
} from "../src/index.js";

const log = new Logger("test:ephemeral");

const TestClusterId = 2;
const TestNetworkConfig: AutoSharding = {
  clusterId: TestClusterId,
  numShardsInCluster: 8
};
const TestContentTopic = "/test/1/ephemeral/utf8";
const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});

const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);

const privateKey = generatePrivateKey();
const symKey = generateSymmetricKey();
const publicKey = getPublicKey(privateKey);

const AsymContentTopic = "/test/1/ephemeral-asym/utf8";
const SymContentTopic = "/test/1/ephemeral-sym/utf8";

const AsymEncoder = createEciesEncoder({
  contentTopic: AsymContentTopic,
  publicKey,
  ephemeral: true,
  routingInfo: TestRoutingInfo
});
const SymEncoder = createSymEncoder({
  contentTopic: SymContentTopic,
  symKey,
  ephemeral: true,
  routingInfo: TestRoutingInfo
});
const ClearEncoder = createEncoder({
  contentTopic: TestContentTopic,
  ephemeral: true,
  routingInfo: TestRoutingInfo
});

const AsymDecoder = createEciesDecoder(
  AsymContentTopic,
  TestRoutingInfo,
  privateKey
);
const SymDecoder = createSymDecoder(SymContentTopic, TestRoutingInfo, symKey);

describe("Waku Message Ephemeral field", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    const contentTopics = [TestContentTopic, AsymContentTopic, SymContentTopic];
    await nwaku.start({
      filter: true,
      lightpush: true,
      store: true,
      relay: true,
      contentTopic: contentTopics,
      clusterId: TestClusterId
    });
    await nwaku.ensureSubscriptionsAutosharding([
      TestContentTopic,
      AsymContentTopic,
      SymContentTopic
    ]);

    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
      networkConfig: TestNetworkConfig
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());

    await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
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

    const [waku1, waku2, nimWakuMultiaddr] = await Promise.all([
      createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        networkConfig: TestNetworkConfig
      }).then((waku) => waku.start().then(() => waku)),
      createLightNode({
        staticNoiseKey: NOISE_KEY_2,
        networkConfig: TestNetworkConfig
      }).then((waku) => waku.start().then(() => waku)),
      nwaku.getMultiaddrWithId()
    ]);

    log.info("Waku nodes created");

    await Promise.all([
      waku1.dial(nimWakuMultiaddr),
      waku2.dial(nimWakuMultiaddr)
    ]);

    log.info("Waku nodes connected to nwaku");

    await waku.waitForPeers([Protocols.LightPush]);

    log.info("Sending messages using light push");
    await Promise.all([
      waku1.lightPush.send(AsymEncoder, asymMsg),
      waku1.lightPush.send(SymEncoder, symMsg),
      waku1.lightPush.send(ClearEncoder, clearMsg)
    ]);

    await waku2.waitForPeers([Protocols.Store]);

    const messages: IDecodedMessage[] = [];

    log.info("Retrieving messages from store");
    for await (const msgPromises of waku2.store.queryGenerator([
      AsymDecoder,
      SymDecoder,
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
      ephemeral: true,
      routingInfo: TestRoutingInfo
    });

    const messages: IDecodedMessage[] = [];
    const callback = (msg: IDecodedMessage): void => {
      messages.push(msg);
    };
    await waku.filter.subscribe([TestDecoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";

    await Promise.all([
      waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(normalTxt)
      }),
      waku.lightPush.send(ephemeralEncoder, {
        payload: utf8ToBytes(ephemeralTxt)
      })
    ]);

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

    const encoder = createSymEncoder({
      contentTopic: SymContentTopic,
      symKey,
      routingInfo: TestRoutingInfo
    });
    const decoder = createSymDecoder(SymContentTopic, TestRoutingInfo, symKey);

    const messages: IDecodedMessage[] = [];
    const callback = (msg: IDecodedMessage): void => {
      messages.push(msg);
    };
    await waku.filter.subscribe([decoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";

    await Promise.all([
      waku.lightPush.send(encoder, {
        payload: utf8ToBytes(normalTxt)
      }),
      waku.lightPush.send(SymEncoder, {
        payload: utf8ToBytes(ephemeralTxt)
      })
    ]);

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

    const encoder = createEciesEncoder({
      contentTopic: AsymContentTopic,
      publicKey: publicKey,
      routingInfo: TestRoutingInfo
    });
    const decoder = createEciesDecoder(
      AsymContentTopic,
      TestRoutingInfo,
      privateKey
    );

    const messages: IDecodedMessage[] = [];
    const callback = (msg: IDecodedMessage): void => {
      messages.push(msg);
    };
    await waku.filter.subscribe([decoder], callback);

    await delay(200);
    const normalTxt = "Normal message";
    const ephemeralTxt = "Ephemeral Message";

    await Promise.all([
      waku.lightPush.send(encoder, {
        payload: utf8ToBytes(normalTxt)
      }),
      waku.lightPush.send(AsymEncoder, {
        payload: utf8ToBytes(ephemeralTxt)
      })
    ]);

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
