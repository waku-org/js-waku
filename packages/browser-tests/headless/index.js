import { API } from "@src/api/shared";

runApp().catch((err) => {
  console.error(err);
});

async function runApp() {
  // console.log("runApp");
  // const node = await API.createWakuNode({
  //   defaultBootstrap: false
  // });

  // await node.start();
  // console.log("node", node);

  if (typeof window !== "undefined") {
    // Expose the Waku node

    // Expose shared API functions
    // eslint-disable-next-line no-undef
    window.wakuAPI = API;
  }
}
