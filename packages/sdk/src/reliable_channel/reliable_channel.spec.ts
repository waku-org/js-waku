import { PeerId, TypedEventEmitter } from "@libp2p/interface";
import { createDecoder, createEncoder } from "@waku/core";
import {
  AutoSharding,
  HealthStatus,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  type IMessage,
  ISendOptions,
  IWaku,
  LightPushError,
  LightPushSDKResult,
  QueryRequestParams
} from "@waku/interfaces";
import { ContentMessage } from "@waku/sds";
import {
  createRoutingInfo,
  delay,
  MockWakuEvents,
  MockWakuNode
} from "@waku/utils";
import { bytesToUtf8, hexToBytes, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";
import sinon from "sinon";

import { ReliableChannel } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";
const TEST_NETWORK_CONFIG: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 1
};
const TEST_ROUTING_INFO = createRoutingInfo(TEST_NETWORK_CONFIG, {
  contentTopic: TEST_CONTENT_TOPIC
});

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
    const messageId = reliableChannel.send(message);
    let messageSending = false;
    reliableChannel.addEventListener("sending-message", (event) => {
      if (event.detail === messageId) {
        messageSending = true;
      }
    });

    while (!messageSending) {
      await delay(50);
    }

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

    const messageId = reliableChannel.send(message);

    // Setting up message tracking
    let messageSent = false;
    reliableChannel.addEventListener("message-sent", (event) => {
      if (event.detail === messageId) {
        messageSent = true;
      }
    });

    while (!messageSent) {
      await delay(50);
    }

    expect(messageSent).to.be.true;
  });

  it("Encoder error raises irrecoverable error", async () => {
    mockWakuNode.lightPush!.send = (
      _encoder: IEncoder,
      _message: IMessage,
      _sendOptions?: ISendOptions
    ): Promise<LightPushSDKResult> => {
      return Promise.resolve({
        failures: [{ error: LightPushError.EMPTY_PAYLOAD }],
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

    encoder.contentTopic = "...";
    const messageId = reliableChannel.send(message);

    // Setting up message tracking
    let irrecoverableError = false;
    reliableChannel.addEventListener(
      "sending-message-irrecoverable-error",
      (event) => {
        if (event.detail.messageId === messageId) {
          irrecoverableError = true;
        }
      }
    );

    while (!irrecoverableError) {
      await delay(50);
    }

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
    reliableChannel.addEventListener("message-acknowledged", (event) => {
      if (event.detail === messageId) {
        messageAcknowledged = true;
      }
    });

    reliableChannel.send(message);

    // Sending a second message from the same node should not acknowledge the first one
    reliableChannel.send(utf8ToBytes("second message in channel"));

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
      "message-possibly-acknowledged",
      (event) => {
        if (event.detail.messageId === firstMessageId) {
          firstMessagePossiblyAcknowledged = true;
        }
      }
    );

    let messageReceived = false;
    reliableChannelBob.addEventListener("message-received", (event) => {
      if (bytesToUtf8(event.detail.payload) === "third") {
        messageReceived = true;
      }
    });

    for (const m of messages) {
      reliableChannelAlice.send(m);
    }

    // Wait for Bob to receive last message to ensure it is all included in filter
    while (!messageReceived) {
      await delay(50);
    }

    // Bobs sends a message now, it should include first one in bloom filter
    reliableChannelBob.send(utf8ToBytes("message back"));
    while (!firstMessagePossiblyAcknowledged) {
      await delay(50);
    }

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

    const messageId = reliableChannelAlice.send(message);

    // Alice sets up message tracking
    let messageAcknowledged = false;
    reliableChannelAlice.addEventListener("message-acknowledged", (event) => {
      if (event.detail === messageId) {
        messageAcknowledged = true;
      }
    });

    let bobReceivedMessage = false;
    reliableChannelBob.addEventListener("message-received", () => {
      bobReceivedMessage = true;
    });

    // Wait for bob to receive the message to ensure it's included in causal history
    while (!bobReceivedMessage) {
      await delay(50);
    }

    // Bobs sends a message now, it should include first one in causal history
    reliableChannelBob.send(utf8ToBytes("second message in channel"));
    while (!messageAcknowledged) {
      await delay(50);
    }

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
    reliableChannel.addEventListener("message-received", (event) => {
      receivedMessage = event.detail;
    });

    const message = utf8ToBytes("message in channel");

    reliableChannel.send(message);
    while (!receivedMessage!) {
      await delay(50);
    }

    expect(bytesToUtf8(receivedMessage!.payload)).to.eq(bytesToUtf8(message));
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
          retryIntervalMs: 200, // faster for a quick test,
          processTaskMinElapseMs: 10 // faster so it process message as soon as they arrive
        }
      );
      const reliableChannelBob = await ReliableChannel.create(
        mockWakuNodeBob,
        "MyChannel",
        "bob",
        encoder,
        decoder,
        {
          syncMinIntervalMs: 0, // do not send sync messages automatically
          maxRetryAttempts: 0 // This one does not perform retries
        }
      );

      const msgTxt = "first message in channel";
      const message = utf8ToBytes(msgTxt);

      // Let's count how many times Bob receives Alice's message
      let messageCount = 0;
      reliableChannelBob.addEventListener("message-received", (event) => {
        if (bytesToUtf8(event.detail.payload) === msgTxt) {
          messageCount++;
        }
      });

      reliableChannelAlice.send(message);

      while (messageCount < 1) {
        await delay(10);
      }
      expect(messageCount).to.equal(1, "Bob received Alice's message once");

      // No response from Bob should trigger a retry from Alice
      while (messageCount < 2) {
        await delay(10);
      }
      expect(messageCount).to.equal(2, "retried once");

      // Bobs sends a message now, it should include first one in causal history
      reliableChannelBob.send(utf8ToBytes("second message in channel"));

      // Wait long enough to confirm no retry is executed
      await delay(300);

      // Alice should have stopped sending
      expect(messageCount).to.equal(2, "hasn't retried since it's acked");
    });
  });

  describe("Missing Message Retrieval", () => {
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
          // disable any automation to better control the test
          retryIntervalMs: 0,
          syncMinIntervalMs: 0,
          retrieveFrequencyMs: 0,
          processTaskMinElapseMs: 10
        }
      );

      // Bob is offline, Alice sends a message, this is the message we want
      // Bob to receive in this test.
      const message = utf8ToBytes("missing message");
      reliableChannelAlice.send(message);
      // Wait to be sent
      await new Promise((resolve) => {
        reliableChannelAlice.addEventListener("message-sent", resolve, {
          once: true
        });
      });

      const sdsMessage = new ContentMessage(
        ReliableChannel.getMessageId(message),
        "MyChannel",
        "alice",
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
          processTaskMinElapseMs: 10,
          retrieveFrequencyMs: 100 // quick loop so the test go fast
        }
      );

      let messageRetrieved = false;
      reliableChannelBob.addEventListener("message-received", (event) => {
        if (bytesToUtf8(event.detail.payload) === "missing message") {
          messageRetrieved = true;
        }
      });

      // Alice sends a sync message, Bob should learn about missing message
      // and retrieve it
      await reliableChannelAlice["sendSyncMessage"]();

      await delay(200);

      expect(messageRetrieved).to.be.true;

      // Verify the stub was called once with the right messageHash info
      expect(queryGeneratorStub.calledOnce).to.be.true;
      const callArgs = queryGeneratorStub.getCall(0).args;
      expect(callArgs[1]).to.have.property("messageHashes");
      expect(callArgs[1].messageHashes).to.be.an("array");
    });
  });

  describe("Query On Connect Integration E2E Tests", () => {
    let mockWakuNode: MockWakuNode;
    let reliableChannel: ReliableChannel<IDecodedMessage>;
    let encoder: IEncoder;
    let decoder: IDecoder<IDecodedMessage>;
    let mockPeerManagerEvents: TypedEventEmitter<any>;
    let queryGeneratorStub: sinon.SinonStub;
    let mockPeerId: PeerId;

    beforeEach(async () => {
      // Setup mock waku node with store capability
      mockWakuNode = new MockWakuNode();

      // Setup mock peer manager events for QueryOnConnect
      mockPeerManagerEvents = new TypedEventEmitter();
      (mockWakuNode as any).peerManager = {
        events: mockPeerManagerEvents
      };

      // Setup encoder and decoder
      encoder = createEncoder({
        contentTopic: TEST_CONTENT_TOPIC,
        routingInfo: TEST_ROUTING_INFO
      });

      decoder = createDecoder(TEST_CONTENT_TOPIC, TEST_ROUTING_INFO);

      // Setup store with queryGenerator for QueryOnConnect
      queryGeneratorStub = sinon.stub();
      mockWakuNode.store = {
        queryGenerator: queryGeneratorStub
      } as any;

      mockPeerId = {
        toString: () => "QmTestPeerId"
      } as unknown as PeerId;
    });

    it("should trigger QueryOnConnect when going offline and store peer reconnects", async () => {
      // Create a message that will be auto-retrieved
      const messageText = "Auto-retrieved message";
      const messagePayload = utf8ToBytes(messageText);

      const sdsMessage = new ContentMessage(
        ReliableChannel.getMessageId(messagePayload),
        "testChannel",
        "testSender",
        [],
        1,
        undefined,
        messagePayload
      );

      const autoRetrievedMessage: IDecodedMessage = {
        hash: hexToBytes("1234"),
        hashStr: "1234",
        version: 1,
        timestamp: new Date(),
        contentTopic: TEST_CONTENT_TOPIC,
        pubsubTopic: decoder.pubsubTopic,
        payload: sdsMessage.encode(),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup queryGenerator to return the auto-retrieved message
      queryGeneratorStub.callsFake(async function* () {
        yield [Promise.resolve(autoRetrievedMessage)];
      });

      // Create ReliableChannel with queryOnConnect enabled
      reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "testChannel",
        "testSender",
        encoder,
        decoder
      );

      // Wait for initial setup
      await delay(50);

      // Setup complete - focus on testing QueryOnConnect trigger

      // Simulate going offline (change health status)
      mockWakuNode.events.dispatchEvent(
        new CustomEvent("health", { detail: HealthStatus.Unhealthy })
      );

      await delay(10);

      // Simulate store peer reconnection which should trigger QueryOnConnect
      mockPeerManagerEvents.dispatchEvent(
        new CustomEvent("store:connect", { detail: mockPeerId })
      );

      // Wait for store query to be triggered
      await delay(200);

      // Verify that QueryOnConnect was triggered by the conditions
      expect(queryGeneratorStub.called).to.be.true;
    });

    it("should trigger QueryOnConnect when time threshold is exceeded", async () => {
      // Create multiple messages that will be auto-retrieved
      const message1Text = "First auto-retrieved message";
      const message2Text = "Second auto-retrieved message";
      const message1Payload = utf8ToBytes(message1Text);
      const message2Payload = utf8ToBytes(message2Text);

      const sdsMessage1 = new ContentMessage(
        ReliableChannel.getMessageId(message1Payload),
        "testChannel",
        "testSender",
        [],
        1,
        undefined,
        message1Payload
      );

      const sdsMessage2 = new ContentMessage(
        ReliableChannel.getMessageId(message2Payload),
        "testChannel",
        "testSender",
        [],
        2,
        undefined,
        message2Payload
      );

      const autoRetrievedMessage1: IDecodedMessage = {
        hash: hexToBytes("5678"),
        hashStr: "5678",
        version: 1,
        timestamp: new Date(Date.now() - 1000),
        contentTopic: TEST_CONTENT_TOPIC,
        pubsubTopic: decoder.pubsubTopic,
        payload: sdsMessage1.encode(),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      const autoRetrievedMessage2: IDecodedMessage = {
        hash: hexToBytes("9abc"),
        hashStr: "9abc",
        version: 1,
        timestamp: new Date(),
        contentTopic: TEST_CONTENT_TOPIC,
        pubsubTopic: decoder.pubsubTopic,
        payload: sdsMessage2.encode(),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup queryGenerator to return multiple messages
      queryGeneratorStub.callsFake(async function* () {
        yield [Promise.resolve(autoRetrievedMessage1)];
        yield [Promise.resolve(autoRetrievedMessage2)];
      });

      // Create ReliableChannel with queryOnConnect enabled
      reliableChannel = await ReliableChannel.create(
        mockWakuNode,
        "testChannel",
        "testSender",
        encoder,
        decoder,
        { queryOnConnect: true }
      );

      await delay(50);

      // Simulate old last successful query by accessing QueryOnConnect internals
      // The default threshold is 5 minutes, so we'll set it to an old time
      if ((reliableChannel as any).queryOnConnect) {
        ((reliableChannel as any).queryOnConnect as any).lastSuccessfulQuery =
          Date.now() - 6 * 60 * 1000; // 6 minutes ago
      }

      // Simulate store peer connection which should trigger retrieval due to time threshold
      mockPeerManagerEvents.dispatchEvent(
        new CustomEvent("store:connect", { detail: mockPeerId })
      );

      // Wait for store query to be triggered
      await delay(200);

      // Verify that QueryOnConnect was triggered due to time threshold
      expect(queryGeneratorStub.called).to.be.true;
    });
  });
});
