import type { WakuHeadless } from "../web/index.js";

export interface ITestBrowser extends Window {
  wakuApi: WakuHeadless;
  __WAKU_NETWORK_CONFIG?: any;
  __WAKU_LIGHTPUSH_NODE?: string | null;
  __WAKU_ENR_BOOTSTRAP?: string | null;
}

declare global {
  interface Window {
    wakuApi: WakuHeadless;
  }
}
