import debug, { Debugger } from "debug";

const APP_NAME = "waku";

export class Logger {
  private _info: Debugger;
  private _warn: Debugger;
  private _error: Debugger;

  public constructor(prefix?: string) {
    this._info = debug(Logger.createDebugNamespace("info", prefix));
    this._warn = debug(Logger.createDebugNamespace("warn", prefix));
    this._error = debug(Logger.createDebugNamespace("error", prefix));
  }

  public get info(): Debugger {
    return this._info;
  }

  public get warn(): Debugger {
    return this._warn;
  }

  public get error(): Debugger {
    return this._error;
  }

  public log(level: "info" | "warn" | "error", ...args: unknown[]): void {
    const logger = (this[level] as (...args: unknown[]) => void) || this.log;
    logger(...args);
  }

  private static createDebugNamespace(level: string, prefix?: string): string {
    return prefix ? `${APP_NAME}:${prefix}:${level}` : `${APP_NAME}:${level}`;
  }
}
