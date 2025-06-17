/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PeerId } from "@libp2p/interface";
import type { PubsubTopic } from "@waku/interfaces";
import { Context, Effect, Layer, Queue, Ref, Schedule, Stream } from "effect";

import { NetworkTimeoutError } from "../common/errors.js";
import type {
  DiscoveredPeer,
  PeerExchangeConfig as IPeerExchangeConfig,
  PeerExchangeService as IPeerExchangeService
} from "../common/types.js";
import { enrToDiscoveredPeer } from "../common/utils.js";

import {
  PeerExchangeProtocol,
  PeerExchangeProtocolLive
} from "./peer-exchange-protocol.js";

// const log = new Logger("effect:peer-exchange")

/**
 * Peer Exchange Service tag
 */
export const PeerExchangeService = Context.GenericTag<IPeerExchangeService>(
  "PeerExchangeService"
);

/**
 * Peer Exchange Config tag
 */
export const PeerExchangeConfig =
  Context.GenericTag<IPeerExchangeConfig>("PeerExchangeConfig");

/**
 * Peer query state
 */
interface PeerQueryState {
  readonly peerId: PeerId;
  readonly attempts: number;
  readonly lastQuery: Date;
  readonly isActive: boolean;
}

/**
 * Peer Exchange Service implementation
 */
export const PeerExchangeServiceLive = Layer.effect(
  PeerExchangeService,
  Effect.gen(function* () {
    const config = yield* PeerExchangeConfig;
    const protocol = yield* PeerExchangeProtocol;

    // State management for peer queries
    const queryStates = yield* Ref.make(new Map<string, PeerQueryState>());
    const discoveryQueue = yield* Queue.unbounded<DiscoveredPeer>();
    const isRunning = yield* Ref.make(true);

    /**
     * Query a single peer for peer exchange
     */
    const queryPeer = (peerId: PeerId, numPeers: number) =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Querying peer ${peerId} for ${numPeers} peers`);

        const result = yield* protocol
          .query({
            peerId,
            numPeers
          })
          .pipe(
            Effect.timeout("30 seconds"),
            Effect.mapError((error) => {
              if (error._tag === "TimeoutException") {
                return new NetworkTimeoutError({
                  operation: `Peer exchange query to ${peerId}`,
                  timeoutMs: 30000
                });
              }
              return error;
            })
          );

        const peers: DiscoveredPeer[] = [];

        for (const peerInfo of result.peerInfos) {
          if (!peerInfo.ENR) continue;

          const discoveredPeer = yield* enrToDiscoveredPeer(peerInfo.ENR, {
            _tag: "peer-exchange",
            fromPeer: peerId
          }).pipe(
            Effect.tapError((error) =>
              Effect.logWarning(`Failed to convert ENR to peer`, error)
            ),
            Effect.option
          );

          if (discoveredPeer._tag === "Some") {
            peers.push(discoveredPeer.value);
          }
        }

        yield* Effect.logInfo(
          `Discovered ${peers.length} peers from ${peerId}`
        );

        return peers;
      }).pipe(
        Effect.tapError((error) =>
          Effect.logWarning(`Failed to query peer ${peerId}`, error)
        ),
        Effect.orElseSucceed(() => [] as DiscoveredPeer[])
      );

    /**
     * Start recurring queries for a peer
     */
    const startRecurringQueries = (peerId: PeerId) =>
      Effect.gen(function* () {
        const peerIdStr = peerId.toString();

        // Check if already querying
        const states = yield* Ref.get(queryStates);
        const existingState = states.get(peerIdStr);

        if (existingState?.isActive) {
          return;
        }

        // Initialize state
        yield* Ref.update(queryStates, (states) =>
          new Map(states).set(peerIdStr, {
            peerId,
            attempts: 0,
            lastQuery: new Date(),
            isActive: true
          })
        );

        // Query loop
        yield* Effect.repeat(
          Effect.gen(function* () {
            // Check if still running
            const running = yield* Ref.get(isRunning);
            if (!running) return;

            // Get current state
            const states = yield* Ref.get(queryStates);
            const state = states.get(peerIdStr);

            if (
              !state ||
              !state.isActive ||
              state.attempts >= config.maxRetries
            ) {
              yield* stopQueriesForPeer(peerIdStr);
              return;
            }

            // Query peer
            const peers = yield* queryPeer(peerId, config.numPeersToRequest);

            // Queue discovered peers
            yield* Queue.offerAll(discoveryQueue, peers);

            // Update state
            yield* Ref.update(queryStates, (states) => {
              const newStates = new Map(states);
              const current = newStates.get(peerIdStr);
              if (current) {
                newStates.set(peerIdStr, {
                  ...current,
                  attempts: current.attempts + 1,
                  lastQuery: new Date()
                });
              }
              return newStates;
            });
          }),
          Schedule.exponential(config.queryInterval, 2).pipe(
            Schedule.jittered,
            Schedule.upTo(config.queryInterval * 10)
          )
        ).pipe(
          Effect.fork,
          Effect.tapError((error) =>
            Effect.logError(
              `Error in recurring queries for ${peerIdStr}`,
              error
            )
          )
        );
      });

    /**
     * Stop queries for a peer
     */
    const stopQueriesForPeer = (peerIdStr: string) =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Stopping queries for peer ${peerIdStr}`);

        yield* Ref.update(queryStates, (states) => {
          const newStates = new Map(states);
          const state = newStates.get(peerIdStr);
          if (state) {
            newStates.set(peerIdStr, { ...state, isActive: false });
          }
          return newStates;
        });
      });

    /**
     * Handle a new peer that supports peer exchange
     */
    const handlePeerExchangePeer = (peerId: PeerId) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`Discovered peer exchange peer: ${peerId}`);
        yield* startRecurringQueries(peerId);
      });

    /**
     * Start discovery stream
     */
    const discover = () =>
      Stream.fromQueue(discoveryQueue).pipe(
        Stream.tap((peer) =>
          Effect.logDebug(`Emitting discovered peer ${peer.peerInfo.id}`)
        )
      );

    /**
     * Stop the service
     */
    const stop = () =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Stopping peer exchange service");
        yield* Ref.set(isRunning, false);

        // Stop all peer queries
        const states = yield* Ref.get(queryStates);
        yield* Effect.forEach(Array.from(states.keys()), stopQueriesForPeer, {
          concurrency: "unbounded"
        });

        yield* Queue.shutdown(discoveryQueue);
      });

    return {
      discover,
      stop,
      queryPeer,
      handlePeerExchangePeer
    } satisfies IPeerExchangeService;
  })
);

/**
 * Create Peer Exchange service layer
 */
export const createPeerExchangeLayer = (
  pubsubTopics: PubsubTopic[],
  config: IPeerExchangeConfig
): Layer.Layer<IPeerExchangeService, never, any> =>
  PeerExchangeServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(PeerExchangeConfig, config),
        PeerExchangeProtocolLive(pubsubTopics)
      )
    )
  );
