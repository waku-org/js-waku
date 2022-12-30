import tests from "@libp2p/interface-peer-discovery-compliance-tests";

import { wakuDnsDiscovery } from "./index.js";

describe.only("your peer discovery implementation", () => {
  tests({
    async setup() {
      const publicKey = "AOGECG2SPND25EEFMAJ5WF3KSGJNSGV356DSTL2YVLLZWIV6SAYBM";
      const fqdn = "prod.nodes.status.im";
      const enrTree = `enrtree://${publicKey}@${fqdn}`;
      return wakuDnsDiscovery(enrTree, {
        filter: 1,
      })();
    },
    async teardown() {
      //
    },
  });
});
