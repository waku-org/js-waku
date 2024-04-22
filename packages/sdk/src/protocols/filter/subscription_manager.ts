import { FilterCore } from "@waku/core";
import { PubsubTopic } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { Subscription } from "./subscription";

const log = new Logger("sdk:filter:subscription-manager");

export class SubscriptionManager {
  private static instance: SubscriptionManager;

  static createInstance(protocol: FilterCore): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager(protocol);
    }
    return SubscriptionManager.instance;
  }

  private subscriptions: Map<string, Subscription>;
  private constructor(private protocol: FilterCore) {
    log.info("Creating SubscriptionManager instance.");
    this.subscriptions = new Map();
  }

  getSubscription(pubsubTopic: PubsubTopic): Subscription | undefined {
    return this.subscriptions.get(pubsubTopic);
  }

  setSubscription(
    pubsubTopic: PubsubTopic,
    subscription: Subscription
  ): Subscription {
    this.subscriptions.set(pubsubTopic, subscription);
    return subscription;
  }

  async getOrCreate(pubsubTopic: PubsubTopic): Promise<Subscription> {
    const subscription = this.getSubscription(pubsubTopic);
    if (subscription) {
      return subscription;
    }

    log.info("Creating filter subscription.");

    const peers = await this.protocol.getPeers();
    if (peers.length === 0) {
      throw new Error("No peer found to initiate subscription.");
    }
    log.info(
      `Created filter subscription with ${peers.length} peers: `,
      peers.map((peer) => peer.id.toString())
    );

    const newSubscription = new Subscription(pubsubTopic, peers, this.protocol);
    return this.setSubscription(pubsubTopic, newSubscription);
  }
}
