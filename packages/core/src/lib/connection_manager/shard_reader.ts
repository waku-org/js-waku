import type { PeerId } from "@libp2p/interface";
import type {
  ClusterId,
  NetworkConfig,
  PubsubTopic,
  RelayShards,
  ShardId
} from "@waku/interfaces";
import {
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
  isPeerOnCluster(id: PeerId): Promise<boolean>;
  isPeerOnShard(
    id: PeerId,
    clusterId: ClusterId,
    shard: ShardId
  ): Promise<boolean>;
  isPeerOnTopic(id: PeerId, pubsubTopic: PubsubTopic): Promise<boolean>;
}

/**
 * This class is responsible for reading the shard info from the libp2p peer store or from the current node's network config.
 */
export class ShardReader implements IShardReader {
  private readonly libp2p: Libp2p;

  private readonly clusterId: ClusterId;

  public constructor(options: ShardReaderConstructorOptions) {
    this.libp2p = options.libp2p;

    this.clusterId = options.networkConfig.clusterId;
  }

  public async isPeerOnCluster(id: PeerId): Promise<boolean> {
    const peerRelayShards = await this.getRelayShards(id);

    if (!peerRelayShards) {
      return false;
    }

    return peerRelayShards.clusterId === this.clusterId;
  }

  public async hasShardInfo(id: PeerId): Promise<boolean> {
    const shardInfo = await this.getRelayShards(id);
    return !!shardInfo;
  }

  public async isPeerOnTopic(
    id: PeerId,
    pubsubTopic: PubsubTopic
  ): Promise<boolean> {
    try {
      const { clusterId, shard } = pubsubTopicToSingleShardInfo(pubsubTopic);
      return await this.isPeerOnShard(id, clusterId, shard);
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
    clusterId: ClusterId,
    shard: ShardId
  ): Promise<boolean> {
    const peerShardInfo = await this.getRelayShards(id);
    log.info(
      `Checking if peer on same shard: this { clusterId: ${clusterId}, shardId: ${shard} },` +
        `${id} { clusterId: ${peerShardInfo?.clusterId}, shards: ${peerShardInfo?.shards} }`
    );
    if (!peerShardInfo) {
      return false;
    }

    return (
      peerShardInfo.clusterId === clusterId &&
      peerShardInfo.shards.includes(shard)
    );
  }

  private async getRelayShards(id: PeerId): Promise<RelayShards | undefined> {
    try {
      const peer = await this.libp2p.peerStore.get(id);

      const shardInfoBytes = peer.metadata.get("shardInfo");

      if (!shardInfoBytes) {
        return undefined;
      }

      return decodeRelayShard(shardInfoBytes);
    } catch (error) {
      log.error(`Error getting shard info for ${id}`, error);
      return undefined;
    }
  }
}
