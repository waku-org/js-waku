import { getPseudoRandomSubset } from "@waku/utils";

export const DefaultWantedNumber = 1;

export enum Fleet {
  Prod = "prod",
  Test = "test"
}

/**
 * Return list of pre-defined (hardcoded) bootstrap nodes.
 *
 * Default behavior is to return nodes of the nwaku Status Prod fleet.
 *
 * @param fleet The fleet to be returned. Defaults to production fleet.
 * @param wantedNumber The number of connections desired. Defaults to {@link DefaultWantedNumber}.
 *
 * @returns An array of multiaddresses.
 */
export function getPredefinedBootstrapNodes(
  fleet: Fleet = Fleet.Prod,
  wantedNumber: number = DefaultWantedNumber
): string[] {
  if (wantedNumber <= 0) {
    return [];
  }

  let nodes;
  switch (fleet) {
    case Fleet.Prod:
      nodes = fleets.fleets["wakuv2.prod"]["waku-websocket"];
      break;
    case Fleet.Test:
      nodes = fleets.fleets["wakuv2.test"]["waku-websocket"];
      break;
    default:
      nodes = fleets.fleets["wakuv2.prod"]["waku-websocket"];
  }

  nodes = Object.values(nodes) as string[];

  return getPseudoRandomSubset(nodes, wantedNumber);
}

export const fleets = {
  fleets: {
    "wakuv2.prod": {
      "waku-websocket": {
        "node-01.ac-cn-hongkong-c.wakuv2.prod":
          "/dns4/node-01.ac-cn-hongkong-c.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD",
        "node-01.do-ams3.wakuv2.prod":
          "/dns4/node-01.do-ams3.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmL5okWopX7NqZWBUKVqW8iUxCEmd5GMHLVPwCgzYzQv3e",
        "node-01.gc-us-central1-a.wakuv2.prod":
          "/dns4/node-01.gc-us-central1-a.wakuv2.prod.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmVkKntsECaYfefR1V2yCR79CegLATuTPE6B9TxgxBiiiA"
      }
    },
    "wakuv2.test": {
      "waku-websocket": {
        "node-01.ac-cn-hongkong-c.wakuv2.test":
          "/dns4/node-01.ac-cn-hongkong-c.wakuv2.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAkvWiyFsgRhuJEb9JfjYxEkoHLgnUQmr1N5mKWnYjxYRVm",
        "node-01.do-ams3.wakuv2.test":
          "/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ",
        "node-01.gc-us-central1-a.wakuv2.test":
          "/dns4/node-01.gc-us-central1-a.wakuv2.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmJb2e28qLXxT5kZxVUUoJt72EMzNGXB47Rxx5hw3q4YjS"
      }
    }
  }
};
