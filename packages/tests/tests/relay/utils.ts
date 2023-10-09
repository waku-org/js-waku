import { createDecoder, createEncoder } from "@waku/core";

export const TestContentTopic = "/test/1/waku-relay/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const CustomContentTopic = "/test/2/waku-relay/utf8";
export const CustomPubSubTopic = "/some/pubsub/topic";
export const CustomEncoder = createEncoder({
  contentTopic: CustomContentTopic,
  pubSubTopic: CustomPubSubTopic
});
export const CustomDecoder = createDecoder(
  CustomContentTopic,
  CustomPubSubTopic
);
