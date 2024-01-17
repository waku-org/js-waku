import { DecodedMessage } from "@waku/core";
import {
  DefaultPubsubTopic,
  PubsubTopic,
  ShardingParams
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { expect } from "chai";

import { Args, MessageRpcQuery, MessageRpcResponse } from "../types";
import { delay, makeLogFileName } from "../utils/index.js";

import { MessageCollector } from "./message_collector.js";
import { defaultArgs, ServiceNode } from "./service_node.js";

export { ServiceNode, MessageCollector, defaultArgs };

const log = new Logger("test:message-collector");

/**
 * This class is a wrapper over the ServiceNode & MessageCollector class
 * that allows for the creation & handling of multiple ServiceNodes
 */
export class ServiceNodes {
  static async createAndRun(
    mochaContext: Mocha.Context,
    pubsubTopics: PubsubTopic[],
    nodesToCreate: number = 3,
    strictChecking: boolean = false,
    shardInfo?: ShardingParams,
    _args?: Args,
    relay = false
  ): Promise<ServiceNodes> {
    const serviceNodePromises = Array.from(
      { length: nodesToCreate },
      async () => {
        const node = new ServiceNode(
          makeLogFileName(mochaContext) +
            Math.random().toString(36).substring(7)
        );

        const args = getArgs(pubsubTopics, shardInfo, _args);
        await node.start(args, {
          retries: 3
        });

        return node;
      }
    );

    const nodes = await Promise.all(serviceNodePromises);
    return new ServiceNodes(nodes, relay, strictChecking);
  }

  /**
   * Convert a [[WakuMessage]] to a [[WakuRelayMessage]]. The latter is used
   * by the nwaku JSON-RPC API.
   */
  static toMessageRpcQuery(message: {
    payload: Uint8Array;
    contentTopic: string;
    timestamp?: Date;
  }): MessageRpcQuery {
    return ServiceNode.toMessageRpcQuery(message);
  }

  public messageCollector: MultipleNodesMessageCollector;
  private constructor(
    public nodes: ServiceNode[],
    relay: boolean,
    private strictChecking: boolean
  ) {
    const _messageCollectors: MessageCollector[] = [];
    this.nodes.forEach((node) => {
      _messageCollectors.push(new MessageCollector(node));
    });
    this.messageCollector = new MultipleNodesMessageCollector(
      _messageCollectors,
      relay ? this.nodes : undefined,
      strictChecking
    );
  }

  get type(): "go-waku" | "nwaku" {
    const nodeType = new Set(
      this.nodes.map((node) => {
        return node.type();
      })
    );
    if (nodeType.size > 1) {
      throw new Error("Multiple node types");
    }
    return nodeType.values().next().value;
  }

  async start(): Promise<void> {
    const startPromises = this.nodes.map((node) => node.start());
    await Promise.all(startPromises);
  }

  async sendRelayMessage(
    message: MessageRpcQuery,
    pubsubTopic?: string,
    raw = false
  ): Promise<boolean> {
    let relayMessagePromises: Promise<boolean>[];
    if (raw) {
      relayMessagePromises = this.nodes.map((node) =>
        node.rpcCall<boolean>("post_waku_v2_relay_v1_message", [
          pubsubTopic && pubsubTopic,
          message
        ])
      );
    } else {
      relayMessagePromises = this.nodes.map((node) =>
        node.sendMessage(message, pubsubTopic)
      );
    }
    const relayMessages = await Promise.all(relayMessagePromises);
    return relayMessages.every((message) => message);
  }

  async confirmMessageLength(numMessages: number): Promise<void> {
    if (this.strictChecking) {
      await Promise.all(
        this.nodes.map(async (node) =>
          expect(await node.messages()).to.have.length(numMessages)
        )
      );
    } else {
      await Promise.race(
        this.nodes.map(async (node) =>
          expect(await node.messages()).to.have.length(numMessages)
        )
      );
    }
  }
}

class MultipleNodesMessageCollector {
  callback: (msg: DecodedMessage) => void = () => {};
  messageList: Array<DecodedMessage> = [];
  constructor(
    private messageCollectors: MessageCollector[],
    private relayNodes?: ServiceNode[],
    private strictChecking: boolean = false
  ) {
    this.callback = (msg: DecodedMessage): void => {
      log.info("Got a message");
      this.messageList.push(msg);
    };
  }

  get count(): number {
    return this.messageList.length;
  }

  public hasMessage(topic: string, text: string): boolean {
    if (this.strictChecking) {
      return this.messageCollectors.every((collector) =>
        collector.hasMessage(topic, text)
      );
    } else {
      return this.messageCollectors.some((collector) =>
        collector.hasMessage(topic, text)
      );
    }
  }

  getMessage(index: number): MessageRpcResponse | DecodedMessage {
    return this.messageList[index];
  }

  /**
   * Verifies a received message against expected values on all nodes.
   * Returns true if any node's collector verifies the message successfully.
   */
  verifyReceivedMessage(
    index: number,
    options: {
      expectedMessageText: string | Uint8Array | undefined;
      expectedContentTopic?: string;
      expectedPubsubTopic?: string;
      expectedVersion?: number;
      expectedMeta?: Uint8Array;
      expectedEphemeral?: boolean;
      expectedTimestamp?: bigint | number;
      checkTimestamp?: boolean;
    }
  ): boolean {
    if (this.strictChecking) {
      return this.messageCollectors.every((collector) => {
        try {
          collector.verifyReceivedMessage(index, options);
          return true; // Verification successful
        } catch (error) {
          return false; // Verification failed, continue with the next collector
        }
      });
    } else {
      return this.messageCollectors.some((collector) => {
        try {
          collector.verifyReceivedMessage(index, options);
          return true; // Verification successful
        } catch (error) {
          return false; // Verification failed, continue with the next collector
        }
      });
    }
  }

  /**
   * Waits for a total number of messages across all nodes.
   */
  async waitForMessages(
    numMessages: number,
    options?: {
      pubsubTopic?: string;
      timeoutDuration?: number;
      exact?: boolean;
    }
  ): Promise<boolean> {
    const startTime = Date.now();
    const pubsubTopic = options?.pubsubTopic || DefaultPubsubTopic;
    const timeoutDuration = options?.timeoutDuration || 400;
    const exact = options?.exact || false;

    while (this.messageList.length < numMessages) {
      if (this.relayNodes) {
        if (this.strictChecking) {
          this.relayNodes.every(async (node) => {
            const msgs = await node.messages(pubsubTopic);
            if (msgs.length >= numMessages) return true;
            return false;
          });
        } else {
          for (const node of this.relayNodes) {
            const msgs = await node.messages(pubsubTopic);
            if (msgs.length >= numMessages) return true;
          }
        }
      }

      if (Date.now() - startTime > timeoutDuration * numMessages) {
        return false;
      }

      await delay(10);
    }

    if (exact) {
      if (this.messageList.length == numMessages) {
        return true;
      } else {
        log.warn(
          `Was expecting exactly ${numMessages} messages. Received: ${this.messageList.length}`
        );

        return false;
      }
    } else {
      return true;
    }
  }
}

function getArgs(
  pubsubTopics: PubsubTopic[],
  shardInfo?: ShardingParams,
  args?: Args
): Args {
  const defaultArgs = {
    lightpush: true,
    filter: true,
    discv5Discovery: true,
    peerExchange: true,
    relay: true,
    pubsubTopic: pubsubTopics,
    ...(shardInfo && { clusterId: shardInfo.clusterId })
  } as Args;

  return { ...defaultArgs, ...args };
}
