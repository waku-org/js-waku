/**
 * Logging integration between Waku Logger and Effect Console
 *
 * This module provides a bridge between the existing Waku logging infrastructure
 * (which uses the 'debug' package) and Effect's logging capabilities, allowing
 * for seamless integration while maintaining compatibility with the rest of
 * the monorepo.
 */

import { Logger as WakuLogger } from "@waku/utils";
import { Console, Context, Effect, Layer } from "effect";

/**
 * Log levels matching Effect's Console interface
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Extended logging interface that combines Waku Logger with Effect Console
 */
export interface EffectLogger {
  readonly debug: (...args: ReadonlyArray<unknown>) => Effect.Effect<void>;
  readonly info: (...args: ReadonlyArray<unknown>) => Effect.Effect<void>;
  readonly warn: (...args: ReadonlyArray<unknown>) => Effect.Effect<void>;
  readonly error: (...args: ReadonlyArray<unknown>) => Effect.Effect<void>;
  readonly log: (
    level: LogLevel,
    ...args: ReadonlyArray<unknown>
  ) => Effect.Effect<void>;
  readonly wakuLogger: WakuLogger;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  readonly prefix: string;
  readonly enableEffectConsole?: boolean;
  readonly enableWakuLogger?: boolean;
}

/**
 * Default logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  prefix: "effect:discovery",
  enableEffectConsole: false, // Disabled by default to avoid noise
  enableWakuLogger: true // Use Waku Logger by default for consistency
};

/**
 * Creates a logger instance that bridges Waku Logger and Effect Console
 */
function createEffectLogger(config: LoggerConfig): EffectLogger {
  const wakuLogger = new WakuLogger(config.prefix);

  const createLogFunction =
    (level: LogLevel) =>
    (...args: ReadonlyArray<unknown>): Effect.Effect<void> =>
      Effect.gen(function* () {
        // Always log through Waku Logger if enabled (for consistency with monorepo)
        if (config.enableWakuLogger) {
          const wakuLogLevel = level === "debug" ? "info" : level;
          wakuLogger.log(wakuLogLevel as "info" | "warn" | "error", ...args);
        }

        // Optionally log through Effect Console (useful for Effect-aware tooling)
        if (config.enableEffectConsole) {
          switch (level) {
            case "debug":
              yield* Console.debug(...args);
              break;
            case "info":
              yield* Console.info(...args);
              break;
            case "warn":
              yield* Console.warn(...args);
              break;
            case "error":
              yield* Console.error(...args);
              break;
          }
        }
      });

  return {
    debug: createLogFunction("debug"),
    info: createLogFunction("info"),
    warn: createLogFunction("warn"),
    error: createLogFunction("error"),
    log: (level: LogLevel, ...args: ReadonlyArray<unknown>) =>
      createLogFunction(level)(...args),
    wakuLogger
  };
}

/**
 * Logger service tag for dependency injection
 */
export const EffectLoggerService =
  Context.GenericTag<EffectLogger>("EffectLogger");

/**
 * Logger service layer with default configuration
 */
export const EffectLoggerLive = Layer.succeed(
  EffectLoggerService,
  createEffectLogger(DEFAULT_LOGGER_CONFIG)
);

/**
 * Creates a logger service layer with custom configuration
 */
export const createLoggerLayer = (
  config: Partial<LoggerConfig>
): Layer.Layer<EffectLogger> =>
  Layer.succeed(
    EffectLoggerService,
    createEffectLogger({ ...DEFAULT_LOGGER_CONFIG, ...config })
  );

/**
 * Convenience function to create a logger for a specific service
 */
export const createServiceLogger = (
  serviceName: string,
  config?: Partial<LoggerConfig>
): Layer.Layer<EffectLogger> =>
  createLoggerLayer({
    ...config,
    prefix: `effect:${serviceName}`
  });

/**
 * Logger layer specifically for DNS discovery
 */
export const DnsLoggerLive = createServiceLogger("dns-discovery");

/**
 * Logger layer specifically for peer exchange
 */
export const PeerExchangeLoggerLive = createServiceLogger("peer-exchange");

/**
 * Logger layer specifically for local cache
 */
export const LocalCacheLoggerLive = createServiceLogger("local-cache");

/**
 * Helper to log with context information in Effect computations
 */
export const logWithContext = (
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): Effect.Effect<void, never, EffectLogger> =>
  Effect.gen(function* () {
    const logger = yield* EffectLoggerService;
    yield* logger.log(level, message, context ? { context } : undefined);
  });

/**
 * Helper to log errors with proper formatting
 */
export const logError = (
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): Effect.Effect<void, never, EffectLogger> =>
  Effect.gen(function* () {
    const logger = yield* EffectLoggerService;
    yield* logger.error(message, {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          : error,
      context
    });
  });

/**
 * Helper to log peer discovery events
 */
export const logPeerDiscovered = (
  peerId: string,
  source: string,
  additional?: Record<string, unknown>
): Effect.Effect<void, never, EffectLogger> =>
  Effect.gen(function* () {
    const logger = yield* EffectLoggerService;
    yield* logger.info("peer discovered", {
      peerId,
      source,
      ...additional
    });
  });

/**
 * Helper to log discovery operations with timing
 */
export const logDiscoveryOperation = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | EffectLogger> =>
  Effect.gen(function* () {
    const logger = yield* EffectLoggerService;
    const startTime = Date.now();

    yield* logger.debug(`starting ${operation}`);

    const result = yield* effect;
    const duration = Date.now() - startTime;

    yield* logger.debug(`completed ${operation}`, {
      duration: `${duration}ms`
    });

    return result;
  });

/**
 * Environment variable to enable Effect Console logging
 * Set WAKU_ENABLE_EFFECT_CONSOLE=true to enable Effect Console output
 */
export const isEffectConsoleEnabled = (): boolean =>
  process.env.WAKU_ENABLE_EFFECT_CONSOLE === "true";

/**
 * Environment variable to disable Waku Logger
 * Set WAKU_DISABLE_WAKU_LOGGER=true to disable Waku Logger output
 */
export const isWakuLoggerEnabled = (): boolean =>
  process.env.WAKU_DISABLE_WAKU_LOGGER !== "true";

/**
 * Creates a logger layer based on environment variables
 */
export const createEnvironmentLoggerLayer = (
  serviceName: string
): Layer.Layer<EffectLogger> =>
  createServiceLogger(serviceName, {
    enableEffectConsole: isEffectConsoleEnabled(),
    enableWakuLogger: isWakuLoggerEnabled()
  });
