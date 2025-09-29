import type { CreateNodeOptions, IWaku, LightNode } from "@waku/interfaces";
import { createLightNode, waitForRemotePeer } from "@waku/sdk";
import React from "react";

import type { BootstrapNodeOptions, CreateNodeResult } from "./types.js";

type NodeFactory<N, T = Record<string, never>> = (options?: T) => Promise<N>;

type CreateNodeParams<
  N extends IWaku,
  T = Record<string, never>
> = BootstrapNodeOptions<T> & {
  factory: NodeFactory<N, T>;
};

const useCreateNode = <N extends IWaku, T = Record<string, never>>(
  params: CreateNodeParams<N, T>
): CreateNodeResult<N> => {
  const { factory, options, protocols = [] } = params;

  const [node, setNode] = React.useState<N | undefined>(undefined);
  const [isLoading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<undefined | string>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    factory(options)
      .then(async (node) => {
        if (cancelled) {
          return;
        }

        await node.start();
        await waitForRemotePeer(node, protocols);

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
  params?: BootstrapNodeOptions<CreateNodeOptions>
): CreateNodeResult<LightNode> => {
  return useCreateNode<LightNode, CreateNodeOptions>({
    ...params,
    factory: createLightNode
  });
};
