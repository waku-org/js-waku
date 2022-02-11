/**
 * GET list of nodes from remote HTTP host.
 *
 * Default behavior is to return nodes hosted by Status.
 *
 * @param path The property path to access the node list. The result should be
 * a string, a string array or an object. If the result is an object then the
 * values of the objects are used as multiaddresses. For example, if the GET
 * request returns `{ foo: { bar: [address1, address2] } }` then `path` should be
 * `[ "foo", "bar" ]`.
 * @param url Remote host containing bootstrap peers in JSON format.
 * @param wantedNumber The number of connections desired. Defaults to [DefaultWantedNumber].
 *
 * @returns An array of multiaddresses.
 * @throws If the remote host is unreachable or the response cannot be parsed
 * according to the passed _path_.
 */
import debug from "debug";
import { Multiaddr } from "multiaddr";

import { getPseudoRandomSubset } from "./index";
const dbg = debug("waku:discovery");

const DefaultWantedNumber = 1;

export async function getNodesFromHostedJson(
  path: string[] = ["fleets", "wakuv2.prod", "waku-websocket"],
  url = "https://fleets.status.im/",
  wantedNumber: number = DefaultWantedNumber
): Promise<Multiaddr[]> {
  if (wantedNumber <= 0) {
    return [];
  }

  const res = await fetch(url);
  let nodes = await res.json();

  for (const prop of path) {
    if (nodes[prop] === undefined) {
      dbg(
        `Failed to retrieve bootstrap nodes: ${prop} does not exist on `,
        nodes
      );
      throw `Failed to retrieve bootstrap nodes: ${prop} does not exist on ${JSON.stringify(
        nodes
      )}`;
    }
    nodes = nodes[prop];
  }

  if (Array.isArray(nodes)) {
    return getPseudoRandomSubset(nodes, wantedNumber).map(
      (node: string) => new Multiaddr(node)
    );
  }

  if (typeof nodes === "string") {
    return [new Multiaddr(nodes)];
  }

  if (typeof nodes === "object") {
    nodes = Object.values(nodes) as string[];
    nodes = nodes.map((node: string) => new Multiaddr(node));
    return getPseudoRandomSubset(nodes, wantedNumber);
  }

  throw `Failed to retrieve bootstrap nodes: response format is not supported: ${JSON.stringify(
    nodes
  )}`;
}
