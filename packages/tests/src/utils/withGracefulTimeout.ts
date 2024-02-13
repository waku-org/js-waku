import { Logger } from "@waku/utils";

import { MOCHA_HOOK_MAX_TIMEOUT } from "../constants";
const log = new Logger("test:mocha-hook");

export function withGracefulTimeout(
  asyncOperation: () => Promise<void>,
  doneCallback: (error?: unknown) => void,
  timeoutDuration: number = MOCHA_HOOK_MAX_TIMEOUT
): void {
  let operationCompleted = false;

  const wrapperOperation: () => Promise<void> = async () => {
    try {
      await asyncOperation();
      if (!operationCompleted) {
        operationCompleted = true;
        log.info("Mocha hook completed successfully.");
        doneCallback();
      }
    } catch (error) {
      if (!operationCompleted) {
        operationCompleted = true;
        log.error("Mocha hook failed:", error);
        doneCallback(error);
      }
    }
  };

  void wrapperOperation();
  setTimeout(() => {
    if (!operationCompleted) {
      log.info(
        "Custom timeout reached. Proceeding to the test so it can retry"
      );
      operationCompleted = true;
      doneCallback();
    }
  }, timeoutDuration);
}
