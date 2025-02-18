import { ProtocolError } from "@waku/interfaces";

export const isPeerShouldBeChanged = (
  failure: string | ProtocolError
): boolean => {
  const toBeChanged =
    failure === ProtocolError.REMOTE_PEER_REJECTED ||
    failure === ProtocolError.NO_RESPONSE ||
    failure === ProtocolError.RLN_LIMIT_MISSING;

  if (toBeChanged) {
    return true;
  }

  return false;
};

export const timeout = (timeout: number): Promise<void> => {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Task timeout")), timeout)
  );
};
