import type {
  IDecodedMessage,
  IDecoder,
  IFilter,
  IWaku
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import React from "react";

import type { HookState } from "./types.js";

const log = new Logger("react:useFilterMessages");

type AbstractFilterNode = IWaku & {
  filter: IFilter;
};

type UseFilterMessagesParams = {
  node: undefined | AbstractFilterNode;
  decoder: undefined | IDecoder<IDecodedMessage>;
};

type UseFilterMessagesResult = HookState & {
  messages: IDecodedMessage[];
};

/**
 * Returns messages from Filter subscription and keeps them up to date
 * @example
 * const { isLoading, error, message } = useFilterMessages({node, decoder});
 * @param {Object} node - node that implements Filter, hook does nothing if undefined
 * @param {Object} decoder - decoder to use for subscribing, hook does nothing if undefined
 * @returns {Object} hook state (isLoading, error) and messages array
 */
export const useFilterMessages = (
  params: UseFilterMessagesParams
): UseFilterMessagesResult => {
  const { node, decoder } = params;

  const [error, setError] = React.useState<undefined | string>(undefined);
  const [isLoading, setLoading] = React.useState<boolean>(false);
  const [messages, setMessage] = React.useState<IDecodedMessage[]>([]);

  const pushMessage = React.useCallback(
    (message: IDecodedMessage): void => {
      if (!message) {
        return;
      }

      setMessage((prev) => [...prev, message]);
    },
    [setMessage]
  );

  React.useEffect(() => {
    if (!node || !decoder) {
      return;
    }

    setLoading(true);

    node.filter
      .subscribe([decoder], pushMessage)
      .then((success) => {
        setLoading(false);
        if (!success) {
          setError("Failed to subscribe to filter");
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(
          `Failed to subscribe to filter: ${err?.message || "no message"}`
        );
      });

    return () => {
      node.filter.unsubscribe([decoder]).catch((err) => {
        log.error("Failed to unsubscribe:", err);
      });
    };
  }, [node, decoder, pushMessage, setError, setLoading]);

  return {
    error,
    messages,
    isLoading
  };
};
