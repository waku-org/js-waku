import type {
  IFilter,
  ILightPush,
  ISendMessage,
  IStore
} from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import sinon from "sinon";

import { MessageStore } from "./message_store.js";
import { Messaging } from "./messaging.js";

const testContentTopic = "/test/1/waku-messaging/utf8";
const testNetworkconfig = {
  clusterId: 0,
  numShardsInCluster: 9
};

describe("MessageStore", () => {
  it("queues, marks sent and acks", async () => {
    const store = new MessageStore({ resendIntervalMs: 1 });
    const msg: ISendMessage = {
      contentTopic: testContentTopic,
      payload: utf8ToBytes("hello")
    };

    const hash = await store.queue(msg);
    expect(hash).to.be.a("string");
    if (!hash) return;

    const mockDecodedMessage = {
      hashStr: hash,
      timestamp: new Date()
    } as any;

    store.markSent(hash, mockDecodedMessage);
    store.markFilterAck(hash);
    store.markStoreAck(hash);

    const toSend = store.getMessagesToSend();
    expect(toSend.length).to.eq(0);
  });
});

describe("Messaging", () => {
  it("queues and sends via light push, marks sent", async () => {
    const lightPush: ILightPush = {
      multicodec: "lightpush",
      start: () => {},
      stop: () => {},
      send: sinon.stub().resolves({ successes: [], failures: [] }) as any
    } as unknown as ILightPush;

    const filter: IFilter = {
      multicodec: "filter",
      start: sinon.stub().resolves(),
      stop: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(true),
      unsubscribe: sinon.stub().resolves(true),
      unsubscribeAll: sinon.stub()
    } as unknown as IFilter;

    const store: IStore = {
      multicodec: "store",
      createCursor: sinon.stub() as any,
      queryGenerator: sinon.stub() as any,
      queryWithOrderedCallback: sinon.stub().resolves(),
      queryWithPromiseCallback: sinon.stub().resolves()
    } as unknown as IStore;

    const messaging = new Messaging({
      lightPush,
      filter,
      store,
      networkConfig: testNetworkconfig
    });

    const message: ISendMessage = {
      contentTopic: testContentTopic,
      payload: utf8ToBytes("hello")
    };

    await messaging.send(message);
    expect((lightPush.send as any).calledOnce).to.be.true;
  });
});
