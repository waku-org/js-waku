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
    this._info = debug(Logger.createDebugNamespace("INFO", prefix));
    this._warn = debug(Logger.createDebugNamespace("WARN", prefix));
    this._error = debug(Logger.createDebugNamespace("ERROR", prefix));

    this._info.log = console.info.bind(console);
    this._warn.log = console.warn.bind(console);
    this._error.log = console.error.bind(console);
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
}
