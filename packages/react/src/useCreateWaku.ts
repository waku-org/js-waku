import type { CreateNodeOptions, IWaku, LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import React from "react";

import type { CreateNodeResult } from "./types.js";

type NodeFactory<N, T = Record<string, never>> = (options?: T) => Promise<N>;

type CreateNodeParams<N extends IWaku, T = Record<string, never>> = T & {
  factory: NodeFactory<N, T>;
};

const useCreateNode = <N extends IWaku, T = Record<string, never>>(
  params: CreateNodeParams<N, T>
): CreateNodeResult<N> => {
  const { factory, ...options } = params;

  const [node, setNode] = React.useState<N | undefined>(undefined);
  const [isLoading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<undefined | string>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    factory(options as T)
      .then(async (node) => {
        if (cancelled) {
          return;
        }

        await node.start();
        await node.waitForPeers();

        setNode(node);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setError(`Failed at creating node: ${err?.message || "no message"}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    node,
    error,
    isLoading
  };
};

export const useCreateLightNode = (
  params?: CreateNodeOptions
): CreateNodeResult<LightNode> => {
  return useCreateNode<LightNode, CreateNodeOptions>({
    ...params,
    factory: createLightNode
  });
};
