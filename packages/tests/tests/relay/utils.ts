import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import { Protocols, RelayNode } from "@waku/interfaces";
import { Logger } from "@waku/utils";

export const messageText = "Relay works!";
export const TestContentTopic = "/test/1/waku-relay/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const CustomContentTopic = "/test/2/waku-relay/utf8";
export const CustomPubsubTopic = "/some/pubsub/topic";
export const CustomEncoder = createEncoder({
  contentTopic: CustomContentTopic,
  pubsubTopic: CustomPubsubTopic
});
export const CustomDecoder = createDecoder(
  CustomContentTopic,
  CustomPubsubTopic
);

export const log = new Logger("test:relay");

export async function waitForAllRemotePeers(
  ...nodes: RelayNode[]
): Promise<void> {
  log.info("Wait for mutual pubsub subscription");
  await Promise.all(
    nodes.map((node) => waitForRemotePeer(node, [Protocols.Relay]))
  );
}
