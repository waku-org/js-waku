import { PeerId } from "@libp2p/interface";
import { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";

type BootstrapTriggerConstructorOptions = {
  libp2p: Libp2p;
};

interface IBootstrapTrigger {
  start(): void;
  stop(): void;
}

const log = new Logger("bootstrap-trigger");

const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 1000;

export class BootstrapTrigger implements IBootstrapTrigger {
  private readonly libp2p: Libp2p;
  private bootstrapTimeout: NodeJS.Timeout | null = null;

  public constructor(options: BootstrapTriggerConstructorOptions) {
    this.libp2p = options.libp2p;
  }

  public start(): void {
    log.info("Starting bootstrap trigger");
    this.libp2p.addEventListener("peer:disconnect", this.onPeerDisconnectEvent);
  }

  public stop(): void {
    log.info("Stopping bootstrap trigger");
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onPeerDisconnectEvent
    );

    if (this.bootstrapTimeout) {
      clearTimeout(this.bootstrapTimeout);
      this.bootstrapTimeout = null;
      log.info("Cleared pending bootstrap timeout");
    }
  }

  private onPeerDisconnectEvent = (event: CustomEvent<PeerId>): void => {
    const peerId = event.detail;
    const connections = this.libp2p.getConnections();
    log.info(
      `Peer disconnected: ${peerId.toString()}, remaining connections: ${connections.length}`
    );

    if (connections.length !== 0) {
      return;
    }

    log.info(
      `Last peer disconnected, scheduling bootstrap in ${DEFAULT_BOOTSTRAP_TIMEOUT_MS} milliseconds`
    );

    if (this.bootstrapTimeout) {
      clearTimeout(this.bootstrapTimeout);
    }

    this.bootstrapTimeout = setTimeout(() => {
      log.info("Triggering bootstrap after timeout");
      this.triggerBootstrap();
      this.bootstrapTimeout = null;
    }, DEFAULT_BOOTSTRAP_TIMEOUT_MS);
  };

  private triggerBootstrap(): void {
    log.info("Triggering bootstrap discovery");

    const bootstrapComponents = Object.values(this.libp2p.components.components)
      .filter((c) => !!c)
      .filter(
        (c: unknown) =>
          (c as { [Symbol.toStringTag]: string })[Symbol.toStringTag] ===
          "@waku/bootstrap"
      );

    if (bootstrapComponents.length === 0) {
      log.warn("No bootstrap components found to trigger");
      return;
    }

    log.info(
      `Found ${bootstrapComponents.length} bootstrap components, starting them`
    );

    bootstrapComponents.forEach((component) => {
      try {
        (component as { start: () => void }).start();
        log.info("Successfully started bootstrap component");
      } catch (error) {
        log.error("Failed to start bootstrap component", error);
      }
    });
  }
}
