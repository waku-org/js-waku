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
  SDKProtocolResult
} from "@waku/interfaces";
import { MessageChannelEvent as SdsMessageChannelEvent } from "@waku/sds";
import { createRoutingInfo, delay } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";

import { MessageChannel, MessageChannelEvent } from "./index.js";

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

describe("E2E Reliability", () => {
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
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder
    );

    const subRes = await messageChannel.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = utf8ToBytes("message in channel");

    // Setting up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let messageSending = false;
    messageChannel.addEventListener(
      MessageChannelEvent.OutMessageSending,
      (event) => {
        if (event.detail === messageId) {
          messageSending = true;
        }
      }
    );

    await messageChannel.send(message);

    expect(messageSending).to.be.true;
  });

  it("Outgoing message is emitted as sent", async () => {
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder
    );

    const subRes = await messageChannel.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = utf8ToBytes("message in channel");

    // Setting up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let messageSent = false;
    messageChannel.addEventListener(
      MessageChannelEvent.OutMessageSent,
      (event) => {
        if (event.detail === messageId) {
          messageSent = true;
        }
      }
    );

    await messageChannel.send(message);

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

    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder
    );

    const subRes = await messageChannel.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = new Uint8Array();

    // Setting up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let irrecoverableError = false;
    messageChannel.addEventListener(
      MessageChannelEvent.OutMessageIrrecoverableError,
      (event) => {
        if (event.detail.messageId === messageId) {
          irrecoverableError = true;
        }
      }
    );

    encoder.contentTopic = "...";
    await messageChannel.send(message);

    expect(irrecoverableError).to.be.true;
  });

  it("Outgoing message is acknowledged", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const messageChannelAlice = MessageChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      encoder
    );
    const messageChannelBob = MessageChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      encoder
    );

    let subRes = await messageChannelAlice.subscribe(decoder);
    expect(subRes).to.be.true;
    subRes = await messageChannelBob.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = utf8ToBytes("first message in channel");

    // Alice sets up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let messageAcknowledged = false;
    messageChannelAlice.addEventListener(
      MessageChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    await messageChannelAlice.send(message);

    // Bobs sends a message now, it should include first one in causal history
    await messageChannelBob.send(utf8ToBytes("second message in channel"));

    expect(messageAcknowledged).to.be.true;
  });

  it("Outgoing message is not emitted as acknowledged from own outgoing messages", async () => {
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder
    );

    const subRes = await messageChannel.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = utf8ToBytes("first message in channel");

    // Setting up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let messageAcknowledged = false;
    messageChannel.addEventListener(
      MessageChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    await messageChannel.send(message);

    // Sending a second message from the same node should not acknowledge the first one
    await messageChannel.send(utf8ToBytes("second message in channel"));

    expect(messageAcknowledged).to.be.false;
  });

  it("Outgoing message is possibly acknowledged", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const messageChannelAlice = MessageChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      encoder
    );
    const messageChannelBob = MessageChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      encoder,
      // Bob only includes one message in causal history
      { causalHistorySize: 1 }
    );

    let subRes = await messageChannelAlice.subscribe(decoder);
    expect(subRes).to.be.true;
    subRes = await messageChannelBob.subscribe(decoder);
    expect(subRes).to.be.true;

    const messages = ["first", "second", "third"].map((m) => {
      return utf8ToBytes(m);
    });

    // Alice sets up message tracking for first message
    const firstMessageId = MessageChannel.getMessageId(messages[0]);
    let firstMessagePossiblyAcknowledged = false;
    messageChannelAlice.addEventListener(
      MessageChannelEvent.OutMessagePossiblyAcknowledged,
      (event) => {
        if (event.detail.messageId === firstMessageId) {
          firstMessagePossiblyAcknowledged = true;
        }
      }
    );

    for (const m of messages) {
      await messageChannelAlice.send(m);
    }

    // Bobs sends a message now, it should include first one in bloom filter
    await messageChannelBob.send(utf8ToBytes("message back"));

    expect(firstMessagePossiblyAcknowledged).to.be.true;
  });

  it("Outgoing message is acknowledged", async () => {
    const commonEventEmitter = new TypedEventEmitter<MockWakuEvents>();
    const mockWakuNodeAlice = new MockWakuNode(commonEventEmitter);
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);

    const messageChannelAlice = MessageChannel.create(
      mockWakuNodeAlice,
      "MyChannel",
      encoder
    );
    const messageChannelBob = MessageChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      encoder
    );

    let subRes = await messageChannelAlice.subscribe(decoder);
    expect(subRes).to.be.true;
    subRes = await messageChannelBob.subscribe(decoder);
    expect(subRes).to.be.true;

    const message = utf8ToBytes("first message in channel");

    // Alice sets up message tracking
    const messageId = MessageChannel.getMessageId(message);
    let messageAcknowledged = false;
    messageChannelAlice.addEventListener(
      MessageChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail === messageId) {
          messageAcknowledged = true;
        }
      }
    );

    await messageChannelAlice.send(message);

    // Bobs sends a message now, it should include first one in causal history
    await messageChannelBob.send(utf8ToBytes("second message in channel"));

    expect(messageAcknowledged).to.be.true;
  });

  it("Incoming message is emitted as received", async () => {
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder
    );

    const subRes = await messageChannel.subscribe(decoder);
    expect(subRes).to.be.true;

    let receivedMessage: IDecodedMessage;
    messageChannel.addEventListener(
      MessageChannelEvent.InMessageReceived,
      (event) => {
        receivedMessage = event.detail;
      }
    );

    const message = utf8ToBytes("message in channel");

    await messageChannel.send(message);

    expect(bytesToUtf8(receivedMessage!.payload)).to.eq(bytesToUtf8(message));
  });

  it("Sync message is sent within sync frequency", async () => {
    const syncMessageFrequencyMs = 100;
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder,
      {
        syncMinIntervalMs: syncMessageFrequencyMs
      }
    );

    let syncMessageSent = false;
    messageChannel.messageChannel.addEventListener(
      SdsMessageChannelEvent.OutSyncSent,
      (_event) => {
        syncMessageSent = true;
      }
    );

    await delay(syncMessageFrequencyMs);

    expect(syncMessageSent).to.be.true;
  });

  it("Sync message are not sent excessively within sync frequency", async () => {
    const syncMessageFrequencyMs = 100;
    const messageChannel = MessageChannel.create(
      mockWakuNode,
      "MyChannel",
      encoder,
      {
        syncMinIntervalMs: syncMessageFrequencyMs
      }
    );

    let syncMessageSentCount = 0;
    messageChannel.messageChannel.addEventListener(
      SdsMessageChannelEvent.OutSyncSent,
      (_event) => {
        syncMessageSentCount++;
      }
    );

    await delay(syncMessageFrequencyMs);

    // There is randomness to this, but it should not be excessive
    expect(syncMessageSentCount).to.be.lessThan(3);
  });
});
