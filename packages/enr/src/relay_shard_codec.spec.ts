import { expect } from "chai";
import fc from "fast-check";

import { decodeRelayShard, encodeRelayShard } from "./relay_shard_codec.js";

describe.only("Relay Shard codec", () => {
  it("should correctly encode and decode relay shards using rs format (Index List)", () => {
    fc.assert(
      fc.property(
        fc.nat(65535), // cluster
        fc
          .array(fc.nat(1023), { minLength: 1, maxLength: 63 })
          .map((arr) => [...new Set(arr)].sort((a, b) => a - b)), // indexList
        (cluster, indexList) => {
          const shardInfo = { cluster, indexList };
          const encoded = encodeRelayShard(shardInfo);
          const decoded = decodeRelayShard(encoded);

          expect(decoded).to.deep.equal(shardInfo);
        }
      )
    );
  });

  it("should correctly encode and decode relay shards using rsv format (Bit Vector)", () => {
    fc.assert(
      fc.property(
        fc.nat(65535), // cluster
        fc
          .array(fc.nat(1023), { minLength: 64, maxLength: 1024 })
          .map((arr) => [...new Set(arr)].sort((a, b) => a - b)), // indexList
        (cluster, indexList) => {
          const shardInfo = { cluster, indexList };
          const encoded = encodeRelayShard(shardInfo);
          const decoded = decodeRelayShard(encoded);

          expect(decoded).to.deep.equal(shardInfo);
        }
      )
    );
  });
});
