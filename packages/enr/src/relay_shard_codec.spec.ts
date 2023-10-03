import { ShardInfo } from "@waku/interfaces";
import { expect } from "chai";

import { decodeRelayShard, encodeRelayShard } from "./relay_shard_codec.js.js";

describe.only("Relay Shard codec", function () {
  it("Sample", () => {
    const shardInfoSample: ShardInfo = {
      cluster: 0, // Sample cluster value
      indexList: [1, 2, 3] // Sample index list
    };

    // Encode the sample shard info
    const bytes = encodeRelayShard(shardInfoSample);

    // Decode the bytes back to shard info
    const decodedShardInfo = decodeRelayShard(bytes);

    // Check if the decoded shard info matches the original
    expect(decodedShardInfo.cluster).to.equal(shardInfoSample.cluster);
    expect(decodedShardInfo.indexList).to.deep.equal(shardInfoSample.indexList);
  });
});
