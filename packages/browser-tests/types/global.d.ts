import { LightNode } from "@waku/sdk";
import { IWakuNode } from "../src/api/common.js";
import {
  createWakuNode,
  dialPeers,
  getDebugInfo,
  getPeerInfo,
  pushMessage,
  subscribe
} from "../src/api/shared.js";

// Define types for the Waku node and window
declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    waku: IWakuNode & LightNode;
    wakuAPI: {
      getPeerInfo: typeof getPeerInfo;
      getDebugInfo: typeof getDebugInfo;
      pushMessage: typeof pushMessage;
      dialPeers: typeof dialPeers;
      createWakuNode: typeof createWakuNode;
      subscribe: typeof subscribe;
      [key: string]: any;
    };
  }
}
