/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Context, Effect, Layer, Ref } from "effect";

import { CacheError } from "../common/errors.js";
import type { DiscoveryError } from "../common/errors.js";
import type {
  DiscoveredPeer,
  CacheService as ICacheService,
  LocalCacheConfig as ILocalCacheConfig
} from "../common/types.js";

/**
 * Storage backend interface
 */
export interface StorageBackend {
  readonly get: (key: string) => Effect.Effect<string | null, CacheError>;
  readonly set: (key: string, value: string) => Effect.Effect<void, CacheError>;
  readonly delete: (key: string) => Effect.Effect<void, CacheError>;
  readonly clear: () => Effect.Effect<void, CacheError>;
}

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  readonly peer: DiscoveredPeer;
  readonly expiresAt: number;
}

/**
 * Cache Service tag
 */
export const CacheService = Context.GenericTag<ICacheService>("CacheService");

/**
 * Local Cache Config tag
 */
export const LocalCacheConfig =
  Context.GenericTag<ILocalCacheConfig>("LocalCacheConfig");

/**
 * Storage Backend tag
 */
export const StorageBackend =
  Context.GenericTag<StorageBackend>("StorageBackend");

/**
 * LocalStorage backend implementation
 */
export const LocalStorageBackend = Layer.succeed(StorageBackend, {
  get: (key: string) =>
    Effect.try({
      try: () => {
        if (typeof window === "undefined" || !window.localStorage) {
          return null;
        }
        return window.localStorage.getItem(key);
      },
      catch: (error) =>
        new CacheError({
          operation: "read",
          key,
          reason: `Failed to get from localStorage: ${error}`
        })
    }),

  set: (key: string, value: string) =>
    Effect.try({
      try: () => {
        if (typeof window === "undefined" || !window.localStorage) {
          return;
        }
        window.localStorage.setItem(key, value);
      },
      catch: (error) =>
        new CacheError({
          operation: "write",
          key,
          reason: `Failed to set in localStorage: ${error}`
        })
    }),

  delete: (key: string) =>
    Effect.try({
      try: () => {
        if (typeof window === "undefined" || !window.localStorage) {
          return;
        }
        window.localStorage.removeItem(key);
      },
      catch: (error) =>
        new CacheError({
          operation: "delete",
          key,
          reason: `Failed to delete from localStorage: ${error}`
        })
    }),

  clear: () =>
    Effect.try({
      try: () => {
        if (typeof window === "undefined" || !window.localStorage) {
          return;
        }
        window.localStorage.clear();
      },
      catch: (error) =>
        new CacheError({
          operation: "clear",
          reason: `Failed to clear localStorage: ${error}`
        })
    })
});

/**
 * In-memory storage backend for Node.js
 */
export const InMemoryStorageBackend = Layer.effect(
  StorageBackend,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, string>());

    return {
      get: (key: string) =>
        Ref.get(store).pipe(Effect.map((map) => map.get(key) || null)),

      set: (key: string, value: string) =>
        Ref.update(store, (map) => new Map(map).set(key, value)),

      delete: (key: string) =>
        Ref.update(store, (map) => {
          const newMap = new Map(map);
          newMap.delete(key);
          return newMap;
        }),

      clear: () => Ref.set(store, new Map())
    };
  })
);

/**
 * Platform-aware storage backend
 */
export const PlatformStorageBackend =
  typeof window !== "undefined" ? LocalStorageBackend : InMemoryStorageBackend;

/**
 * Cache service implementation using Ref for thread safety
 */
