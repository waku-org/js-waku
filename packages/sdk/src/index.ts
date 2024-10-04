export { createEncoder, createDecoder } from "@waku/core";
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
export { wakuLightPush } from "./protocols/light_push/index.js";
export { wakuFilter } from "./protocols/filter/index.js";
export { wakuStore } from "./protocols/store/index.js";

export { waitForRemotePeer } from "./wait_for_remote_peer.js";

export * as waku from "@waku/core";
export * as utils from "@waku/utils";
export * from "@waku/interfaces";
