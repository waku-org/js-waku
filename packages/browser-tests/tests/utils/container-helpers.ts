import axios from "axios";
import { GenericContainer, StartedTestContainer } from "testcontainers";

export interface ContainerSetupOptions {
  environment?: Record<string, string>;
  networkMode?: string;
  timeout?: number;
  maxAttempts?: number;
}

export interface ContainerSetupResult {
  container: StartedTestContainer;
  baseUrl: string;
}

/**
 * Starts a waku-browser-tests Docker container with proper health checking.
 * Follows patterns from @waku/tests package for retry logic and cleanup.
 */
export async function startBrowserTestsContainer(
  options: ContainerSetupOptions = {}
): Promise<ContainerSetupResult> {
  const {
    environment = {},
    networkMode = "bridge",
    timeout = 2000,
    maxAttempts = 60
  } = options;

  console.log("Starting waku-browser-tests container...");
  
  let generic = new GenericContainer("waku-browser-tests:local")
    .withExposedPorts(8080)
    .withNetworkMode(networkMode);

  // Apply environment variables
  for (const [key, value] of Object.entries(environment)) {
    generic = generic.withEnvironment({ [key]: value });
  }

  const container = await generic.start();

  // Set up container logging
  await new Promise((r) => setTimeout(r, 5000));
  const logs = await container.logs({ tail: 100 });
  logs.on("data", (b) => process.stdout.write("[container] " + b.toString()));
  logs.on("error", (err) => console.error("[container log error]", err));

  const mappedPort = container.getMappedPort(8080);
  const baseUrl = `http://127.0.0.1:${mappedPort}`;

  // Wait for server readiness with retry logic (following waku/tests patterns)
  const serverReady = await waitForServerReady(baseUrl, maxAttempts, timeout);
  
  if (!serverReady) {
    await logFinalContainerState(container);
    throw new Error("Container failed to become ready");
  }

  console.log("✅ Browser tests container ready");
  await new Promise((r) => setTimeout(r, 500)); // Final settling time

  return { container, baseUrl };
}

/**
 * Waits for server to become ready with exponential backoff and detailed logging.
 * Follows retry patterns from @waku/tests ServiceNode.
 */
async function waitForServerReady(
  baseUrl: string, 
  maxAttempts: number, 
  timeout: number
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get(`${baseUrl}/`, { timeout });
      if (res.status === 200) {
        console.log(`Server is ready after ${i + 1} attempts`);
        return true;
      }
    } catch (error: any) {
      if (i % 10 === 0) {
        console.log(`Attempt ${i + 1}/${maxAttempts} failed:`, error.code || error.message);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Logs final container state for debugging, following waku/tests error handling patterns.
 */
async function logFinalContainerState(container: StartedTestContainer): Promise<void> {
  try {
    const finalLogs = await container.logs({ tail: 50 });
    console.log("=== Final Container Logs ===");
    finalLogs.on("data", (b) => console.log(b.toString()));
    await new Promise((r) => setTimeout(r, 1000));
  } catch (logError) {
    console.error("Failed to get container logs:", logError);
  }
}

/**
 * Gracefully stops containers with retry logic, following teardown patterns from waku/tests.
 */
export async function stopContainer(container: StartedTestContainer): Promise<void> {
  if (!container) return;

  console.log("Stopping container gracefully...");
  try {
    await container.stop({ timeout: 10000 });
    console.log("Container stopped successfully");
  } catch (error) {
    console.warn(
      "Container stop had issues (expected):",
      (error as any).message
    );
  }
}