import { expect } from "chai";
import fc from "fast-check";

import { decodeRelayShard, encodeRelayShard } from "./relay_shard_codec.js";

describe("Relay Shard codec", () => {
  // Boundary test case
  it("should handle a minimal index list", () => {
    const shardInfo = { clusterId: 0, shards: [0] };
    const encoded = encodeRelayShard(shardInfo);
    const decoded = decodeRelayShard(encoded);
    expect(decoded).to.deep.equal(
      shardInfo,
      "Decoded shard info does not match the original for minimal index list"
    );
  });

  // Property-based test for rs format (Index List)
  it("should correctly encode and decode relay shards using rs format (Index List)", () => {
    fc.assert(
      fc.property(
        fc.nat(65535), // cluster
        fc
          .array(fc.nat(1023), { minLength: 1, maxLength: 63 }) // indexList
          .map((arr) => [...new Set(arr)].sort((a, b) => a - b)),
        (clusterId, shards) => {
          const shardInfo = { clusterId, shards };
          const encoded = encodeRelayShard(shardInfo);
          const decoded = decodeRelayShard(encoded);

          expect(decoded).to.deep.equal(
            shardInfo,
            "Decoded shard info does not match the original for rs format"
          );
        }
      )
    );
  });

  // Property-based test for rsv format (Bit Vector)
  it("should correctly encode and decode relay shards using rsv format (Bit Vector)", () => {
    fc.assert(
      fc.property(
        fc.nat(65535), // cluster
        fc
          .array(fc.nat(1023), { minLength: 64, maxLength: 1024 }) // indexList
          .map((arr) => [...new Set(arr)].sort((a, b) => a - b)),
        (clusterId, shards) => {
          const shardInfo = { clusterId, shards };
          const encoded = encodeRelayShard(shardInfo);
          const decoded = decodeRelayShard(encoded);

          expect(decoded).to.deep.equal(
            shardInfo,
            "Decoded shard info does not match the original for rsv format"
          );
        }
      )
    );
  });

  // Error handling test case
  it("should throw an error for insufficient data", () => {
    expect(() => decodeRelayShard(new Uint8Array([0, 0]))).to.throw(
      "Insufficient data"
    );
  });
});
