/**
 * Common test patterns and helpers to reduce repetitive test code
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from "chai";

import { ServiceNodesFleet } from "../lib/index.js";

import { TestUtilities } from "./utilities-factory.js";

/**
 * Common interface for test node setup
 */
export interface TestNodeSetup {
  serviceNodes: ServiceNodesFleet;
  waku: any; // LightNode or RelayNode
}

/**
 * Standard message verification pattern
 */
export function verifyMessage(
  messageCollector: any,
  messageIndex: number,
  utilities: TestUtilities,
  customText?: string
): void {
  const expectedText = customText || utilities.config.messageText;

  messageCollector.verifyReceivedMessage(messageIndex, {
    expectedMessageText: expectedText,
    expectedContentTopic: utilities.config.contentTopic,
    expectedPubsubTopic: utilities.routingInfo.pubsubTopic
  });
}

/**
 * Standard test pattern for sending and receiving a single message
 */
export async function testSingleMessage(
  setup: TestNodeSetup,
  utilities: TestUtilities,
  customPayload?: { payload: Uint8Array }
): Promise<void> {
  const payload = customPayload || utilities.messagePayload;

  // Send message via lightPush
  await setup.waku.lightPush.send(utilities.encoder, payload);

  // Wait for message to be received
  expect(await setup.serviceNodes.messageCollector.waitForMessages(1)).to.eq(
    true
  );

  // Verify the message
  verifyMessage(setup.serviceNodes.messageCollector, 0, utilities);

  // Confirm message was stored by service nodes
  await setup.serviceNodes.confirmMessageLength(1);
}

/**
 * Standard test pattern for sending multiple messages
 */
export async function testMultipleMessages(
  setup: TestNodeSetup,
  utilities: TestUtilities,
  messageCount: number,
  messageGenerator?: (index: number) => string
): Promise<void> {
  const generateMessage = messageGenerator || ((i: number) => `Message ${i}`);

  // Send multiple messages
  for (let i = 0; i < messageCount; i++) {
    const messageText = generateMessage(i);
    await setup.waku.lightPush.send(utilities.encoder, {
      payload: new TextEncoder().encode(messageText)
    });
  }

  // Wait for all messages to be received
  expect(
    await setup.serviceNodes.messageCollector.waitForMessages(messageCount)
  ).to.eq(true);

  // Verify all messages
  for (let i = 0; i < messageCount; i++) {
    const expectedText = generateMessage(i);
    verifyMessage(
      setup.serviceNodes.messageCollector,
      i,
      utilities,
      expectedText
    );
  }
}

/**
 * Standard subscription test pattern
 */
export async function testSubscription(
  setup: TestNodeSetup,
  utilities: TestUtilities
): Promise<void> {
  // Subscribe to messages
  await setup.waku.filter.subscribe(
    utilities.decoder,
    setup.serviceNodes.messageCollector.callback
  );

  // Test single message
  await testSingleMessage(setup, utilities);
}

/**
 * Common connection verification pattern
 */
export function verifyConnections(waku: any, expectedCount: number): void {
  expect(waku.libp2p.getConnections()).has.length(expectedCount);
}

/**
 * Helper to create test suite description
 */
export function createTestSuiteDescription(
  protocolName: string,
  testType: string,
  additionalInfo?: string
): string {
  const parts = [`Waku ${protocolName}`, testType];
  if (additionalInfo) {
    parts.push(additionalInfo);
  }
  return parts.join(": ");
}

/**
 * Store-specific pattern: Send multiple messages with sequential payloads
 * Extracted from store/utils.ts to make it reusable
 */
export async function sendSequentialMessages(
  serviceNode: any, // ServiceNode
  numMessages: number,
  utilities: TestUtilities,
  timestamp: boolean = false
): Promise<any[]> {
  // Promise<MessageRpcQuery[]>
  const messages: any[] = new Array(numMessages);

  for (let i = 0; i < numMessages; i++) {
    messages[i] = {
      payload: new Uint8Array([i]),
      contentTopic: utilities.config.contentTopic,
      timestamp: timestamp ? new Date() : undefined
    };

    // Convert to RPC query format (placeholder for actual implementation)
    const rpcQuery = serviceNode.toMessageRpcQuery
      ? serviceNode.toMessageRpcQuery(messages[i])
      : messages[i];

    expect(
      await serviceNode.sendMessage(rpcQuery, utilities.routingInfo)
    ).to.eq(true);

    // Small delay to ensure unique timestamps
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  return messages;
}

/**
 * Store-specific pattern: Process queried messages from store
 * Extracted from store/utils.ts to make it reusable
 */
export async function processQueriedMessages(
  lightNode: any, // LightNode
  decoders: any[], // Array<Decoder>
  expectedTopic?: string
): Promise<any[]> {
  // Promise<DecodedMessage[]>
  const localMessages: any[] = [];

  // Placeholder implementation for when store is available
  if (lightNode.store?.queryGenerator) {
    for await (const query of lightNode.store.queryGenerator(decoders)) {
      for await (const msg of query) {
        if (msg) {
          if (expectedTopic) {
            expect(msg.pubsubTopic).to.eq(expectedTopic);
          }
          localMessages.push(msg);
        }
      }
    }
  }

  return localMessages;
}
