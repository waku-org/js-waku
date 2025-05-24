/* eslint-disable */
import { API } from "../browser-tests/src/api/shared.ts";

runApp().catch((err) => {
  console.error(err);
});

async function runApp() {
  if (typeof window !== "undefined") {
    // Expose shared API functions for browser communication
    window.wakuAPI = API;
    window.subscriptions = [];
  }
}
