import type {
  IDecodedMessage,
  IDecoder,
  IStore,
  IWaku,
  QueryRequestParams
} from "@waku/interfaces";
import React from "react";

import type { HookState } from "./types.js";

type AbstractStoreNode = IWaku & {
  store: IStore;
};

type UseStoreMessagesParams = {
  node: undefined | AbstractStoreNode;
  decoder: undefined | IDecoder<IDecodedMessage>;
  options: QueryRequestParams;
};

type UseStoreMessagesResult = HookState & {
  messages: IDecodedMessage[];
};

/**
 * Hook for retrieving messages from Store protocol based on options
 * @example
 * const { isLoading, error, messages } = useStoreMessages({node, decoder, options});
 * @param {Object} node - node that implement Store, hook does nothing if undefined
 * @param {Object} decoder - decoder to use for getting messages, hook does nothing if undefined
 * @param {QueryRequestParams} options - options to initiate query to get messages
 * @returns {Object} hook state (isLoading, error) and messages array
 */
export const useStoreMessages = (
  params: UseStoreMessagesParams
): UseStoreMessagesResult => {
  const { node, decoder, options } = params;

  const [error, setError] = React.useState<undefined | string>(undefined);
  const [isLoading, setLoading] = React.useState<boolean>(false);
  const [messages, setMessage] = React.useState<IDecodedMessage[]>([]);

  const pushMessage = React.useCallback(
    (newMessages: IDecodedMessage[]): void => {
      if (!newMessages || !newMessages.length) {
        return;
      }

      setMessage((prev) => [...prev, ...newMessages]);
    },
    [setMessage]
  );

  React.useEffect(() => {
    if (!node || !decoder) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.resolve()
      .then(async () => {
        for await (const promises of node.store.queryGenerator(
          [decoder],
          options
        )) {
          if (cancelled) {
            return;
          }

          const messagesRaw = await Promise.all(promises);
          const filteredMessages = messagesRaw.filter(
            (v): v is IDecodedMessage => !!v
          );

          pushMessage(filteredMessages);
        }

        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setError(
          `Failed to query messages from store: ${err?.message || "no message"}`
        );
      });

    return () => {
      cancelled = true;
    };
    // TODO: missing dependency on options, it will prevent consecutive update if options change
  }, [node, decoder, pushMessage, setError, setLoading]);

  return {
    error,
    isLoading,
    messages
  };
};
