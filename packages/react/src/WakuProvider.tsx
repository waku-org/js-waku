import type { CreateNodeOptions, IWaku } from "@waku/interfaces";
import React from "react";

import type {
  BootstrapNodeOptions,
  CreateNodeResult,
  ReactChildrenProps
} from "./types.js";
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
export const useWaku = <T extends IWaku>(): WakuContextType<T> =>
  React.useContext(WakuContext) as WakuContextType<T>;

type ProviderProps<T> = ReactChildrenProps & BootstrapNodeOptions<T>;

/**
 * Provider for creating Light Node based on options passed.
 * @example
 * const App = (props) => (
 *  <LightNodeProvider options={{...}}>
 *      <Component />
 *  </LightNodeProvider>
 * );
 * const Component = (props) => {
 *  const { node, isLoading, error } = useWaku<LightNode>();
 *  ...
 * };
 * @param {Object} props - options to create a node and other React props
 * @param {CreateNodeOptions} props.options - optional options for creating Light Node
 * @param {Protocols} props.protocols - optional protocols list to initiate node with
 * @returns React Light Node provider component
 */
export const LightNodeProvider: React.FunctionComponent<
  ProviderProps<CreateNodeOptions>
> = (props) => {
  const result = useCreateLightNode({
    options: props.options,
    protocols: props.protocols
  });

  return (
    <WakuContext.Provider value={result}>{props.children}</WakuContext.Provider>
  );
};
