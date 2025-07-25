import { LightPushStatusCode } from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";

import { PushRpcV2 } from "./push_rpc.js";
import { PushRpcV3 } from "./push_rpc_v3.js";

export type PushRpc =
  | ({ version: "v2" } & PushRpcV2)
  | ({ version: "v3" } & PushRpcV3);

export const LightPushCodec = "/vac/waku/lightpush/3.0.0" as const;

export { LightPushStatusCode };

export function isV3(rpc: PushRpc): rpc is { version: "v3" } & PushRpcV3 {
  return rpc.version === "v3";
}

export function isV2(rpc: PushRpc): rpc is { version: "v2" } & PushRpcV2 {
  return rpc.version === "v2";
}

export function createV2Rpc(
  message: WakuMessage,
  pubsubTopic: string
): PushRpc {
  const v2Rpc = PushRpcV2.createRequest(message, pubsubTopic);
  return {
    version: "v2",
    ...v2Rpc
  } as PushRpc;
}

export function createV3Rpc(
  message: WakuMessage,
  pubsubTopic: string
): PushRpc {
  const v3Rpc = PushRpcV3.createRequest(message, pubsubTopic);
  return {
    version: "v3",
    ...v3Rpc
  } as PushRpc;
}
