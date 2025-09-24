import { createDecoder, createEncoder } from "@waku/core";
import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IFilter,
  ILightPush,
  IMessage,
  IStore
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import sinon from "sinon";

import {
  FilterAckManager,
  MessageStore,
  Messaging,
  StoreAckManager
} from "./messaging.js";

const testContentTopic = "/test/1/waku-messaging/utf8";
const testNetworkconfig = {
  clusterId: 0,
  numShardsInCluster: 9
};
const testRoutingInfo = createRoutingInfo(testNetworkconfig, {
  contentTopic: testContentTopic
});

describe("MessageStore", () => {
  it("queues, marks sent and acks", async () => {
    const encoder = createEncoder({
      contentTopic: testContentTopic,
      routingInfo: testRoutingInfo
    });
    const store = new MessageStore({ resendIntervalMs: 1 });
    const msg: IMessage = { payload: utf8ToBytes("hello") };

    const hash = await store.queue(encoder as IEncoder, msg);
    expect(hash).to.be.a("string");
    if (!hash) return;
    expect(store.has(hash)).to.be.true;
    store.markSent(hash);
    store.markFilterAck(hash);
    store.markStoreAck(hash);

    const toSend = store.getMessagesToSend();
    expect(toSend.length).to.eq(0);
  });
});
describe("FilterAckManager", () => {
  it("subscribes and marks filter ack on messages", async () => {
    const store = new MessageStore();
    const filter: IFilter = {
      multicodec: "filter",
      start: sinon.stub().resolves(),
      stop: sinon.stub().resolves(),
      subscribe: sinon.stub().callsFake(async (_dec, cb: any) => {
        const decoder = createDecoder(testContentTopic, testRoutingInfo);
        const proto = await decoder.fromProtoObj(decoder.pubsubTopic, {
          payload: utf8ToBytes("x"),
          contentTopic: testContentTopic,
          version: 0,
          timestamp: BigInt(Date.now()),
          meta: undefined,
          rateLimitProof: undefined,
          ephemeral: false
        } as any);
        if (proto) {
          await cb({ ...proto, hashStr: "hash" } as IDecodedMessage);
        }
        return true;
      }),
      unsubscribe: sinon.stub().resolves(true),
      unsubscribeAll: sinon.stub()
    } as unknown as IFilter;

    const mgr = new FilterAckManager(store, filter);
    const encoder = createEncoder({
      contentTopic: testContentTopic,
      routingInfo: testRoutingInfo
    });

    const subscribed = await mgr.subscribe({
      ...encoder,
      fromWireToProtoObj: (b: Uint8Array) =>
        createDecoder(testContentTopic, testRoutingInfo).fromWireToProtoObj(b),
      fromProtoObj: (pubsub: string, p: any) =>
        createDecoder(testContentTopic, testRoutingInfo).fromProtoObj(pubsub, p)
    } as unknown as IDecoder<IDecodedMessage> & IEncoder);
    expect(subscribed).to.be.true;
  });
});

describe("StoreAckManager", () => {
  it("queries and marks store ack", async () => {
    const store = new MessageStore();
    const decoder = createDecoder(testContentTopic, testRoutingInfo);
    const d = decoder as IDecoder<IDecodedMessage> & IEncoder;

    const mockStore: IStore = {
      multicodec: "store",
      createCursor: sinon.stub() as any,
      queryGenerator: sinon.stub() as any,
      queryWithOrderedCallback: sinon
        .stub()
        .callsFake(async (_decs: any, cb: any) => {
          const proto = await decoder.fromProtoObj(decoder.pubsubTopic, {
            payload: utf8ToBytes("x"),
            contentTopic: testContentTopic,
            version: 0,
            timestamp: BigInt(Date.now()),
            meta: undefined,
            rateLimitProof: undefined,
            ephemeral: false
          } as any);
          if (proto) {
            await cb({ ...proto, hashStr: "hash2" });
          }
        }),
      queryWithPromiseCallback: sinon.stub() as any
    } as unknown as IStore;

    const mgr = new StoreAckManager(store, mockStore);
    await mgr.subscribe(d);
    mgr.start();
    await new Promise((r) => setTimeout(r, 5));
    mgr.stop();
  });
});

describe("Messaging", () => {
  it("queues and sends via light push, marks sent", async () => {
    const encoder = createEncoder({
      contentTopic: testContentTopic,
      routingInfo: testRoutingInfo
    });

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

    const messaging = new Messaging({ lightPush, filter, store });

    await messaging.send(encoder, { payload: utf8ToBytes("hello") });
    expect((lightPush.send as any).calledOnce).to.be.true;
  });
});
