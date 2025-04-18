import cp from "child_process";
import { promisify } from "util";

import { createLightNode } from "@waku/sdk";

const exec = promisify(cp.exec);

class Fleet {
  static async create() {
    const url = "https://fleets.status.im";

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const fleet = await response.json();

      if (!Fleet.isRecordValid(fleet)) {
        throw Error("invalid_fleet_record");
      }

      return new Fleet(fleet);
    } catch (error) {
      console.error(`Error fetching data from ${url}:`, error);
      throw error;
    }
  }

  static isRecordValid(fleet) {
    let isValid = true;

    if (!fleet.fleets) {
      console.error("No fleet records are present.");
      isValid = false;
    }

    if (!fleet.fleets["waku.sandbox"]) {
      console.error("No waku.sandbox records are present.");
      isValid = false;
    } else if (!fleet.fleets["waku.sandbox"]["wss/p2p/waku"]) {
      console.error("No waku.sandbox WSS multi-addresses are present.");
      isValid = false;
    }

    if (!fleet.fleets["waku.test"]) {
      console.error("No waku.test records are present.");
      isValid = false;
    } else if (!fleet.fleets["waku.test"]["wss/p2p/waku"]) {
      console.error("No waku.test WSS multi-addresses are present.");
      isValid = false;
    }

    if (!isValid) {
      console.error(`Got ${JSON.stringify(fleet)}`);
    }

    return isValid;
  }

  constructor(fleet) {
    this.fleet = fleet;
  }

  get sandbox() {
    return this.fleet.fleets["waku.sandbox"]["wss/p2p/waku"];
  }

  get test() {
    return this.fleet.fleets["waku.test"]["wss/p2p/waku"];
  }
}

class ConnectionChecker {
  static waku;
  static lock = false;

  static async checkPlainWss(maddrs) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    const results = await Promise.all(
      maddrs.map((v) => ConnectionChecker.dialPlainWss(v))
    );

    console.log(
      "Raw WSS connection:\n",
      results.map(([addr, result]) => `${addr}:\t${result}`).join("\n")
    );

    return results;
  }

  static async dialPlainWss(maddr) {
    const { domain, port } = ConnectionChecker.parseMaddr(maddr);
    return [
      maddr,
      await ConnectionChecker.spawn(`npx wscat -c wss://${domain}:${port}`)
    ];
  }

  static async checkWakuWss(maddrs) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const waku = await createLightNode({
      defaultBootstrap: false,
      libp2p: {
        hideWebSocketInfo: true
      },
      networkConfig: {
        clusterId: 42,
        shards: [0]
      }
    });

    const results = await Promise.all(
      maddrs.map((v) => ConnectionChecker.dialWaku(waku, v))
    );

    console.log(
      "Libp2p WSS connection:\n",
      results.map(([addr, result]) => `${addr}:\t${result}`).join("\n")
    );

    return results;
  }

  static async dialWaku(waku, maddr) {
    try {
      await waku.dial(maddr);
      return [maddr, "OK"];
    } catch (e) {
      return [maddr, "FAIL"];
    }
  }

  static parseMaddr(multiaddr) {
    const regex = /\/dns4\/([^/]+)\/tcp\/(\d+)/;
    const match = multiaddr.match(regex);

    if (!match) {
      throw new Error(
        "Invalid multiaddress format. Expected /dns4/domain/tcp/port pattern."
      );
    }

    return {
      domain: match[1],
      port: parseInt(match[2], 10)
    };
  }

  static async spawn(command) {
    try {
      console.info(`Spawning command: ${command}`);
      const { stderr } = await exec(command);
      return stderr || "OK";
    } catch (e) {
      return "FAIL";
    }
  }
}

async function run() {
  const fleet = await Fleet.create();
  const sandbox = Object.values(fleet.sandbox);
  const test = Object.values(fleet.test);

  let maddrs = [...sandbox, ...test];

  const plainWssResult = await ConnectionChecker.checkPlainWss(maddrs);
  const wakuWssResult = await ConnectionChecker.checkWakuWss(maddrs);

  const plainWssFail = plainWssResult.some(([_, status]) => status === "FAIL");
  const wakuWssFail = wakuWssResult.some(([_, status]) => status === "FAIL");

  if (plainWssFail || wakuWssFail) {
    process.exit(1);
  }

  process.exit(0);
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error("Unhandled error:", error);
    process.exit(1);
  }
})();
