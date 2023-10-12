import { Waku } from "@waku/interfaces";
import debug from "debug";
import pRetry from "p-retry";

import { NimGoNode } from "./index.js";

const log = debug("waku:test");

export async function tearDownNodes(
  nwakuNodes: NimGoNode | NimGoNode[],
  wakuNodes: Waku | Waku[]
): Promise<void> {
  const nNodes = Array.isArray(nwakuNodes) ? nwakuNodes : [nwakuNodes];
  const wNodes = Array.isArray(wakuNodes) ? wakuNodes : [wakuNodes];

  const stopNodeWithTimeout = async (
    node: NimGoNode | Waku,
    type: string
  ): Promise<void> => {
    try {
      await Promise.race([
        pRetry(
          async () => {
            try {
              await node.stop();
            } catch (error) {
              log(`${type} failed to stop:`, error);
              throw error;
            }
          },
          { retries: 3 }
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout reached")), 10000)
        )
      ]);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Timeout reached") {
          log(`${type} stop operation timed out.`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  };

  const stopNwakuNodes = nNodes.map((nwaku) =>
    nwaku ? stopNodeWithTimeout(nwaku, "Nwaku") : undefined
  );
  const stopWakuNodes = wNodes.map((waku) =>
    waku ? stopNodeWithTimeout(waku, "Waku") : undefined
  );

  await Promise.all([...stopNwakuNodes, ...stopWakuNodes]);
}
