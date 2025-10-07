import type { WakuHeadless } from "../web/index.js";

export interface WindowNetworkConfig {
  clusterId?: number;
  shards?: number[];
}

export interface ITestBrowser extends Window {
  wakuApi: WakuHeadless;
  __WAKU_NETWORK_CONFIG?: WindowNetworkConfig;
  __WAKU_LIGHTPUSH_NODE?: string | null;
  __WAKU_ENR_BOOTSTRAP?: string | null;
}

declare global {
  interface Window {
    wakuApi: WakuHeadless;
  }
}
