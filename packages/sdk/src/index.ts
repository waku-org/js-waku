export { waitForRemotePeer, createEncoder, createDecoder } from "@waku/core";
export {
  DecodedMessage,
  Decoder,
  Encoder
} from "@waku/core/lib/message/version_0";

export { utf8ToBytes, bytesToUtf8 } from "@waku/utils/bytes";

export * from "./waku.js";

export {
  createLightNode,
  defaultLibp2p,
  createLibp2pAndUpdateOptions
} from "./create/index.js";
export { wakuLightPush } from "./protocols/light_push.js";
export { wakuFilter } from "./protocols/filter.js";
export { wakuStore } from "./protocols/store.js";

export * as waku from "@waku/core";
export * as utils from "@waku/utils";
export * from "@waku/interfaces";
