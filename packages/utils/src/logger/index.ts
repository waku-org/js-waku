import debug, { Debugger } from "debug";

const APP_NAME = "js-waku";

export class Logger {
  private _info: Debugger;
  private _warn: Debugger;
  private _error: Debugger;

  static createDebugNamespace(level: string, prefix?: string): string {
    return prefix ? `${APP_NAME}:${level}:${prefix}` : `${APP_NAME}:${level}`;
  }

  constructor(prefix?: string) {
    this._info = debug(Logger.createDebugNamespace("info", prefix));
    this._warn = debug(Logger.createDebugNamespace("warn", prefix));
    this._error = debug(Logger.createDebugNamespace("error", prefix));
  }

  get info(): Debugger {
    return this._info;
  }

  get warn(): Debugger {
    return this._warn;
  }

  get error(): Debugger {
    return this._error;
  }

  log(level: "info" | "warn" | "error", ...args: unknown[]): void {
    const logger = this[level] as (...args: unknown[]) => void;
    logger(...args);
  }
}
