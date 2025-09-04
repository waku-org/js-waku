export const CODECS = {
  v2: "/vac/waku/lightpush/2.0.0-beta1",
  v3: "/vac/waku/lightpush/3.0.0"
} as const;

export const LightPushCodecV2 = CODECS.v2;
export const LightPushCodec = CODECS.v3;
