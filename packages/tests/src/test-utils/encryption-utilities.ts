/**
 * Specialized utilities for encryption-based tests
 * This shows how to extend the base utilities for specific use cases
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from "chai";

// Note: These imports would be available in a real environment
// import {
//   generatePrivateKey,
//   generateSymmetricKey,
//   getPublicKey
// } from "@waku/message-encryption";

import {
  // createCustomTestUtilities, // Commented out to avoid unused import warning
  createTestUtilities,
  TestNodeSetup,
  TestUtilities,
  verifyMessage
} from "./index.js";

/**
 * Extended utilities that include encryption capabilities
 */
export interface EncryptionTestUtilities extends TestUtilities {
  ecies: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    encoder: any;
    decoder: any;
  };
  symmetric: {
    key: Uint8Array;
    encoder: any;
    decoder: any;
  };
}

/**
 * Create test utilities with encryption support
 */
export function createEncryptionTestUtilities(
  protocol: string
): EncryptionTestUtilities {
  const baseUtilities = createTestUtilities(protocol);

  // Placeholder implementations since @waku/message-encryption is not available
  // ECIES encryption setup
  const privateKey = new Uint8Array(32); // generatePrivateKey();
  const publicKey = new Uint8Array(33); // getPublicKey(privateKey);

  // Symmetric encryption setup
  const symmetricKey = new Uint8Array(32); // generateSymmetricKey();

  // These would be actual encoder/decoder implementations in real environment
  const eciesEncoder = {};
  const eciesDecoder = {};
  const symmetricEncoder = {};
  const symmetricDecoder = {};

  return {
    ...baseUtilities,
    ecies: {
      privateKey,
      publicKey,
      encoder: eciesEncoder,
      decoder: eciesDecoder
    },
    symmetric: {
      key: symmetricKey,
      encoder: symmetricEncoder,
      decoder: symmetricDecoder
    }
  };
}

/**
 * Test pattern for ECIES encrypted messages
 */
export async function testEciesMessage(
  setup: TestNodeSetup,
  utilities: EncryptionTestUtilities,
  customMessage?: string
): Promise<void> {
  const messageText = customMessage || utilities.config.messageText;

  await setup.waku.filter.subscribe(
    utilities.ecies.decoder,
    setup.serviceNodes.messageCollector.callback
  );

  await setup.waku.lightPush.send(utilities.ecies.encoder, {
    payload: new TextEncoder().encode(messageText)
  });

  // Wait for encrypted message
  const received = await setup.serviceNodes.messageCollector.waitForMessages(1);
  expect(received).to.eq(true);

  // Verify encrypted message was decrypted correctly
  verifyMessage(setup.serviceNodes.messageCollector, 0, utilities, messageText);
}

/**
 * Test pattern for symmetric encrypted messages
 */
export async function testSymmetricMessage(
  setup: TestNodeSetup,
  utilities: EncryptionTestUtilities,
  customMessage?: string
): Promise<void> {
  const messageText = customMessage || utilities.config.messageText;

  await setup.waku.filter.subscribe(
    utilities.symmetric.decoder,
    setup.serviceNodes.messageCollector.callback
  );

  await setup.waku.lightPush.send(utilities.symmetric.encoder, {
    payload: new TextEncoder().encode(messageText)
  });

  // Wait for encrypted message
  const received = await setup.serviceNodes.messageCollector.waitForMessages(1);
  expect(received).to.eq(true);

  // Verify encrypted message was decrypted correctly
  verifyMessage(setup.serviceNodes.messageCollector, 0, utilities, messageText);
}

/**
 * Build complete encryption test suite
 */
export function buildEncryptionTestSuite(protocol: string): void {
  const utilities = createEncryptionTestUtilities(protocol);

  describe(`${protocol} Encryption Tests`, function () {
    this.timeout(100000);
    let waku: any;
    let serviceNodes: any;

    // Setup and teardown would use the same patterns as base tests

    it("Send and receive ECIES encrypted message", async function () {
      await testEciesMessage({ serviceNodes, waku }, utilities);
    });

    it("Send and receive symmetric encrypted message", async function () {
      await testSymmetricMessage({ serviceNodes, waku }, utilities);
    });

    it("Mixed encryption types", async function () {
      // Test both encryption methods in sequence
      await testEciesMessage(
        { serviceNodes, waku },
        utilities,
        "ECIES message"
      );
      await testSymmetricMessage(
        { serviceNodes, waku },
        utilities,
        "Symmetric message"
      );

      // Verify we received both messages
      const totalReceived =
        await serviceNodes.messageCollector.waitForMessages(2);
      expect(totalReceived).to.eq(true);
    });
  });
}

/**
 * Usage example:
 *
 * // Instead of 100+ lines of encryption setup and test code:
 * buildEncryptionTestSuite("filter");
 *
 * // Or for custom encryption tests:
 * const encUtils = createEncryptionTestUtilities("lightpush");
 * // Use encUtils.ecies.encoder, encUtils.symmetric.decoder, etc.
 */
