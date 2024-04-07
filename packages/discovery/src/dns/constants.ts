import type { NodeCapabilityCount } from "@waku/interfaces";

export const enrTree = {
  TEST: "enrtree://AOGYWMBYOUIMOENHXCHILPKY3ZRFEULMFI4DOM442QSZ73TT2A7VI@test.waku.nodes.status.im",
  SANDBOX:
    "enrtree://AIRVQ5DDA4FFWLRBCHJWUWOO6X6S4ZTZ5B667LQ6AJU6PEYDLRD5O@sandbox.waku.nodes.status.im"
};

export const DEFAULT_BOOTSTRAP_TAG_NAME = "bootstrap";
export const DEFAULT_BOOTSTRAP_TAG_VALUE = 50;
export const DEFAULT_BOOTSTRAP_TAG_TTL = 100_000_000;

export const DEFAULT_NODE_REQUIREMENTS: Partial<NodeCapabilityCount> = {
  store: 2,
  filter: 1,
  lightPush: 1
};
