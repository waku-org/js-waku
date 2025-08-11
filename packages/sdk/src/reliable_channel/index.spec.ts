import { Peer, PeerId, Stream, TypedEventEmitter } from "@libp2p/interface";
import { MultiaddrInput } from "@multiformats/multiaddr";
import { createDecoder, createEncoder } from "@waku/core";
import {
  AutoSharding,
  Callback,
  CreateDecoderParams,
  CreateEncoderParams,
  HealthStatus,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IFilter,
  ILightPush,
  type IMessage,
  IRelay,
  ISendOptions,
  IStore,
  IWaku,
  IWakuEventEmitter,
  Libp2p,
  ProtocolError,
  Protocols,
  QueryRequestParams,
  SDKProtocolResult
} from "@waku/interfaces";
import { ContentMessage, MessageChannelEvent } from "@waku/sds";
import { createRoutingInfo, delay } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";
import sinon from "sinon";

import { ReliableChannel, ReliableChannelEvent } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";
const TEST_NETWORK_CONFIG: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 1
};
const TEST_ROUTING_INFO = createRoutingInfo(TEST_NETWORK_CONFIG, {
  contentTopic: TEST_CONTENT_TOPIC
});

type MockWakuEvents = {
  ["new-message"]: CustomEvent<IDecodedMessage>;
};

class MockWakuNode {
  public relay?: IRelay;
  public store?: IStore;
  public filter?: IFilter;
  public lightPush?: ILightPush;
  public protocols: string[];

  private readonly subscriptions: {
    decoders: IDecoder<any>[];
    callback: Callback<any>;
  }[];

  public constructor(
    private mockMessageEmitter?: TypedEventEmitter<MockWakuEvents>
  ) {
    this.protocols = [];
    this.events = new TypedEventEmitter();
    this.subscriptions = [];

    this.lightPush = {
      multicodec: "",
      send: this._send.bind(this),
      start(): void {},
      stop(): void {}
    };

    this.filter = {
      multicodec: "",
      subscribe: this._subscribe.bind(this),
      unsubscribe<T extends IDecodedMessage>(
        _decoders: IDecoder<T> | IDecoder<T>[]
      ): Promise<boolean> {
        throw "Not implemented";
      },
      unsubscribeAll(): void {
        throw "Not implemented";
      }
    };
  }

  public get libp2p(): Libp2p {
    throw "No libp2p on MockWakuNode";
  }

