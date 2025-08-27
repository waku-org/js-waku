import { test, expect } from "@playwright/test";
import axios from "axios";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";

test.describe.configure({ mode: "serial" });

let container: StartedTestContainer;
let baseUrl = "http://127.0.0.1:8080";

test.beforeAll(async () => {
  // Build and run the container once for the suite; reuse across tests
  container = await new GenericContainer("waku-browser-tests:local")
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forLogMessage("API server running on http://localhost:"))
    .start();

  const mappedPort = container.getMappedPort(8080);
  baseUrl = `http://127.0.0.1:${mappedPort}`;

  // Probe readiness
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await axios.get(`${baseUrl}/`, { timeout: 1000 });
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // wait and retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  expect(ready).toBe(true);
});

test.afterAll(async () => {
  if (container) {
    await container.stop({ timeout: 5000 });
  }
});

test("container: health endpoint", async () => {
  const res = await axios.get(`${baseUrl}/`);
  expect(res.status).toBe(200);
  expect(res.data.status).toBe("Waku simulation server is running");
});

test("container: create/start node and push", async () => {
  await axios.post(`${baseUrl}/admin/v1/create-node`, {
    defaultBootstrap: true,
    networkConfig: { clusterId: 42, shards: [0] },
    pubsubTopics: ["/waku/2/rs/42/0"]
  });
  await axios.post(`${baseUrl}/admin/v1/start-node`);
  const push = await axios.post(`${baseUrl}/lightpush/v1/message`, {
    pubsubTopic: "/waku/2/default-waku/proto",
    message: {
      contentTopic: "/test/1/message/proto",
      payload: Array.from(new TextEncoder().encode("Hello from container"))
    }
  });
  expect(push.status).toBe(200);
  expect(push.data.messageId).toBeDefined();
});

test("container: filter v1 queue operations", async () => {
  const topic = "docker-queue";
  const empty = await axios.get(`${baseUrl}/filter/v1/messages/${topic}`);
  expect(empty.status).toBe(200);
  expect(empty.data.messages).toEqual([]);

  // Inject messages via /execute helper
  const messages = [
    {
      payload: Array.from(new TextEncoder().encode("One")),
      timestamp: Date.now() - 2000,
      contentTopic: topic
    },
    {
      payload: Array.from(new TextEncoder().encode("Two")),
      timestamp: Date.now() - 1000,
      contentTopic: topic
    },
    {
      payload: Array.from(new TextEncoder().encode("Three")),
      timestamp: Date.now(),
      contentTopic: topic
    }
  ];
  const execRes = await axios.post(`${baseUrl}/execute`, {
    functionName: "simulateMessages",
    params: [topic, messages]
  });
  expect(execRes.status).toBe(200);

  const resp = await axios.get(`${baseUrl}/filter/v1/messages/${topic}`);
  expect(resp.status).toBe(200);
  expect(resp.data.messages.length).toBe(3);
});

