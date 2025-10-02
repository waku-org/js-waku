import { LightPushError } from "@waku/interfaces";

export const shouldPeerBeChanged = (
  failure: string | LightPushError
): boolean => {
  const toBeChanged =
    failure === LightPushError.REMOTE_PEER_REJECTED ||
    failure === LightPushError.NO_RESPONSE ||
    failure === LightPushError.RLN_PROOF_GENERATION ||
    failure === LightPushError.NO_PEER_AVAILABLE;

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
