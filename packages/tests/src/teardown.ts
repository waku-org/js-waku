import { LightNode } from "@waku/interfaces";
import debug from "debug";
import pRetry from "p-retry";

import { NimGoNode } from "./index.js";

const log = debug("waku:test");

export async function tearDownNodes(
  nwakuNodes: NimGoNode[],
  wakuNodes: LightNode[]
): Promise<void> {
  const stopNwakuNodes = nwakuNodes.map(async (nwaku) => {
    if (nwaku) {
      await pRetry(
        async () => {
          try {
            await nwaku.stop();
          } catch (error) {
            log("Nwaku failed to stop:", error);
            throw error;
          }
        },
        { retries: 3 }
      );
    }
  });

  const stopWakuNodes = wakuNodes.map(async (waku) => {
    if (waku) {
      await pRetry(
        async () => {
          try {
            await waku.stop();
          } catch (error) {
            log("Waku failed to stop:", error);
            throw error;
          }
        },
        { retries: 3 }
      );
    }
  });

  await Promise.all([...stopNwakuNodes, ...stopWakuNodes]);
}
