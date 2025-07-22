import type { IProtoMessage } from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

import { createRLN } from "./create.js";
import type { IdentityCredential } from "./identity.js";

export interface TestRLNCodecSetup {
  rlnInstance: any;
  credential: IdentityCredential;
  index: number;
  payload: Uint8Array;
}

export const TEST_CONSTANTS = {
  contentTopic: "/test/1/waku-message/utf8",
  emptyPubsubTopic: "",
  defaultIndex: 0,
  defaultPayload: new Uint8Array([1, 2, 3, 4, 5]),
  routingInfo: createRoutingInfo(
    {
      clusterId: 0,
      numShardsInCluster: 2
    },
    { contentTopic: "/test/1/waku-message/utf8" }
  )
} as const;

export const EMPTY_PROTO_MESSAGE = {
  timestamp: undefined,
  contentTopic: "",
  ephemeral: undefined,
  meta: undefined,
  rateLimitProof: undefined,
  version: undefined
} as const;

/**
 * Creates a basic RLN setup for codec tests
 */
export async function createTestRLNCodecSetup(): Promise<TestRLNCodecSetup> {
  const rlnInstance = await createRLN();
  const credential = rlnInstance.zerokit.generateIdentityCredentials();
  rlnInstance.zerokit.insertMember(credential.IDCommitment);

  return {
    rlnInstance,
    credential,
    index: TEST_CONSTANTS.defaultIndex,
    payload: TEST_CONSTANTS.defaultPayload
  };
}

/**
 * Creates a meta setter function for testing
 */
export function createTestMetaSetter(): (
  msg: IProtoMessage & { meta: undefined }
) => Uint8Array {
  return (msg: IProtoMessage & { meta: undefined }): Uint8Array => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, msg.payload.length, false);
    return new Uint8Array(buffer);
  };
}

/**
 * Verifies common RLN message properties
 */
export function verifyRLNMessage(
  msg: any,
  payload: Uint8Array,
  contentTopic: string,
  version: number,
  rlnInstance: any
): void {
  expect(msg.rateLimitProof).to.not.be.undefined;
  expect(msg.verify([rlnInstance.zerokit.getMerkleRoot()])).to.be.true;
  expect(msg.verifyNoRoot()).to.be.true;
  expect(msg.epoch).to.not.be.undefined;
  expect(msg.epoch).to.be.gt(0);

  expect(msg.contentTopic).to.eq(contentTopic);
  expect(msg.msg.version).to.eq(version);
  expect(msg.payload).to.deep.eq(payload);
  expect(msg.timestamp).to.not.be.undefined;
}
