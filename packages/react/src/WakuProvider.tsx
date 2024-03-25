import React from "react";
import type { Waku } from "@waku/interfaces";

import type {
  BootstrapNodeOptions,
  CreateNodeResult,
  CreateWakuNodeOptions,
  ReactChildrenProps,
} from "./types";
import { useCreateLightNode } from "./useCreateWaku";

type WakuContextType<T extends Waku> = CreateNodeResult<T>;

const WakuContext = React.createContext<WakuContextType<Waku>>({
  node: undefined,
  isLoading: false,
  error: undefined,
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
export const useWaku = <T extends Waku>(): WakuContextType<T> =>
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
 * @param {CreateWakuNodeOptions} props.options - optional options for creating Light Node
 * @param {Protocols} props.protocols - optional protocols list to initiate node with
 * @returns React Light Node provider component
 */
export const LightNodeProvider: React.FunctionComponent<
  ProviderProps<CreateWakuNodeOptions>
> = (props) => {
  const result = useCreateLightNode({
    options: props.options,
    protocols: props.protocols,
  });

  return (
    <WakuContext.Provider value={result}>{props.children}</WakuContext.Provider>
  );
};
