import { createDecoder, createEncoder, DecodedMessage } from "@waku/core";
import { RelayNode } from "@waku/interfaces";
import {
  createDecoder as createEciesDecoder,
  createEncoder as createEciesEncoder,
  generatePrivateKey,
  getPublicKey
} from "@waku/message-encryption/ecies";
import {
  createDecoder as createSymDecoder,
  createEncoder as createSymEncoder,
  generateSymmetricKey
} from "@waku/message-encryption/symmetric";
import { createRelayNode } from "@waku/sdk";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  delay,
  NOISE_KEY_1,
  NOISE_KEY_2,
  tearDownNodes
} from "../../src/index.js";

import { log, waitForAllRemotePeers } from "./utils.js";

describe("Waku Relay", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;

  beforeEach(async function () {
    this.timeout(10000);
    log.info("Starting JS Waku instances");
    [waku1, waku2] = await Promise.all([
      createRelayNode({ staticNoiseKey: NOISE_KEY_1 }).then((waku) =>
        waku.start().then(() => waku)
      ),
      createRelayNode({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku))
    ]);
    log.info("Instances started, adding waku2 to waku1's address book");
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku1.dial(waku2.libp2p.peerId);

    await waitForAllRemotePeers(waku1, waku2);
    log.info("before each hook done");
  });

  afterEach(async function () {
    this.timeout(15000);
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
      publicKey
    });
    const symEncoder = createSymEncoder({
      contentTopic: symTopic,
      symKey
    });

    const eciesDecoder = createEciesDecoder(asymTopic, privateKey);
    const symDecoder = createSymDecoder(symTopic, symKey);

    const msgs: DecodedMessage[] = [];
    void waku2.relay.subscribe([eciesDecoder], (wakuMsg) => {
      msgs.push(wakuMsg);
    });
    void waku2.relay.subscribe([symDecoder], (wakuMsg) => {
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

    const contentTopic = "added-then-deleted-observer";

    // The promise **fails** if we receive a message on this observer.
    const receivedMsgPromise: Promise<DecodedMessage> = new Promise(
      (resolve, reject) => {
        const deleteObserver = waku2.relay.subscribe(
          [createDecoder(contentTopic)],
          reject
        ) as () => void;
        deleteObserver();
        setTimeout(resolve, 500);
      }
    );
    await waku1.relay.send(createEncoder({ contentTopic }), {
      payload: utf8ToBytes(messageText)
    });

    await receivedMsgPromise;
    // If it does not throw then we are good.
  });
});
