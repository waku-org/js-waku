import { createEncoder, LightNode, SDKProtocolResult } from "@waku/sdk";

export async function pushMessage(
  waku: LightNode,
  contentTopic: string,
  payload?: Uint8Array
): Promise<SDKProtocolResult> {
  const enc = createEncoder({
    contentTopic
  });

  const result = await waku.lightPush.send(enc, {
    payload: payload ?? new Uint8Array()
  });
  return result;
}
