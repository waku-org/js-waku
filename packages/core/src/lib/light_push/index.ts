export {
  LightPushCore,
  LightPushCodec,
  LightPushCodecV3,
  LightPushCodecs,
  PushResponse
} from "./light_push.js";

export { PushRpcV3, LightPushV3StatusCodes } from "./push_rpc_v3.js";

// Alias exports to minimize explicit V3 naming while keeping backward compatibility
export { PushRpcV3 as PushRpcLatest } from "./push_rpc_v3.js";
import { LightPushCodecV3 } from "./light_push.js";
/**
 * Latest Light Push multicodec (currently v3). Alias for LightPushCodecV3.
 * @deprecated Prefer `LightPushCodecLatest`. `LightPushCodecV3` will be kept for backward compatibility.
 */
export const LightPushCodecLatest = LightPushCodecV3;
import { LightPushV3StatusCodes } from "./push_rpc_v3.js";
/**
 * Alias for LightPushV3StatusCodes to avoid explicit version suffix in most code paths.
 */
export const LightPushStatusCodes = LightPushV3StatusCodes;

export {
  isRLNResponseError,
  isSuccess,
  toLightPushError,
  toProtocolError,
  getStatusDescription,
  getProtocolVersion,
  inferProtocolVersion
} from "./utils.js";
