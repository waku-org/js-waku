import type { WakuHeadless } from "../web/index.js";

declare global {
  interface Window {
    wakuApi: WakuHeadless;
  }
}
