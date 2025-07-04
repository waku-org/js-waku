import type { PeerId } from "@libp2p/interface";
import type {
  NetworkConfig,
  PubsubTopic,
  ShardInfo,
  SingleShardInfo,
  StaticSharding
} from "@waku/interfaces";
import {
  contentTopicToShardIndex,
  decodeRelayShard,
  Logger,
  pubsubTopicToSingleShardInfo
} from "@waku/utils";
import { Libp2p } from "libp2p";

const log = new Logger("shard-reader");

type ShardReaderConstructorOptions = {
  libp2p: Libp2p;
  networkConfig: NetworkConfig;
};

interface IShardReader {
  hasShardInfo(id: PeerId): Promise<boolean>;
  isPeerOnNetwork(id: PeerId): Promise<boolean>;
  isPeerOnShard(id: PeerId, shard: SingleShardInfo): Promise<boolean>;
  isPeerOnTopic(id: PeerId, pubsubTopic: PubsubTopic): Promise<boolean>;
}

export class ShardReader implements IShardReader {
  private readonly libp2p: Libp2p;

  private readonly staticShard: StaticSharding;

  public constructor(options: ShardReaderConstructorOptions) {
    this.libp2p = options.libp2p;

    this.staticShard = this.getStaticShardFromNetworkConfig(
      options.networkConfig
    );
  }

  public async isPeerOnNetwork(id: PeerId): Promise<boolean> {
    const shardInfo = await this.getShardInfo(id);

    if (!shardInfo) {
      return false;
    }

    const clusterMatch = shardInfo.clusterId === this.staticShard.clusterId;
    const shardOverlap = this.staticShard.shards.some((s) =>
      shardInfo.shards.includes(s)
    );

    return clusterMatch && shardOverlap;
  }

  public async hasShardInfo(id: PeerId): Promise<boolean> {
    const shardInfo = await this.getShardInfo(id);
    return !!shardInfo;
  }

  public async isPeerOnTopic(
    id: PeerId,
    pubsubTopic: PubsubTopic
  ): Promise<boolean> {
    try {
      const shardInfo = pubsubTopicToSingleShardInfo(pubsubTopic);
      return await this.isPeerOnShard(id, shardInfo);
    } catch (error) {
      log.error(
        `Error comparing pubsub topic ${pubsubTopic} with shard info for ${id}`,
        error
      );
      return false;
    }
  }

  public async isPeerOnShard(
    id: PeerId,
    shard: SingleShardInfo
  ): Promise<boolean> {
    const peerShardInfo = await this.getShardInfo(id);

    if (!peerShardInfo || !shard.shard) {
      return false;
    }

    return (
      peerShardInfo.clusterId === shard.clusterId &&
      peerShardInfo.shards.includes(shard.shard)
    );
  }

  private async getShardInfo(id: PeerId): Promise<ShardInfo | undefined> {
    try {
      const peer = await this.libp2p.peerStore.get(id);

      const shardInfoBytes = peer.metadata.get("shardInfo");

      if (!shardInfoBytes) {
        return undefined;
      }

      const decodedShardInfo = decodeRelayShard(shardInfoBytes);

      return decodedShardInfo;
    } catch (error) {
      log.error(`Error getting shard info for ${id}`, error);
      return undefined;
    }
  }

  private getStaticShardFromNetworkConfig(
    networkConfig: NetworkConfig
  ): StaticSharding {
    if ("shards" in networkConfig) {
      return networkConfig;
    }

    const shards = networkConfig.contentTopics.map((topic) =>
      contentTopicToShardIndex(topic)
    );

    return {
      clusterId: networkConfig.clusterId!,
      shards
    };
  }
}
