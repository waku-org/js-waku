import type { PeerId, TypedEventEmitter } from "@libp2p/interface";

export enum WebRTCEvent {
  InboundRequest = "webRTC:inbound-request",
  Connected = "webRTC:connected",
  Closed = "webRTC:closed",
  Rejected = "webRTC:rejected"
}

export interface IWebRTCEvents {
  /**
   * Used to listen to incoming WebRTC connection request.
   *
   * @example
   * ```typescript
   * waku.addEventListener(WebRTCEvent.Inbound, (event) => {
   *   const requesterPeerId = event.detail;
   *
   *   if (requesterPeerId.equals(expectedPeerId)) {
   *     waku.webRTC.accept(requesterPeerId);
   *   } else {
   *     waku.webRTC.hangUp(requesterPeerId);
   *   }
   * });
   */
  [WebRTCEvent.InboundRequest]: CustomEvent<PeerId>;

  /**
   * Used to listen to get notified when a WebRTC connection is established.
   *
   * @example
   * ```typescript
   * waku.addEventListener(WebRTCEvent.Connected, (event) => {
   *   const connection = event.detail; // RTCPeerConnection
   * });
   * ```
   */
  [WebRTCEvent.Connected]: CustomEvent<RTCPeerConnection>;
}

export type PeerIdOrString = PeerId | string;

export type WebRTCDialOptions = {
  peerId: PeerIdOrString;
  timeoutMs?: number;
};

export interface IWebRTC {
  /**
   * Used to listen to incoming WebRTC connection request or progress of established connections.
   */
  events: TypedEventEmitter<IWebRTCEvents>;

  /**
   * Starts the listening to incoming WebRTC connection requests.
   */
  start(): Promise<void>;

  /**
   * Stops the listening to incoming WebRTC connection requests.
   */
  stop(): Promise<void>;

  /**
   * Dials a peer using Waku WebRTC protocol.
   */
  dial(options: WebRTCDialOptions): Promise<void>;

  /**
   * Accepts a WebRTC connection request from a peer.
   */
  accept(peerId: PeerIdOrString): void;

  /**
   * Hang up a WebRTC connection to a peer or incoming connection request.
   */
  hangUp(peerId: PeerIdOrString): void;

  /**
   * Checks if a WebRTC connection is established to a peer.
   */
  isConnected(peerId: PeerIdOrString): boolean;

  /**
   * Gets the list of connected peers using Waku WebRTC protocol.
   */
  getConnectedPeers(): PeerId[];

  /**
   * Gets map of WebRTC connections by peer ID.
   */
  getConnections(): Record<string, RTCPeerConnection>;
}