export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const config = yield* LocalCacheConfig;
    const storage = yield* StorageBackend;

    // Ref-based cache state
    const cache = yield* Ref.make(new Map<string, CacheEntry>());

    // Load initial data from storage
    yield* Effect.gen(function* () {
      const data = yield* storage.get(
        config.storageKey || "waku:discovery:cache"
      );
      if (!data) return;

      try {
        const entries = JSON.parse(data) as Array<{
          key: string;
          value: CacheEntry;
        }>;

        const now = Date.now();
        const validEntries = entries.filter(
          ({ value }) => value.expiresAt > now
        );

        yield* Ref.update(cache, () => {
          const map = new Map<string, CacheEntry>();
          validEntries.forEach(({ key, value }) => {
            map.set(key, value);
          });
          return map;
        });

        yield* Effect.logInfo(`Loaded ${validEntries.length} peers from cache`);
      } catch (error) {
        yield* Effect.logWarning("Failed to load cache from storage", error);
      }
    });

    // Persist cache to storage
    const persist = () =>
      Effect.gen(function* () {
        const map = yield* Ref.get(cache);
        const entries = Array.from(map.entries()).map(([key, value]) => ({
          key,
          value
        }));
        const data = JSON.stringify(entries);
        yield* storage.set(config.storageKey || "waku:discovery:cache", data);
      }).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Failed to persist cache", error)
        ),
        Effect.orElseSucceed(() => void 0)
      );

    // Clean expired entries
    const cleanExpired = () =>
      Ref.update(cache, (map) => {
        const now = Date.now();
        const newMap = new Map(map);

        for (const [key, entry] of newMap) {
          if (entry.expiresAt <= now) {
            newMap.delete(key);
          }
        }

        return newMap;
      });

    return {
      get: (
        key: string
      ): Effect.Effect<DiscoveredPeer | null, DiscoveryError> =>
        Effect.gen(function* () {
          // Clean expired entries first
          yield* cleanExpired();

          const map = yield* Ref.get(cache);
          const entry = map.get(key);

          if (!entry) return null;

          // Check expiration
          if (entry.expiresAt <= Date.now()) {
            yield* Ref.update(cache, (m) => {
              const newMap = new Map(m);
              newMap.delete(key);
              return newMap;
            });
            yield* persist();
            return null;
          }

          return entry.peer;
        }),

      set: (
        key: string,
        peer: DiscoveredPeer
      ): Effect.Effect<void, DiscoveryError> =>
        Effect.gen(function* () {
          const entry: CacheEntry = {
            peer,
            expiresAt: Date.now() + config.ttl
          };

          // Check cache size limit
          const currentMap = yield* Ref.get(cache);
          if (currentMap.size >= config.maxSize) {
            // Remove oldest entries
            const sortedEntries = Array.from(currentMap.entries()).sort(
              ([, a], [, b]) => a.expiresAt - b.expiresAt
            );

            const toRemove = sortedEntries.slice(
              0,
              Math.ceil(config.maxSize * 0.2)
            );

            yield* Ref.update(cache, (map) => {
              const newMap = new Map(map);
              toRemove.forEach(([k]) => newMap.delete(k));
              newMap.set(key, entry);
              return newMap;
            });
          } else {
            yield* Ref.update(cache, (map) => new Map(map).set(key, entry));
          }

          yield* persist();
        }),

      delete: (key: string): Effect.Effect<void, DiscoveryError> =>
        Effect.gen(function* () {
          yield* Ref.update(cache, (map) => {
            const newMap = new Map(map);
            newMap.delete(key);
            return newMap;
          });
          yield* persist();
        }),

      clear: (): Effect.Effect<void, DiscoveryError> =>
        Effect.gen(function* () {
          yield* Ref.set(cache, new Map());
          yield* storage.clear();
        }),

      getAll: (): Effect.Effect<readonly DiscoveredPeer[], DiscoveryError> =>
        Effect.gen(function* () {
          yield* cleanExpired();
          const map = yield* Ref.get(cache);
          return Array.from(map.values()).map((entry) => entry.peer);
        })
    };
  })
);

/**
 * Default cache configuration
 */
export const defaultCacheConfig: ILocalCacheConfig = {
  maxSize: 100,
  ttl: 3600000, // 1 hour
  storageKey: "waku:discovery:cache"
};

/**
 * Complete cache layer with storage
 */
export const CacheServiceWithStorage = CacheServiceLive.pipe(
  Layer.provide(PlatformStorageBackend),
  Layer.provide(Layer.succeed(LocalCacheConfig, defaultCacheConfig))
);
