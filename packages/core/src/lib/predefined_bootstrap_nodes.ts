import { getPseudoRandomSubset } from "@waku/utils";

export const DefaultWantedNumber = 1;

export enum Fleet {
  Sandbox = "sandbox",
  Test    = "test"
}

/**
 * Return list of pre-defined (hardcoded) bootstrap nodes.
 *
 * Default behavior is to return nodes of the nwaku Status Sandbox fleet.
 *
 * @param fleet The fleet to be returned. Defaults to sandbox fleet.
 * @param wantedNumber The number of connections desired. Defaults to {@link DefaultWantedNumber}.
 *
 * @returns An array of multiaddresses.
 */
export function getPredefinedBootstrapNodes(
  fleet: Fleet = Fleet.Sandbox,
  wantedNumber: number = DefaultWantedNumber
): string[] {
  if (wantedNumber <= 0) {
    return [];
  }

  let nodes;
  switch (fleet) {
    case Fleet.Sandbox:
      nodes = fleets.fleets["waku.sandbox"]["waku-websocket"];
      break;
    case Fleet.Test:
      nodes = fleets.fleets["waku.test"]["waku-websocket"];
      break;
    default:
      nodes = fleets.fleets["waku.sandbox"]["waku-websocket"];
  }

  nodes = Object.values(nodes) as string[];

  return getPseudoRandomSubset(nodes, wantedNumber);
}

export const fleets = {
  fleets: {
    "waku.sandbox": {
      "waku-websocket": {
        "node-01.ac-cn-hongkong-c.waku.sandbox":
          "/dns4/node-01.ac-cn-hongkong-c.waku.sandbox.status.im/tcp/8000/wss/p2p/16Uiu2HAmSJvSJphxRdbnigUV5bjRRZFBhTtWFTSyiKaQByCjwmpV",
        "node-01.do-ams3.waku.sandbox":
          "/dns4/node-01.do-ams3.waku.sandbox.status.im/tcp/8000/wss/p2p/16Uiu2HAmQSMNExfUYUqfuXWkD5DaNZnMYnigRxFKbk3tcEFQeQeE",
        "node-01.gc-us-central1-a.waku.sandbox":
          "/dns4/node-01.gc-us-central1-a.waku.sandbox.status.im/tcp/8000/wss/p2p/16Uiu2HAm6fyqE1jB5MonzvoMdU8v76bWV8ZeNpncDamY1MQXfjdB"
      }
    },
    "waku.test": {
      "waku-websocket": {
        "node-01.ac-cn-hongkong-c.waku.test":
          "/dns4/node-01.ac-cn-hongkong-c.waku.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAkzHaTP5JsUwfR9NR8Rj9HC24puS6ocaU8wze4QrXr9iXp",
        "node-01.do-ams3.waku.test":
          "/dns4/node-01.do-ams3.waku.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAkykgaECHswi3YKJ5dMLbq2kPVCo89fcyTd38UcQD6ej5W",
        "node-01.gc-us-central1-a.waku.test":
          "/dns4/node-01.gc-us-central1-a.waku.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmDCp8XJ9z1ev18zuv8NHekAsjNyezAvmMfFEJkiharitG"
      }
    }
  }
};
