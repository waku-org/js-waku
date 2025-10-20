import { TypedEventEmitter } from "@libp2p/interface";
import { createDecoder, createEncoder } from "@waku/core";
import {
  AutoSharding,
  IDecodedMessage,
  IDecoder,
  IEncoder
} from "@waku/interfaces";
import { createRoutingInfo, MockWakuEvents, MockWakuNode } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";

import { ReliableChannel } from "./index.js";

function waitForEvent<T>(
  emitter: TypedEventEmitter<any>,
  eventName: string,
  predicate?: (detail: T) => boolean,
  timeoutMs: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      emitter.removeEventListener(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    const handler = (event: CustomEvent<T>): void => {
      if (!predicate || predicate(event.detail)) {
        clearTimeout(timeout);
        emitter.removeEventListener(eventName, handler);
        resolve(event.detail);
      }
    };

    emitter.addEventListener(eventName, handler);
  });
}

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";
const TEST_NETWORK_CONFIG: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 1
};
const TEST_ROUTING_INFO = createRoutingInfo(TEST_NETWORK_CONFIG, {
  contentTopic: TEST_CONTENT_TOPIC
});

describe("Reliable Channel: Acks", () => {
  let encoder: IEncoder;
  let decoder: IDecoder<IDecodedMessage>;

  beforeEach(async () => {
    encoder = createEncoder({
      contentTopic: TEST_CONTENT_TOPIC,
      routingInfo: TEST_ROUTING_INFO
    });
    decoder = createDecoder(TEST_CONTENT_TOPIC, TEST_ROUTING_INFO);
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

    const messageReceivedPromise = waitForEvent<IDecodedMessage>(
      reliableChannelBob,
      "message-received",
      (msg) => bytesToUtf8(msg.payload) === "first message in channel"
    );

    const messageAcknowledgedPromise = waitForEvent<string>(
      reliableChannelAlice,
      "message-acknowledged",
      (id) => id === messageId
    );

    // Alice sends the message
    reliableChannelAlice.send(message);

    // Wait for Bob to receive the message to ensure it uses it in causal history
    await messageReceivedPromise;

    // Bob sends a message now, it should include first one in causal history
    reliableChannelBob.send(utf8ToBytes("second message in channel"));

    // Wait for Alice to receive acknowledgment
    await messageAcknowledgedPromise;
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
        syncMinIntervalMs: 0,
        processTaskMinElapseMs: 10
      }
    );

    // Bob is offline, Alice sends a message, this is the message we want
    // acknowledged in this test.
    const message = utf8ToBytes("message to be acknowledged");
    const messageId = ReliableChannel.getMessageId(message);

    let messageAcknowledged = false;
    reliableChannelAlice.addEventListener("message-acknowledged", (event) => {
      if (event.detail === messageId) {
        messageAcknowledged = true;
      }
    });

    reliableChannelAlice.send(message);

    // Now Bob goes online (no need to wait since Bob wasn't online to receive it)
    const mockWakuNodeBob = new MockWakuNode(commonEventEmitter);
    const reliableChannelBob = await ReliableChannel.create(
      mockWakuNodeBob,
      "MyChannel",
      "bob",
      encoder,
      decoder,
      {
        retryIntervalMs: 0, // disable any automation to better control the test
        syncMinIntervalMs: 0,
        processTaskMinElapseMs: 10
      }
    );

    // Some sync messages are exchanged
    await reliableChannelAlice["sendSyncMessage"]();
    await reliableChannelBob["sendSyncMessage"]();

    // Wait for Bob to receive "some message" to ensure sync messages were processed
    const bobReceivedSomeMessagePromise = waitForEvent<IDecodedMessage>(
      reliableChannelBob,
      "message-received",
      (msg) => bytesToUtf8(msg.payload) === "some message"
    );

    // Some content messages are exchanged too
    reliableChannelAlice.send(utf8ToBytes("some message"));
    reliableChannelBob.send(utf8ToBytes("some other message"));

    // Wait for the "some message" to be received to ensure messages are processed
    await bobReceivedSomeMessagePromise;

    // At this point, the message shouldn't be acknowledged yet as Bob
    // does not have a complete log
    expect(messageAcknowledged).to.be.false;

    // Now Alice resends the message
    const bobReceivedMessagePromise = waitForEvent<IDecodedMessage>(
      reliableChannelBob,
      "message-received",
      (msg) => bytesToUtf8(msg.payload) === "message to be acknowledged"
    );

    reliableChannelAlice.send(message);

    // Wait for Bob to receive the message
    await bobReceivedMessagePromise;

    // Set up promise waiter for acknowledgment before Bob sends sync
    const messageAcknowledgedPromise = waitForEvent<string>(
      reliableChannelAlice,
      "message-acknowledged",
      (id) => id === messageId
    );

    // Bob receives it, and should include it in its sync
    await reliableChannelBob["sendSyncMessage"]();

    // Wait for acknowledgment
    await messageAcknowledgedPromise;
  });
});
