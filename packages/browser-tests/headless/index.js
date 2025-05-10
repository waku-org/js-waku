import { API } from "@src/api/shared";

runApp().catch((err) => {
  console.error(err);
});

async function runApp() {
  if (typeof window !== "undefined") {
    // Expose shared API functions for browser communication
    // eslint-disable-next-line no-undef
    window.wakuAPI = API;
    // eslint-disable-next-line no-undef
    window.subscriptions = [];
  }
}
