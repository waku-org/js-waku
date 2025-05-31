/**
 * Shared utilities for working with Waku nodes
 * This file contains functions used by both browser tests and server
 */

/**
 * Type definition for a minimal Waku node interface
 * This allows us to use the same code in different contexts
 */
export interface IWakuNode {
  libp2p: {
    peerId: { toString(): string };
    getMultiaddrs(): Array<{ toString(): string }>;
    getProtocols(): any;
    peerStore: {
      all(): Promise<Array<{ id: { toString(): string } }>>;
    };
  };
  lightPush: {
    send: (encoder: any, message: { payload: Uint8Array }) => Promise<{ successes: any[] }>;
  };
}
