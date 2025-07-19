import { createDecoder, createEncoder } from "@waku/core";
import { IDecodedMessage, RelayNode } from "@waku/interfaces";
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
import { createRoutingInfo } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  tearDownNodes
} from "../../src/index.js";

import { runJSNodes, TestNetworkConfig, TestRoutingInfo } from "./utils.js";

describe("Waku Relay", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;

  beforeEachCustom(this, async () => {
    [waku1, waku2] = await runJSNodes();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([], [waku1, waku2]);
  });

  it("Decrypt messages", async function () {
    const asymText = "This message is encrypted using asymmetric";
    const asymTopic = "/test/1/asymmetric/proto";
    const symText = "This message is encrypted using symmetric encryption";
    const symTopic = "/test/1/symmetric/proto";

    const privateKey = generatePrivateKey();
    const symKey = generateSymmetricKey();
    const publicKey = getPublicKey(privateKey);

    const eciesEncoder = createEciesEncoder({
      contentTopic: asymTopic,
      publicKey,
      routingInfo: TestRoutingInfo
    });
    const symEncoder = createSymEncoder({
      contentTopic: symTopic,
      symKey,
      routingInfo: TestRoutingInfo
    });

    const eciesDecoder = createEciesDecoder(
      asymTopic,
      TestRoutingInfo,
      privateKey
    );
    const symDecoder = createSymDecoder(symTopic, TestRoutingInfo, symKey);

    const msgs: IDecodedMessage[] = [];
    void waku2.relay.subscribeWithUnsubscribe([eciesDecoder], (wakuMsg) => {
      msgs.push(wakuMsg);
    });
    void waku2.relay.subscribeWithUnsubscribe([symDecoder], (wakuMsg) => {
      msgs.push(wakuMsg);
    });

    await waku1.relay.send(eciesEncoder, { payload: utf8ToBytes(asymText) });
    await delay(200);
    await waku1.relay.send(symEncoder, { payload: utf8ToBytes(symText) });

    while (msgs.length < 2) {
      await delay(200);
    }

    expect(msgs[0].contentTopic).to.eq(asymTopic);
    expect(bytesToUtf8(msgs[0].payload!)).to.eq(asymText);
    expect(msgs[1].contentTopic).to.eq(symTopic);
    expect(bytesToUtf8(msgs[1].payload!)).to.eq(symText);
  });

  it("Delete observer", async function () {
    const messageText =
      "Published on content topic with added then deleted observer";

    const contentTopic = "/test/1/observer/proto";
    const routingInfo = createRoutingInfo(TestNetworkConfig, { contentTopic });

    // The promise **fails** if we receive a message on this observer.
    const receivedMsgPromise: Promise<IDecodedMessage> = new Promise(
      (resolve, reject) => {
        const deleteObserver = waku2.relay.subscribeWithUnsubscribe(
          [createDecoder(contentTopic, routingInfo)],
          reject
        ) as () => void;
        deleteObserver();
        setTimeout(resolve, 500);
      }
    );
    await waku1.relay.send(createEncoder({ contentTopic, routingInfo }), {
      payload: utf8ToBytes(messageText)
    });

    await receivedMsgPromise;
    // If it does not throw then we are good.
  });
});
