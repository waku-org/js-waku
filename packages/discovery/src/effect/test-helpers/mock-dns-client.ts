import { Effect, Layer } from "effect";

import testData from "../../dns/testdata.json" assert { type: "json" };
import { DnsResolutionError } from "../services/common/errors.js";
import type { DnsClientService } from "../services/dns/dns-client.js";
import { DnsClient } from "../services/dns/dns-client.js";

// Import test data from the existing test file

const mockData = testData.dns;

/**
 * Mock ENR records for testing
 */
export const mockEnrRecords = {
  // Valid ENR with relay capability
  withRelay: mockData.enrWithWaku2Relay,
  // Valid ENR with store capability
  withStore: mockData.enrWithWaku2Store,
  // Valid ENR with relay and store capabilities
  withRelayStore: mockData.enrWithWaku2RelayStore,
  // Invalid ENR (malformed)
  invalid: "enr:-invalid-data"
};

/**
 * Mock DNS resolution data
 */
export const mockDnsData = {
  enrTree: mockData.enrTree,
  publicKey: mockData.publicKey,
  rootDomain: "JORXBYVVM7AEKETX5DGXW44EAY",
  rootRecord: mockData.enrRoot,
  branchDomain: "D2SNLTAGWNQ34NTQTPHNZDECFU",
  branchRecord: `enrtree-branch:${mockEnrRecords.withRelay},${mockEnrRecords.withStore},${mockEnrRecords.withRelayStore}`
};

/**
 * Creates a mock DNS client for testing
 */
export const createMockDnsClient = (
  responses: Map<string, string[]> = new Map()
): Layer.Layer<DnsClientService, never, never> => {
  // Set up default responses if none provided
  if (responses.size === 0) {
    // Root domain response
    responses.set(`${mockDnsData.rootDomain}.nodes.example.org`, [
      mockDnsData.rootRecord
    ]);
    // Branch domain response
    responses.set(`${mockDnsData.branchDomain}.nodes.example.org`, [
      mockDnsData.branchRecord
    ]);
  }

  return Layer.succeed(DnsClient, {
    fetchRecords: (domain: string) =>
      Effect.gen(function* () {
        const records = responses.get(domain);
        if (!records) {
          return yield* Effect.fail(
            new DnsResolutionError({
              domain,
              reason: "No mock records found"
            })
          );
        }
        return records as readonly string[];
      })
  } satisfies DnsClientService);
};

/**
 * Creates a mock DNS client that immediately returns peers
 * This is useful for compliance tests that expect immediate peer discovery
 */
export const createImmediatePeerDnsClient = (): Layer.Layer<
  DnsClientService,
  never,
  never
> => {
  const responses = new Map<string, string[]>();

  // Set up proper DNS tree structure for testing
  // Root domain returns root record
  responses.set("nodes.example.org", [mockDnsData.rootRecord]);

  // Root hash subdomain returns branch record
  responses.set(`${mockDnsData.rootDomain}.nodes.example.org`, [
    `enrtree-branch:${mockDnsData.branchDomain}`
  ]);

  // Branch subdomain under base domain - this matches original implementation
  // When we find a branch record listing D2SNLTAGWNQ34NTQTPHNZDECFU,
  // it should be resolved as D2SNLTAGWNQ34NTQTPHNZDECFU.nodes.example.org
  // (directly under base domain, not nested under root hash)
  // Each DNS query should return one ENR record, so we pick the first one
  responses.set(
    `${mockDnsData.branchDomain}.nodes.example.org`,
    [mockEnrRecords.withRelayStore] // Return just one ENR record with capabilities
  );

  return createMockDnsClient(responses);
};
