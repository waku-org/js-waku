import React from "react";

import type { ContentPair, ReactChildrenProps } from "./types.js";
import { useCreateContentPair } from "./useCreateContentPair.js";

type ContentPairContextType = Partial<ContentPair>;

const ContentPairContext = React.createContext<ContentPairContextType>({
  decoder: undefined,
  encoder: undefined
});

/**
 * Hook to retrieve Encoder/Decoder pair from Context.
 * @example
 * const { encoder, decoder } = useContentPair();
 * @returns {Object} { encoder, decoder }
 */
export const useContentPair = (): ContentPairContextType =>
  React.useContext(ContentPairContext);

type ContentPairProviderProps = ReactChildrenProps & {
  contentTopic: string;
  ephemeral?: boolean;
};

/**
 * Provider for creating Encoder/Decoder pair based on contentTopic
 * @example
 * const App = (props) => (
 *  <ContentPairProvider contentTopic="/toy-chat/2/huilong/proto">
 *      <Component />
 *  </ContentPairProvider>
 * );
 * const Component = (props) => {
 *  const { encoder, decoder } = useContentPair();
 *  ...
 * };
 * @param {string} contentTopic - content topic for configuring the pair
 * @param {boolean} ephemeral - flag to set messages ephemeral according to RFC https://rfc.vac.dev/spec/14/
 * @returns React ContentPair Provider component
 */
export const ContentPairProvider: React.FunctionComponent<
  ContentPairProviderProps
> = (props) => {
  const result = useCreateContentPair(props.contentTopic, props.ephemeral);

  return (
    <ContentPairContext.Provider value={result}>
      {props.children}
    </ContentPairContext.Provider>
  );
};
