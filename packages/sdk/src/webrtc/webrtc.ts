import { PeerId, TypedEventEmitter } from "@libp2p/interface";
import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IFilter,
  ILightPush,
  IWebRTC,
  IWebRTCEvents,
  PeerIdOrString,
  WebRTCDialOptions
} from "@waku/interfaces";

type WebRTCConstructorOptions = {
  lightPush: ILightPush;
  filter: IFilter;
  decoder: IDecoder<IDecodedMessage>;
  encoder: IEncoder;
};

export class WebRTC implements IWebRTC {
  private readonly lightPush: ILightPush;
  private readonly filter: IFilter;

  private readonly decoder: IDecoder<IDecodedMessage>;
  private readonly encoder: IEncoder;

  public readonly events: TypedEventEmitter<IWebRTCEvents> =
    new TypedEventEmitter();

  private isStarted = false;

  public static buildContentTopic(peerId: PeerId): string {
    return `/js-waku-webrtc/1/${peerId.toString()}/proto`;
  }

  public constructor(options: WebRTCConstructorOptions) {
    this.lightPush = options.lightPush;
    this.filter = options.filter;

    this.decoder = options.decoder;
    this.encoder = options.encoder;

    this.handleInboundRequest = this.handleInboundRequest.bind(this);
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    await this.subscribeToInboundRequests();
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;
    await this.unsubscribeFromInboundRequests();
  }

  public async dial(options: WebRTCDialOptions): Promise<void> {
    // TODO: implement
  }

  public accept(peerId: PeerIdOrString): void {
    // TODO: implement
  }

  public hangUp(peerId: PeerIdOrString): void {
    // TODO: implement
  }

  public isConnected(peerId: PeerIdOrString): boolean {
    // TODO: implement
    return false;
  }

  public getConnectedPeers(): PeerId[] {
    // TODO: implement
    return [];
  }

  public getConnections(): Record<string, RTCPeerConnection> {
    // TODO: implement
    return {};
  }

  private async subscribeToInboundRequests(): Promise<void> {
    await this.filter.subscribe(this.decoder, this.handleInboundRequest);
  }

  private async unsubscribeFromInboundRequests(): Promise<void> {
    await this.filter.unsubscribe(this.decoder);
  }

  private handleInboundRequest(message: IDecodedMessage): void {
    /*
    const decryptedMessage = decrypt(message.payload, this.privateKey);
    switch (decryptedMessage.type) {
      case "dial":
        break;
      case "ack":
        break;
      case "answer":
        break;
      case "reject":
        break;
      case "candidate":
        break;
      case "close":
        break;
      default:
        break;
    }
    */
  }
}
