import { Logger } from "@waku/utils";
import { Suite } from "mocha";

import { MOCHA_HOOK_MAX_TIMEOUT } from "../constants";
const log = new Logger("test:mocha-hook");

function withGracefulTimeout(
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
        log.error(
          "Mocha hook failed. Proceeding to the test so it can retry.",
          error
        );
        doneCallback();
      }
    }
  };

  void wrapperOperation();
  setTimeout(() => {
    if (!operationCompleted) {
      log.info(
        "Custom timeout reached. Proceeding to the test so it can retry."
      );
      operationCompleted = true;
      doneCallback();
    }
  }, timeoutDuration);
}

export const beforeEachCustom = function (
  suite: Suite,
  cb: () => Promise<void>
): void {
  const timeoutBefore = suite.timeout();
  suite.timeout(MOCHA_HOOK_MAX_TIMEOUT);
  suite.beforeEach((done) => {
    withGracefulTimeout(cb, done);
  });
  suite.timeout(timeoutBefore); // restore timeout to the original value
};

export const afterEachCustom = function (
  suite: Suite,
  cb: () => Promise<void>
): void {
  const timeoutBefore = suite.timeout();
  suite.timeout(MOCHA_HOOK_MAX_TIMEOUT);
  suite.afterEach((done) => {
    withGracefulTimeout(cb, done);
  });
  suite.timeout(timeoutBefore); // restore timeout to the original value
};
