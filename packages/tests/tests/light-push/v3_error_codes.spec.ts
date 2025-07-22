import { LightPushError } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";
import { TestEncoder, TestShardInfo } from "../light-push/utils.js";

describe("LightPush v3 Error Code Handling", function () {
  this.timeout(30000);

  describe("Protocol Version Detection", function () {
    it("should detect v3 protocol when statusCode is present", async function () {
      // This test verifies that v3 protocols are detected correctly
      const numServiceNodes = 1;
      let waku: any;
      let serviceNodes: ServiceNodesFleet | undefined;

      try {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true },
          false, // strictNodeCheck
          numServiceNodes,
          true
        );

        // Get supported versions
        const supportedVersions = waku.lightPush.supportedVersions;
        expect(supportedVersions).to.include.members(["v2", "v3"]);

        // Get supported codecs
        const multicodecs = waku.lightPush.multicodecs;
        expect(multicodecs).to.have.length.greaterThan(1);
        expect(multicodecs.some((codec: string) => codec.includes("3.0.0"))).to
          .be.true;
        expect(multicodecs.some((codec: string) => codec.includes("2.0.0"))).to
          .be.true;
      } finally {
        if (serviceNodes && waku) {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        }
      }
    });
  });

  describe("Error Code Mapping", function () {
    it("should return v3 status codes for v3 peer failures", async function () {
      const numServiceNodes = 1;
      let waku: any;
      let serviceNodes: ServiceNodesFleet | undefined;

      try {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true },
          false, // strictNodeCheck
          numServiceNodes,
          true
        );

        // Test with empty payload to trigger error
        const result = await waku.lightPush.send(TestEncoder, {
          payload: new Uint8Array() // Empty payload should trigger error
        });

        expect(result.failures).to.have.length.greaterThan(0);

        const failure = result.failures[0];
        expect(failure.error).to.equal(LightPushError.EMPTY_PAYLOAD);

        // Should have protocol version information
        expect(failure.protocolVersion).to.exist;
        expect(["v2", "v3"]).to.include(failure.protocolVersion);

        // Should have protocol version tracking
        expect(result.protocolVersions).to.exist;
        expect(Object.keys(result.protocolVersions)).to.have.length.greaterThan(
          0
        );
      } finally {
        if (serviceNodes && waku) {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        }
      }
    });

    it("should provide detailed error information for v3 failures", async function () {
      const numServiceNodes = 1;
      let waku: any;
      let serviceNodes: ServiceNodesFleet | undefined;

      try {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true },
          false, // strictNodeCheck
          numServiceNodes,
          true
        );

        // Test with oversized payload to trigger size error
        const largePayload = new Uint8Array(2 * 1024 * 1024); // 2MB payload
        const result = await waku.lightPush.send(TestEncoder, {
          payload: largePayload
        });

        expect(result.failures).to.have.length.greaterThan(0);

        const failure = result.failures[0];
        expect(failure.error).to.equal(LightPushError.SIZE_TOO_BIG);
        expect(failure.protocolVersion).to.exist;
        expect(failure.peerId).to.exist;
      } finally {
        if (serviceNodes && waku) {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        }
      }
    });
  });

  describe("Protocol Version Tracking", function () {
    it("should track protocol versions for both successes and failures", async function () {
      const numServiceNodes = 2;
      let waku: any;
      let serviceNodes: ServiceNodesFleet | undefined;

      try {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true },
          false, // strictNodeCheck
          numServiceNodes,
          true
        );

        // Send a valid message
        const result = await waku.lightPush.send(TestEncoder, {
          payload: utf8ToBytes("test message")
        });

        // Should have protocol version tracking
        expect(result.protocolVersions).to.exist;
        expect(Object.keys(result.protocolVersions)).to.have.length.greaterThan(
          0
        );

        // Each peer should have a tracked protocol version
        Object.values(result.protocolVersions).forEach((version: any) => {
          expect(["v2", "v3", "unknown"]).to.include(version);
        });
      } finally {
        if (serviceNodes && waku) {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        }
      }
    });
  });

  describe("Backward Compatibility", function () {
    it("should maintain backward compatibility with v2 error responses", async function () {
      // This test ensures that v2 errors are still handled correctly
      // and mapped to appropriate v3 equivalents when needed
      const numServiceNodes = 1;
      let waku: any;
      let serviceNodes: ServiceNodesFleet | undefined;

      try {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          TestShardInfo,
          { lightpush: true },
          false, // strictNodeCheck
          numServiceNodes,
          true
        );

        // Test with a scenario that might trigger v2 error handling
        const result = await waku.lightPush.send(TestEncoder, {
          payload: new Uint8Array() // Empty payload
        });

        expect(result.failures).to.have.length.greaterThan(0);

        const failure = result.failures[0];
        expect(failure.error).to.equal(LightPushError.EMPTY_PAYLOAD);

        // Should have protocol version even for v2 responses
        expect(failure.protocolVersion).to.exist;

        // The error should be properly mapped regardless of protocol version
        expect(Object.values(LightPushError)).to.include(failure.error);
      } finally {
        if (serviceNodes && waku) {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        }
      }
    });
  });
});
