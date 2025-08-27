import type { WakuHeadless } from "../web/index.js";

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    wakuApi: WakuHeadless;
  }
}
