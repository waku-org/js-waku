import { Waku } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import pRetry from "p-retry";

import { NimGoNode } from "./index.js";

const log = new Logger("test:teardown");

export async function tearDownNodes(
  nwakuNodes: NimGoNode | NimGoNode[],
  wakuNodes: Waku | Waku[]
): Promise<void> {
  const nNodes = Array.isArray(nwakuNodes) ? nwakuNodes : [nwakuNodes];
  const wNodes = Array.isArray(wakuNodes) ? wakuNodes : [wakuNodes];

  const stopNwakuNodes = nNodes.map(async (nwaku) => {
    if (nwaku) {
      await pRetry(
        async () => {
          try {
            await nwaku.stop();
          } catch (error) {
            log.error("Nwaku failed to stop:", error);
            throw error;
          }
        },
        { retries: 3 }
      );
    }
  });

  const stopWakuNodes = wNodes.map(async (waku) => {
    if (waku) {
      await pRetry(
        async () => {
          try {
            await waku.stop();
          } catch (error) {
            log.error("Waku failed to stop:", error);
            throw error;
          }
        },
        { retries: 3 }
      );
    }
  });

  await Promise.all([...stopNwakuNodes, ...stopWakuNodes]);
}
