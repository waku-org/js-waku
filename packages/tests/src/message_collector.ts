import { DecodedMessage, DefaultPubSubTopic } from "@waku/core";
import { bytesToUtf8 } from "@waku/utils/bytes";
import { AssertionError, expect } from "chai";
import debug from "debug";

import { MessageRpcResponse } from "./node/interfaces.js";

import { base64ToUtf8, delay, NimGoNode } from "./index.js";

const log = debug("waku:test");

/**
 * Class responsible for collecting messages.
 * It provides utility methods to interact with the collected messages,
 * and offers a way to wait for incoming messages.
 */
export class MessageCollector {
  list: Array<MessageRpcResponse | DecodedMessage> = [];
  callback: (msg: DecodedMessage) => void = () => {};

  constructor(private nwaku?: NimGoNode) {
    if (!this.nwaku) {
      this.callback = (msg: DecodedMessage): void => {
        log("Got a message");
        this.list.push(msg);
      };
    }
  }

  get count(): number {
    return this.list.length;
  }

  getMessage(index: number): MessageRpcResponse | DecodedMessage {
    return this.list[index];
  }

  hasMessage(topic: string, text: string): boolean {
    return this.list.some(
      (message) => message.contentTopic === topic && message.payload === text
    );
  }

  // Type guard to determine if a message is of type MessageRpcResponse
  isMessageRpcResponse(
    message: MessageRpcResponse | DecodedMessage
  ): message is MessageRpcResponse {
    return (
      ("payload" in message && typeof message.payload === "string") ||
      !!this.nwaku
    );
  }

  async waitForMessages(
    numMessages: number,
    options?: {
      pubSubTopic?: string;
      timeoutDuration?: number;
      exact?: boolean;
    }
  ): Promise<boolean> {
    const startTime = Date.now();
    const pubSubTopic = options?.pubSubTopic || DefaultPubSubTopic;
    const timeoutDuration = options?.timeoutDuration || 400;
    const exact = options?.exact || false;

    while (this.count < numMessages) {
      if (this.nwaku) {
        try {
          this.list = await this.nwaku.messages(pubSubTopic);
        } catch (error) {
          log(`Can't retrieve messages because of ${error}`);
          await delay(10);
        }
      }

      if (Date.now() - startTime > timeoutDuration * numMessages) {
        return false;
      }

      await delay(10);
    }

    if (exact) {
      if (this.count == numMessages) {
        return true;
      } else {
        log(`Was expecting exactly ${numMessages} messages`);
        return false;
      }
    } else {
      return true;
    }
  }

  // Verifies a received message against expected values.
  verifyReceivedMessage(
    index: number,
    options: {
      expectedMessageText: string | Uint8Array | undefined;
      expectedContentTopic?: string;
      expectedPubSubTopic?: string;
      expectedVersion?: number;
      expectedMeta?: Uint8Array;
      expectedEphemeral?: boolean;
      expectedTimestamp?: bigint;
      checkTimestamp?: boolean; // Used to determine if we need to check the timestamp
    }
  ): void {
    expect(this.list.length).to.be.greaterThan(
      index,
      `The message list does not have a message at index ${index}`
    );

    const message = this.getMessage(index);
    expect(message.contentTopic).to.eq(
      options.expectedContentTopic,
      `Message content topic mismatch. Expected: ${options.expectedContentTopic}. Got: ${message.contentTopic}`
    );

    expect(message.version).to.eq(
      options.expectedVersion || 0,
      `Message version mismatch. Expected: ${
        options.expectedVersion || 0
      }. Got: ${message.version}`
    );

    if (message.ephemeral !== undefined) {
      expect(message.ephemeral).to.eq(
        options.expectedEphemeral !== undefined
          ? options.expectedEphemeral
          : false,
        `Message ephemeral value mismatch. Expected: ${
          options.expectedEphemeral !== undefined
            ? options.expectedEphemeral
            : false
        }. Got: ${message.ephemeral}`
      );
    }

    if (this.isMessageRpcResponse(message)) {
      // nwaku message specific assertions
      const receivedMessageText = message.payload
        ? base64ToUtf8(message.payload)
        : undefined;

      expect(receivedMessageText).to.eq(
        options.expectedMessageText,
        `Message text mismatch. Expected: ${options.expectedMessageText}. Got: ${receivedMessageText}`
      );

      if (message.timestamp) {
        // In we send timestamp in the request we assert that it matches the timestamp in the response +- 1 sec
        // We take the 1s deviation because there are some ms diffs in timestamps, probably because of conversions
        if (options.expectedTimestamp !== undefined) {
          const lowerBound =
            BigInt(options.expectedTimestamp) - BigInt(1000000000);
          const upperBound =
            BigInt(options.expectedTimestamp) + BigInt(1000000000);

          if (
            message.timestamp < lowerBound ||
            message.timestamp > upperBound
          ) {
            throw new AssertionError(
              `Message timestamp not within the expected range. Expected between: ${lowerBound} and ${upperBound}. Got: ${message.timestamp}`
            );
          }
        }
        // In we don't send timestamp in the request we assert that the timestamp in the response is between now and (now-10s)
        else {
          const now = BigInt(Date.now()) * BigInt(1_000_000);
          const tenSecondsAgo = now - BigInt(10_000_000_000);

          if (message.timestamp < tenSecondsAgo || message.timestamp > now) {
            throw new AssertionError(
              `Message timestamp not within the expected range. Expected between: ${tenSecondsAgo} and ${now}. Got: ${message.timestamp}`
            );
          }
        }
      }
    } else {
      // js-waku message specific assertions
      expect(message.pubSubTopic).to.eq(
        options.expectedPubSubTopic || DefaultPubSubTopic,
        `Message pub/sub topic mismatch. Expected: ${
          options.expectedPubSubTopic || DefaultPubSubTopic
        }. Got: ${message.pubSubTopic}`
      );

      expect(bytesToUtf8(message.payload)).to.eq(
        options.expectedMessageText,
        `Message text mismatch. Expected: ${
          options.expectedMessageText
        }. Got: ${bytesToUtf8(message.payload)}`
      );

      const shouldCheckTimestamp =
        options.checkTimestamp !== undefined ? options.checkTimestamp : true;
      if (shouldCheckTimestamp && message.timestamp) {
        const now = Date.now();
        const tenSecondsAgo = now - 10000;
        expect(message.timestamp.getTime()).to.be.within(
          tenSecondsAgo,
          now,
          `Message timestamp not within the expected range. Expected between: ${tenSecondsAgo} and ${now}. Got: ${message.timestamp.getTime()}`
        );
      }

      expect([
        options.expectedMeta,
        undefined,
        new Uint8Array(0)
      ]).to.deep.include(
        message.meta,
        `Message meta mismatch. Expected: ${
          options.expectedMeta
            ? JSON.stringify(options.expectedMeta)
            : "undefined or " + JSON.stringify(new Uint8Array(0))
        }. Got: ${JSON.stringify(message.meta)}`
      );
    }
  }
}
