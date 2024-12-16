import { createDecoder, createEncoder } from "@waku/core";
import { LightNode } from "@waku/interfaces";
import { HealthEvent, HealthEventType, HealthStatus } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { contentTopicToPubsubTopic } from "@waku/utils";

export const TestContentTopic = "/test/1/waku-filter/default";
export const ClusterId = 2;
export const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: ClusterId
};
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  ClusterId
);
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const TestDecoder = createDecoder(TestContentTopic, TestPubsubTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

export function createHealthEventPromise(
  waku: LightNode,
  eventType: HealthEventType
): Promise<HealthEvent> {
  return new Promise((resolve) => {
    const handler = (event: HealthEvent): void => {
      waku.health.removeEventListener(eventType, handler);
      resolve(event);
    };
    waku.health.addEventListener(eventType, handler);
  });
}

export function waitForHealthStatus(
  waku: LightNode,
  expectedStatus: HealthStatus
): Promise<HealthEvent> {
  return new Promise((resolve) => {
    // Check current status first
    const currentStatus = waku.health.getHealthStatus();
    if (currentStatus === expectedStatus) {
      resolve({
        type: "health:overall",
        status: expectedStatus,
        timestamp: new Date()
      });
      return;
    }

    // Otherwise wait for the event
    const handler = (event: HealthEvent): void => {
      if (event.status === expectedStatus) {
        waku.health.removeEventListener("health:overall", handler);
        resolve(event);
      }
    };
    waku.health.addEventListener("health:overall", handler);
  });
}
