import { DecodedMessage } from "@waku/core";
import {
  DefaultPubsubTopic,
  PubsubTopic,
  ShardingParams
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { Args } from "../types";
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
    return new ServiceNodes(nodes, relay);
  }

  public messageCollector: MultipleNodesMessageCollector;
  private constructor(
    public nodes: ServiceNode[],
    relay: boolean
  ) {
    const _messageCollectors: MessageCollector[] = [];
    this.nodes.forEach((node) => {
      _messageCollectors.push(new MessageCollector(node));
    });
    this.messageCollector = new MultipleNodesMessageCollector(
      _messageCollectors,
      relay ? this.nodes : undefined
    );
  }
}

class MultipleNodesMessageCollector {
  callback: (msg: DecodedMessage) => void = () => {};
  messageList: Array<DecodedMessage> = [];
  constructor(
    private messageCollectors: MessageCollector[],
    private relayNodes?: ServiceNode[]
  ) {
    this.callback = (msg: DecodedMessage): void => {
      log.info("Got a message");
      this.messageList.push(msg);
    };
  }
  public hasMessage(topic: string, text: string): boolean {
    return this.messageCollectors.some((collector) =>
      collector.hasMessage(topic, text)
    );
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
    return this.messageCollectors.some((collector) => {
      try {
        collector.verifyReceivedMessage(index, options);
        return true; // Verification successful
      } catch (error) {
        return false; // Verification failed, continue with the next collector
      }
    });
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
        for (const node of this.relayNodes) {
          const msgs = await node.messages(pubsubTopic);
          if (msgs.length >= numMessages) return true;
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
        log.warn(`Was expecting exactly ${numMessages} messages`);
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
