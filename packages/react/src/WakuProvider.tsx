"use client";
import type { CreateNodeOptions, IWaku, LightNode } from "@waku/interfaces";
import * as React from "react";

import type { CreateNodeResult, ReactChildrenProps } from "./types.js";
import { useCreateLightNode } from "./useCreateWaku.js";

type WakuContextType<T extends IWaku> = CreateNodeResult<T>;

const WakuContext = React.createContext<WakuContextType<IWaku>>({
  node: undefined,
  isLoading: false,
  error: undefined
});

/**
 * Hook to retrieve Waku node from Context. By default generic Waku type will be used.
 * @example
 * const { node, isLoading, error } = useWaku<LightNode>();
 * @example
 * const { node, isLoading, error } = useWaku<RelayNode>();
 * @example
 * const { node, isLoading, error } = useWaku<FullNode>();
 * @example
 * const { node, isLoading, error } = useWaku();
 * @returns WakuContext
 */
export const useWaku = (): WakuContextType<LightNode> =>
  React.useContext(WakuContext) as WakuContextType<LightNode>;

type ProviderProps<T> = ReactChildrenProps & { options: T };

/**
 * Provider for creating Waku node based on options passed.
 * @example
 * const App = (props) => (
 *  <WakuProvider options={{...}}>
 *      <Component />
 *  </WakuProvider>
 * );
 * const Component = (props) => {
 *  const { node, isLoading, error } = useWaku();
 *  ...
 * };
 * @param {Object} props - options to create a node and other React props
 * @param {CreateNodeOptions} props.options - optional options for creating Light Node
 * @returns React Light Node provider component
 */
export const WakuProvider = (
  props: ProviderProps<CreateNodeOptions>
): React.ReactElement => {
  const result = useCreateLightNode(props.options);

  return (
    <WakuContext.Provider value={result}>{props.children}</WakuContext.Provider>
  );
};