  private async _send(
    encoder: IEncoder,
    message: IMessage,
    _sendOptions?: ISendOptions
  ): Promise<SDKProtocolResult> {
    for (const { decoders, callback } of this.subscriptions) {
      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) throw "Issue in mock encoding message";
      for (const decoder of decoders) {
        const decodedMessage = await decoder.fromProtoObj(
          decoder.pubsubTopic,
          protoMessage
        );
        if (!decodedMessage) throw "Issue in mock decoding message";
        await callback(decodedMessage);
        if (this.mockMessageEmitter) {
          this.mockMessageEmitter.dispatchEvent(
            new CustomEvent<IDecodedMessage>("new-message", {
              detail: decodedMessage
            })
          );
        }
      }
    }
    return {
      failures: [],
      successes: []
    };
  }

  private async _subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<boolean> {
    this.subscriptions.push({
      decoders: Array.isArray(decoders) ? decoders : [decoders],
      callback
    });
    if (this.mockMessageEmitter) {
      this.mockMessageEmitter.addEventListener("new-message", (event) => {
        void callback(event.detail as unknown as T);
      });
    }
    return Promise.resolve(true);
  }

  public events: IWakuEventEmitter;

  public get peerId(): PeerId {
    throw "no peerId on MockWakuNode";
  }
  public get health(): HealthStatus {
    throw "no health on MockWakuNode";
  }
  public dial(
    _peer: PeerId | MultiaddrInput,
    _protocols?: Protocols[]
  ): Promise<Stream> {
    throw new Error("Method not implemented.");
  }
  public hangUp(_peer: PeerId | MultiaddrInput): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public start(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public stop(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public waitForPeers(
    _protocols?: Protocols[],
    _timeoutMs?: number
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public createDecoder(
    _params: CreateDecoderParams
  ): IDecoder<IDecodedMessage> {
    throw new Error("Method not implemented.");
  }
  public createEncoder(_params: CreateEncoderParams): IEncoder {
    throw new Error("Method not implemented.");
  }
  public isStarted(): boolean {
    throw new Error("Method not implemented.");
  }
  public isConnected(): boolean {
    throw new Error("Method not implemented.");
  }
  public getConnectedPeers(): Promise<Peer[]> {
    throw new Error("Method not implemented.");
  }
}

describe("Reliable Channel", () => {
  let mockWakuNode: IWaku;
  let encoder: IEncoder;
  let decoder: IDecoder<IDecodedMessage>;

  beforeEach(async () => {
    mockWakuNode = new MockWakuNode();
    encoder = createEncoder({
      contentTopic: TEST_CONTENT_TOPIC,
      routingInfo: TEST_ROUTING_INFO
    });
    decoder = createDecoder(TEST_CONTENT_TOPIC, TEST_ROUTING_INFO);
  });

  it("Outgoing message is emitted as sending", async () => {
    const reliableChannel = await ReliableChannel.create(
      mockWakuNode,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );

    const message = utf8ToBytes("message in channel");

    // Setting up message tracking
    const messageId = ReliableChannel.getMessageId(message);
    let messageSending = false;
    reliableChannel.addEventListener(
      ReliableChannelEvent.OutMessageSending,
      (event) => {
        if (event.detail === messageId) {
          messageSending = true;
        }
      }
    );

    await reliableChannel.send(message);

    expect(messageSending).to.be.true;
  });

  it("Outgoing message is emitted as sent", async () => {
    const reliableChannel = await ReliableChannel.create(
      mockWakuNode,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );

    const message = utf8ToBytes("message in channel");

    // Setting up message tracking
    const messageId = ReliableChannel.getMessageId(message);
    let messageSent = false;
    reliableChannel.addEventListener(
      ReliableChannelEvent.OutMessageSent,
      (event) => {
        if (event.detail === messageId) {
          messageSent = true;
        }
      }
    );

    await reliableChannel.send(message);

    expect(messageSent).to.be.true;
  });

  it("Encoder error raises irrecoverable error", async () => {
    mockWakuNode.lightPush!.send = (
      _encoder: IEncoder,
      _message: IMessage,
      _sendOptions?: ISendOptions
    ): Promise<SDKProtocolResult> => {
      return Promise.resolve({
        failures: [{ error: ProtocolError.EMPTY_PAYLOAD }],
        successes: []
      });
    };

    const reliableChannel = await ReliableChannel.create(
      mockWakuNode,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );

    const message = utf8ToBytes("payload doesnt matter");

    // Setting up message tracking
    const messageId = ReliableChannel.getMessageId(message);
    let irrecoverableError = false;
    reliableChannel.addEventListener(
      ReliableChannelEvent.OutMessageIrrecoverableError,
      (event) => {
        if (event.detail.messageId === messageId) {
          irrecoverableError = true;
        }
      }
    );

    encoder.contentTopic = "...";
    await reliableChannel.send(message);

    expect(irrecoverableError).to.be.true;
  });

  it("Outgoing message is not emitted as acknowledged from own outgoing messages", async () => {
    const reliableChannel = await ReliableChannel.create(
      mockWakuNode,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );

    const message = utf8ToBytes("first message in channel");

    // Setting up message tracking
    const messageId = ReliableChannel.getMessageId(message);
    let messageAcknowledged = false;
    reliableChannel.addEventListener(
      ReliableChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    await reliableChannel.send(message);

    // Sending a second message from the same node should not acknowledge the first one
    await reliableChannel.send(utf8ToBytes("second message in channel"));

    expect(messageAcknowledged).to.be.false;
  });

  it("Outgoing message is possibly acknowledged", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );
    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder,
      // Bob only includes one message in causal history
      { causalHistorySize: 1 }
    );

    const messages = ["first", "second", "third"].map((m) => {
      return utf8ToBytes(m);
    });

    // Alice sets up message tracking for first message
    const firstMessageId = ReliableChannel.getMessageId(messages[0]);
    let firstMessagePossiblyAcknowledged = false;
    reliableChannelAlice.addEventListener(
      ReliableChannelEvent.OutMessagePossiblyAcknowledged,
      (event) => {
        if (event.detail.messageId === firstMessageId) {
          firstMessagePossiblyAcknowledged = true;
        }
      }
    );

    for (const m of messages) {
      await reliableChannelAlice.send(m);
    }

    // Bobs sends a message now, it should include first one in bloom filter
    await reliableChannelBob.send(utf8ToBytes("message back"));

    expect(firstMessagePossiblyAcknowledged).to.be.true;
  });

  it("Outgoing message is acknowledged", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const reliableChannelAlice = await ReliableChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );
    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder
    );

    const message = utf8ToBytes("first message in channel");

    // Alice sets up message tracking
    const messageId = ReliableChannel.getMessageId(message);
    let messageAcknowledged = false;
    reliableChannelAlice.addEventListener(
      ReliableChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    await reliableChannelAlice.send(message);

    // Bobs sends a message now, it should include first one in causal history
    await reliableChannelBob.send(utf8ToBytes("second message in channel"));

    expect(messageAcknowledged).to.be.true;
  });

  it("Incoming message is emitted as received", async () => {
    const reliableChannel = await ReliableChannel.create(
      mockWakuNode,
      "MyChannel",
      "alice",
      encoder,
      decoder
    );

    let receivedMessage: IDecodedMessage;
    reliableChannel.addEventListener(
      ReliableChannelEvent.InMessageReceived,
      (event) => {
        receivedMessage = event.detail;
      }
    );

    const message = utf8ToBytes("message in channel");

    await reliableChannel.send(message);

    expect(bytesToUtf8(receivedMessage!.payload)).to.eq(bytesToUtf8(message));
  });

  describe("Acknowledgement", () => {
    it("Outgoing message is acknowledged", async () => {
      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder
      );
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder
      );

      const message = utf8ToBytes("first message in channel");

      // Alice sets up message tracking
      const messageId = ReliableChannel.getMessageId(message);
      let messageAcknowledged = false;
      reliableChannelAlice.addEventListener(
        ReliableChannelEvent.OutMessageAcknowledged,
        (event) => {
          if (event.detail === messageId) {
            messageAcknowledged = true;
          }
        }
      );

      await reliableChannelAlice.send(message);

      // Bobs sends a message now, it should include first one in causal history
      await reliableChannelBob.send(utf8ToBytes("second message in channel"));

      expect(messageAcknowledged).to.be.true;
    });

    it("Re-sent message is acknowledged once other parties join.", async () => {
      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);

      // Setup, Alice first
      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          retryIntervalMs: 0, // disable any automation to better control the test
          syncMinIntervalMs: 0
        }
      );

      // Bob is offline, Alice sends a message, this is the message we want
      // acknowledged in this test.
      const message = utf8ToBytes("message to be acknowledged");
      const messageId = ReliableChannel.getMessageId(message);
      let messageAcknowledged = false;
      reliableChannelAlice.addEventListener(
        ReliableChannelEvent.OutMessageAcknowledged,
        (event) => {
          if (event.detail === messageId) {
            messageAcknowledged = true;
          }
        }
      );
      await reliableChannelAlice.send(message);

      // Now Bob goes online
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          retryIntervalMs: 0, // disable any automation to better control the test
          syncMinIntervalMs: 0
        }
      );

      // Some sync messages are exchanged
      await reliableChannelAlice.sendSyncMessage();
      await reliableChannelBob.sendSyncMessage();

      // Some content messages are exchanged too
      await reliableChannelAlice.send(utf8ToBytes("some message"));
      await reliableChannelBob.send(utf8ToBytes("some other message"));

      // At this point, the message shouldn't be acknowledged yet as Bob
      // does not have a complete log
      expect(messageAcknowledged).to.be.false;

      // Now Alice resends the message
      await reliableChannelAlice.send(message);

      // Bob receives it, and should include it in its sync
      await reliableChannelBob.sendSyncMessage();

      // The sync should acknowledge the message
      expect(messageAcknowledged).to.be.true;
    });
  });

  describe("Sync", () => {
    it("Sync message is sent within sync frequency", async () => {
      const syncMinIntervalMs = 100;
      const reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          syncMinIntervalMs
        }
      );

      let syncMessageSent = false;
      reliableChannel.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSent = true;
        }
      );

      await delay(syncMinIntervalMs);

      expect(syncMessageSent).to.be.true;
    });

    it("Sync message are not sent excessively within sync frequency", async () => {
      const syncMinIntervalMs = 100;
      const reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          syncMinIntervalMs
        }
      );

      let syncMessageSentCount = 0;
      reliableChannel.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSentCount++;
        }
      );

      await delay(syncMinIntervalMs);

      // There is randomness to this, but it should not be excessive
      expect(syncMessageSentCount).to.be.lessThan(3);
    });

    it("Sync message is not sent if another sync message was just received", async function () {
      this.timeout(5000);

      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

      const syncMinIntervalMs = 1000;

      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          syncMinIntervalMs: 0 // does not send sync messages automatically
        }
      );
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          syncMinIntervalMs
        }
      );
      (reliableChannelBob as any).random = () => {
        return 1;
      }; // will wait a full second

      let syncMessageSent = false;
      reliableChannelBob.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSent = true;
        }
      );

      while (!syncMessageSent) {
        // Bob will send a sync message as soon as it started, we are waiting for this one
        await delay(100);
      }
      // Let's reset the tracker
      syncMessageSent = false;
      // We should be faster than Bob as Bob will "randomly" wait a full second
      await reliableChannelAlice.sendSyncMessage();

      // Bob should be waiting a full second before sending a message after Alice
      await delay(900);

      // Now, let's wait Bob to send the sync message
      await delay(200);
      expect(syncMessageSent).to.be.true;
    });

    it("Sync message is not sent if another non-ephemeral message was just received", async function () {
      this.timeout(5000);

      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

      const syncMinIntervalMs = 1000;

      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          syncMinIntervalMs: 0 // does not send sync messages automatically
        }
      );
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          syncMinIntervalMs
        }
      );
      (reliableChannelBob as any).random = () => {
        return 1;
      }; // will wait a full second

      let syncMessageSent = false;
      reliableChannelBob.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSent = true;
        }
      );

      while (!syncMessageSent) {
        // Bob will send a sync message as soon as it started, we are waiting for this one
        await delay(100);
      }
      // Let's reset the tracker
      syncMessageSent = false;
      // We should be faster than Bob as Bob will "randomly" wait a full second
      console.log("Alice sends message, should reset Bob");
      await reliableChannelAlice.send(utf8ToBytes("some message"));

      // Bob should be waiting a full second before sending a message after Alice
      await delay(900);

      // Now, let's wait Bob to send the sync message
      await delay(200);
      expect(syncMessageSent).to.be.true;
    });

    it("Sync message is not sent if another sync message was just sent", async function () {
      this.timeout(5000);
      const syncMinIntervalMs = 1000;

      const reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        { syncMinIntervalMs }
      );
      (reliableChannel as any).random = () => {
        return 1;
      }; // will wait a full second

      let syncMessageSent = false;
      reliableChannel.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSent = true;
        }
      );

      while (!syncMessageSent) {
        // Will send a sync message as soon as it started, we are waiting for this one
        await delay(100);
      }
      // Let's reset the tracker
      syncMessageSent = false;
      // We should be faster than automated sync as it will "randomly" wait a full second
      await reliableChannel.sendSyncMessage();

      // should be waiting a full second before sending a message after Alice
      await delay(900);

      // Now, let's wait to send the automated sync message
      await delay(200);
      expect(syncMessageSent).to.be.true;
    });

    it("Sync message is not sent if another non-ephemeral message was just sent", async function () {
      this.timeout(5000);
      const syncMinIntervalMs = 1000;

      const reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        { syncMinIntervalMs }
      );
      (reliableChannel as any).random = () => {
        return 1;
      }; // will wait a full second

      let syncMessageSent = false;
      reliableChannel.messageChannel.addEventListener(
        MessageChannelEvent.OutSyncSent,
        (_event) => {
          syncMessageSent = true;
        }
      );

      while (!syncMessageSent) {
        // Will send a sync message as soon as it started, we are waiting for this one
        await delay(100);
      }
      // Let's reset the tracker
      syncMessageSent = false;
      // We should be faster than automated sync as it will "randomly" wait a full second
      await reliableChannel.send(utf8ToBytes("non-ephemeral message"));

      // should be waiting a full second before sending a message after Alice
      await delay(900);

      // Now, let's wait to send the automated sync message
      await delay(200);
      expect(syncMessageSent).to.be.true;
    });

    it("Own sync message does not acknowledge own messages", async () => {
      const syncMinIntervalMs = 100;
      const reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          syncMinIntervalMs
        }
      );

      const msg = utf8ToBytes("some message");
      const msgId = ReliableChannel.getMessageId(msg);

      let messageAcknowledged = false;
      reliableChannel.messageChannel.addEventListener(
        MessageChannelEvent.OutMessageAcknowledged,
        (event) => {
          if (event.detail === msgId) messageAcknowledged = true;
        }
      );

      await reliableChannel.send(msg);

      await delay(syncMinIntervalMs * 2);

      // There is randomness to this, but it should not be excessive
      expect(messageAcknowledged).to.be.false;
    });
  });

  describe("Retries", () => {
    it("Outgoing message is retried until acknowledged", async () => {
      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          retryIntervalMs: 100 // faster for a quick test
        }
      );
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          maxRetryAttempts: 0 // This one does not perform retries
        }
      );

      const msgTxt = "first message in channel";
      const message = utf8ToBytes(msgTxt);

      // Let's check message from Alice
      let messageCount = 0;
      reliableChannelBob.addEventListener(
        ReliableChannelEvent.InMessageReceived,
        (event) => {
          if (bytesToUtf8(event.detail.payload) === msgTxt) {
            messageCount++;
          }
        }
      );

      await reliableChannelAlice.send(message);
      expect(messageCount).to.equal(1);

      // No response from Bob should trigger a retry from Alice
      await delay(110);
      expect(messageCount).to.equal(2);

      // Bobs sends a message now, it should include first one in causal history
      await reliableChannelBob.send(utf8ToBytes("second message in channel"));

      await delay(110);
      // Alice should have stopped sending
      expect(messageCount).to.equal(2);
    });
  });

  describe("Retrieval", () => {
    it("Automatically retrieves missing message", async () => {
      const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
      const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);

      // Setup, Alice first
      const reliableChannelAlice = await ReliableChannel.create(
        mockWakuNodeAlice,
        "MyChannel",
        "alice",
        encoder,
        decoder,
        {
          retryIntervalMs: 0, // disable any automation to better control the test
          syncMinIntervalMs: 0,
          retrieveFrequencyMs: 0
        }
      );

      // Bob is offline, Alice sends a message, this is the message we want
      // Bob to receive in this test.
      const message = utf8ToBytes("missing message");
      await reliableChannelAlice.send(message);

      const sdsMessage = new ContentMessage(
        ReliableChannel.getMessageId(message),
        "alice",
        "MyChannel",
        [],
        1,
        undefined,
        message
      );

      // Now Bob goes online
      const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

      // Stub store.queryGenerator to return a message
      const mockMessage = {
        payload: sdsMessage.encode()
      };
      const queryGeneratorStub = sinon.stub().callsFake(async function* (
        _decoders: IDecoder<IDecodedMessage>[],
        _options?: Partial<QueryRequestParams>
      ) {
        console.log("stub called");
        yield [Promise.resolve(mockMessage as IDecodedMessage)];
      });

      (mockWakuNodeBob.store as any) = {
        queryGenerator: queryGeneratorStub
      };

      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          retryIntervalMs: 0, // disable any automation to better control the test
          syncMinIntervalMs: 0,
          retrieveFrequencyMs: 100 // quick loop so the test go fast
        }
      );

      let messageRetrieved = false;
      reliableChannelBob.addEventListener(
        ReliableChannelEvent.InMessageReceived,
        (event) => {
          if (bytesToUtf8(event.detail.payload) === "missing message") {
            messageRetrieved = true;
          }
        }
      );

      // Alice sends a sync message, Bob should learn about missing message
      // and retrieve it
      await reliableChannelAlice.sendSyncMessage();

      await delay(200);

      expect(messageRetrieved).to.be.true;

      // Verify the stub was called once with the right messageHash info
      expect(queryGeneratorStub.calledOnce).to.be.true;
      const callArgs = queryGeneratorStub.getCall(0).args;
      expect(callArgs[1]).to.have.property("messageHashes");
      expect(callArgs[1].messageHashes).to.be.an("array");
    });
  });
});
