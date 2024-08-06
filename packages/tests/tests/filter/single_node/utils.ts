import { LightNode, NetworkConfig, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { Context } from "mocha";

import {
  runNodes as runNodesBuilder,
  ServiceNode
} from "../../../src/index.js";

export const log = new Logger("test:filter:single_node");

export const runNodes = (
  context: Context,
  shardInfo: NetworkConfig
): Promise<[ServiceNode, LightNode]> =>
  runNodesBuilder<LightNode>({
    context,
    createNode: createLightNode,
    protocols: [Protocols.LightPush, Protocols.Filter],
    networkConfig: shardInfo
  });
