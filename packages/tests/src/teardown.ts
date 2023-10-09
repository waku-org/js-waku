import { LightNode, RelayNode } from "@waku/interfaces";
import debug from "debug";

import { NimGoNode } from "./index.js";

const log = debug("waku:test");

export function tearDownNodes(
  nwakuNodes: NimGoNode[],
  wakuNodes: LightNode[] | RelayNode[]
): void {
  nwakuNodes.forEach((nwaku) => {
    if (nwaku) {
      nwaku.stop().catch((e) => log("Nwaku failed to stop", e));
    }
  });

  wakuNodes.forEach((waku) => {
    if (waku) {
      waku.stop().catch((e) => log("Waku failed to stop", e));
    }
  });
}
