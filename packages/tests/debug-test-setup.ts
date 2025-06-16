/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { DefaultTestShardInfo } from "./src/constants.js";
import { runMultipleNodes } from "./src/utils/nodes.js";

async function debugTestSetup(): Promise<void> {
  console.log("Starting debug test setup...");

  try {
    console.log("Creating test context...");
    const mockContext = {
      ctx: {
        currentTest: {
          title: "Debug test setup"
        }
      }
    } as any;

    console.log("Calling runMultipleNodes...");
    const [serviceNodes, waku] = await runMultipleNodes(
      mockContext,
      DefaultTestShardInfo,
      {
        lightpush: true,
        filter: true
      }
    );

    console.log("Success! waku:", !!waku);
    console.log("waku.nextFilter:", !!waku?.nextFilter);
    console.log("serviceNodes:", !!serviceNodes);

    // Cleanup
    await waku?.stop();
    await serviceNodes?.stop();
  } catch (error) {
    console.error("Failed to set up test:", error);
  }
}

void debugTestSetup();
