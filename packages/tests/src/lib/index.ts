import { ContentTopic, IDecodedMessage } from "@waku/interfaces";
import { isAutoShardingRoutingInfo, Logger, RoutingInfo } from "@waku/utils";
import { expect } from "chai";

import { Args, MessageRpcQuery, MessageRpcResponse } from "../types.js";
import { delay, makeLogFileName } from "../utils/index.js";

import { MessageCollector } from "./message_collector.js";
import { runNodes } from "./runNodes.js";
import { defaultArgs, ServiceNode } from "./service_node.js";

export { ServiceNode, MessageCollector, defaultArgs };
export { runNodes };

const log = new Logger("test:message-collector");

/**
 * This class is a wrapper over the ServiceNode & MessageCollector class
 * that allows for the creation & handling of multiple ServiceNodes
 */
export class ServiceNodesFleet {
  public static async createAndRun(
    mochaContext: Mocha.Context,
    nodesToCreate: number = 3,
    strictChecking: boolean = false,
    routingInfo: RoutingInfo,
    _args?: Args,
    withoutFilter = false
  ): Promise<ServiceNodesFleet> {
    const nodes: ServiceNode[] = [];

    for (let i = 0; i < nodesToCreate; i++) {
      const node = new ServiceNode(
        makeLogFileName(mochaContext) + Math.random().toString(36).substring(7)
      );

      const args = applyDefaultArgs(routingInfo, _args);

      if (nodes[0]) {
        const addr = await nodes[0].getExternalMultiaddr();
        args.staticnode = addr ?? args.staticnode;
      }

      await node.start(args, {
        retries: 3
      });

      nodes.push(node);
    }

    return new ServiceNodesFleet(nodes, withoutFilter, strictChecking);
  }

  /**
   * Convert a [[WakuMessage]] to a [[WakuRelayMessage]]. The latter is used
   * by the nwaku JSON-RPC API.
   */
  public static toMessageRpcQuery(message: {
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

  public async start(): Promise<void> {
    const startPromises = this.nodes.map((node) => node.start());
    await Promise.all(startPromises);
  }

  public async sendRelayMessage(
    message: MessageRpcQuery,
    routingInfo: RoutingInfo
  ): Promise<boolean> {
    const relayMessagePromises: Promise<boolean>[] = this.nodes.map((node) =>
      node.sendMessage(message, routingInfo)
    );
    const relayMessages = await Promise.all(relayMessagePromises);
    return relayMessages.every((message) => message);
  }

  /**
   * This is a dodgy things to do as it assumes the nwaku node did not flush
   * any messages from its cache.
   */
  public async confirmMessageLength(numMessages: number): Promise<void> {
    if (this.strictChecking) {
      await Promise.all(
        this.nodes.map(async (node) =>
          expect(await node.messages()).to.have.length(numMessages)
        )
      );
    } else {
      // Wait for all promises to resolve and check if any meets the condition
      const results = await Promise.all(
        this.nodes.map(async (node) => {
          const msgs = await node.messages();
          return msgs.length === numMessages;
        })
      );

      // Check if at least one result meets the condition
      const conditionMet = results.some((result) => result);
      expect(conditionMet).to.be.true;
    }
  }
}

class MultipleNodesMessageCollector {
  public callback: (msg: Partial<IDecodedMessage>) => void = () => {};
  protected messageList: Array<Partial<IDecodedMessage>> = [];
  public constructor(
    private messageCollectors: MessageCollector[],
    private relayNodes?: ServiceNode[],
    private strictChecking: boolean = false
  ) {
    this.callback = (msg: Partial<IDecodedMessage>): void => {
      log.info("Got a message");
      this.messageList.push(msg);
    };
  }

  public get count(): number {
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

  public getMessage(
    index: number
  ): MessageRpcResponse | Partial<IDecodedMessage> {
    return this.messageList[index];
  }

  /**
   * Verifies a received message against expected values on all nodes.
   * Returns true if any node's collector verifies the message successfully.
   */
  public verifyReceivedMessage(
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
  public async waitForMessages(
    numMessages: number,
    options?: {
      timeoutDuration?: number;
      exact?: boolean;
      contentTopic?: ContentTopic;
    }
  ): Promise<boolean> {
    const startTime = Date.now();
    const timeoutDuration = options?.timeoutDuration || 400;
    const exact = options?.exact || false;

    while (this.messageList.length < numMessages) {
      if (this.relayNodes) {
        if (this.strictChecking) {
          const results = await Promise.all(
            this.relayNodes.map(async (node) => {
              const msgs = await node.messages(options?.contentTopic);
              return msgs.length >= numMessages;
            })
          );
          return results.every((result) => result);
        } else {
          const results = await Promise.all(
            this.relayNodes.map(async (node) => {
              const msgs = await node.messages(options?.contentTopic);
              return msgs.length >= numMessages;
            })
          );
          return results.some((result) => result);
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

function applyDefaultArgs(routingInfo: RoutingInfo, args?: Args): Args {
  const defaultArgs: Args = {
    lightpush: true,
    filter: true,
    discv5Discovery: true,
    peerExchange: true,
    relay: true
  };

  defaultArgs.clusterId = routingInfo.clusterId;

  if (isAutoShardingRoutingInfo(routingInfo)) {
    defaultArgs.numShardsInNetwork =
      routingInfo.networkConfig.numShardsInCluster;

    defaultArgs.contentTopic = [routingInfo.contentTopic];
  } else {
    defaultArgs.numShardsInNetwork = 0;
    defaultArgs.shard = [routingInfo.shardId];
  }

  return { ...defaultArgs, ...args };
}
