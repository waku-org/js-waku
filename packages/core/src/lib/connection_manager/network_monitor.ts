import { IWakuEventEmitter, Libp2p, WakuEvent } from "@waku/interfaces";

type NetworkMonitorConstructorOptions = {
  libp2p: Libp2p;
  events: IWakuEventEmitter;
};

interface INetworkMonitor {
  start(): void;
  stop(): void;
  isConnected(): boolean;
  isP2PConnected(): boolean;
  isBrowserConnected(): boolean;
}

export class NetworkMonitor implements INetworkMonitor {
  private readonly libp2p: Libp2p;
  private readonly events: IWakuEventEmitter;

  private isNetworkConnected: boolean = false;

  public constructor(options: NetworkMonitorConstructorOptions) {
    this.libp2p = options.libp2p;
    this.events = options.events;

    this.onConnectedEvent = this.onConnectedEvent.bind(this);
    this.onDisconnectedEvent = this.onDisconnectedEvent.bind(this);
    this.dispatchNetworkEvent = this.dispatchNetworkEvent.bind(this);
  }

  public start(): void {
    this.libp2p.addEventListener("peer:connect", this.onConnectedEvent);
    this.libp2p.addEventListener("peer:disconnect", this.onDisconnectedEvent);

    try {
      globalThis.addEventListener("online", this.dispatchNetworkEvent);
      globalThis.addEventListener("offline", this.dispatchNetworkEvent);
    } catch (err) {
      // ignore
    }
  }

  public stop(): void {
    this.libp2p.removeEventListener("peer:connect", this.onConnectedEvent);
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onDisconnectedEvent
    );

    try {
      globalThis.removeEventListener("online", this.dispatchNetworkEvent);
      globalThis.removeEventListener("offline", this.dispatchNetworkEvent);
    } catch (err) {
      // ignore
    }
  }

  /**
   * Returns true if the node is connected to the network via libp2p and browser.
   */
  public isConnected(): boolean {
    if (!this.isBrowserConnected()) {
      return false;
    }

    return this.isP2PConnected();
  }

  /**
   * Returns true if the node is connected to the network via libp2p.
   */
  public isP2PConnected(): boolean {
    return this.isNetworkConnected;
  }

  /**
   * Returns true if the node is connected to the network via browser.
   */
  public isBrowserConnected(): boolean {
    try {
      if (globalThis?.navigator && !globalThis?.navigator?.onLine) {
        return false;
      }
    } catch (err) {
      // ignore
    }

    return true;
  }

  private onConnectedEvent(): void {
    if (!this.isNetworkConnected) {
      this.isNetworkConnected = true;
      this.dispatchNetworkEvent();
    }
  }

  private onDisconnectedEvent(): void {
    if (this.isNetworkConnected && this.libp2p.getConnections().length === 0) {
      this.isNetworkConnected = false;
      this.dispatchNetworkEvent();
    }
  }

  private dispatchNetworkEvent(): void {
    this.events.dispatchEvent(
      new CustomEvent<boolean>(WakuEvent.Connection, {
        detail: this.isConnected()
      })
    );
  }
}
