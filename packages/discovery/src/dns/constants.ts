import type { NodeCapabilityCount } from "@waku/interfaces";

export const enrTree = {
  TEST: "enrtree://AO47IDOLBKH72HIZZOXQP6NMRESAN7CHYWIBNXDXWRJRZWLODKII6@test.wakuv2.nodes.status.im",
  PROD: "enrtree://ANEDLO25QVUGJOUTQFRYKWX6P4Z4GKVESBMHML7DZ6YK4LGS5FC5O@prod.wakuv2.nodes.status.im"
};

export const DEFAULT_BOOTSTRAP_TAG_NAME = "bootstrap";
export const DEFAULT_BOOTSTRAP_TAG_VALUE = 50;
export const DEFAULT_BOOTSTRAP_TAG_TTL = 100_000_000;

export const DEFAULT_NODE_REQUIREMENTS: Partial<NodeCapabilityCount> = {
  store: 2,
  filter: 1,
  lightPush: 1
};
