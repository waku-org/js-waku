import { TypedEventEmitter } from "@libp2p/interface";
import { messageHash } from "@waku/core";
import {
  type Callback,
  type IDecodedMessage,
  type IDecoder,
  type IEncoder,
  type IMessage,
  ISendOptions,
  type IWaku,
  ProtocolError,
  QueryRequestParams,
  SDKProtocolResult
} from "@waku/interfaces";
import {
  type ChannelId,
  isContentMessage,
  MessageChannel,
  MessageChannelEvent,
  type MessageChannelOptions,
  Message as SdsMessage,
  type SenderId,
  SyncMessage
} from "@waku/sds";
import { Logger } from "@waku/utils";

import {
  QueryOnConnect,
  QueryOnConnectEvent
} from "../query_on_connect/index.js";

import { ReliableChannelEvent, ReliableChannelEvents } from "./events.js";
import { MissingMessageRetriever } from "./missing_message_retriever.js";
import { RetryManager } from "./retry_manager.js";

export { ReliableChannelEvents, ReliableChannelEvent };

const log = new Logger("sdk:reliable-channel");

const DEFAULT_SYNC_MIN_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_RETRY_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_MAX_RETRY_ATTEMPTS = 10;
const DEFAULT_SWEEP_IN_BUF_INTERVAL_MS = 5 * 1000;

const IRRECOVERABLE_SENDING_ERRORS: ProtocolError[] = [
  ProtocolError.ENCODE_FAILED,
  ProtocolError.EMPTY_PAYLOAD,
  ProtocolError.SIZE_TOO_BIG,
  ProtocolError.RLN_PROOF_GENERATION,
  ProtocolError.TOPIC_DECODER_MISMATCH,
  ProtocolError.INVALID_DECODER_TOPICS
];

export type ReliableChannelOptions = MessageChannelOptions & {
  /**
   * The minimum interval between 2 sync messages in the channel.
   *
   * Meaning, how frequently we want messages in the channel, noting that the
   * responsibility of sending a sync messages is shared between participants
   * of the channel.
   *
   * `0` means no sync messages will be sent.
   *
   * @default 30,000 (30 seconds) [[DEFAULT_SYNC_MIN_INTERVAL_MS]]
   */
  syncMinIntervalMs?: number;

  /**
   * How long to wait before re-sending a message that as not acknowledged.
   *
   * @default 60,000 (60 seconds) [[DEFAULT_RETRY_INTERVAL_MS]]
   */
  retryIntervalMs?: number;

  /**
   * How many times do we attempt resending messages that were not acknowledged.
   *
   * @default 10 [[DEFAULT_MAX_RETRY_ATTEMPTS]]
   */
  maxRetryAttempts?: number;

  /**
   * How often store queries are done to retrieve missing messages.
   *
   * @default 10,000 (10 seconds)
   */
  retrieveFrequencyMs?: number;

  /**
   * How often SDS message channel incoming buffer is swept.
   *
   * @default 5000 (every 5 seconds)
   */
  sweepInBufIntervalMs?: number;

  /**
   * Whether to automatically do a store query after connection to store nodes.
   *
   * @default true
   */
  queryOnConnect?: boolean;

  /**
   * Whether to auto start the waku node and message channel
   *
   * @default true
   */
  autoStart?: boolean;
};

/**
 * An easy-to-use reliable channel that ensures all participants to the channel have eventual message consistency.
 *
 * Use events to track:
 * - if your outgoing messages are sent, acknowledged or error out
 * - for new incoming messages
 * @emits [[ReliableChannelEvents]]
 *
 */
export class ReliableChannel<
  T extends IDecodedMessage
> extends TypedEventEmitter<ReliableChannelEvents> {
  private readonly _send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ISendOptions
  ) => Promise<SDKProtocolResult>;

  private readonly _subscribe: (
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ) => Promise<boolean>;

  private readonly _retrieve?: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    options?: Partial<QueryRequestParams>
  ) => AsyncGenerator<Promise<T | undefined>[]>;

  private readonly syncMinIntervalMs: number;
  private syncTimeout: ReturnType<typeof setTimeout> | undefined;
  private sweepInBufInterval: ReturnType<typeof setInterval> | undefined;
  private readonly sweepInBufIntervalMs: number;
  private processTaskTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly retryManager: RetryManager | undefined;
  private readonly missingMessageRetriever?: MissingMessageRetriever<T>;
  private readonly queryOnConnect?: QueryOnConnect<T>;
  public isStarted: boolean;

  private constructor(
    public node: IWaku,
    public messageChannel: MessageChannel,
    private encoder: IEncoder,
    private decoder: IDecoder<T>,
    options?: ReliableChannelOptions
  ) {
    super();
    if (node.lightPush) {
      this._send = node.lightPush.send.bind(node.lightPush);
    } else if (node.relay) {
      this._send = node.relay.send.bind(node.relay);
    } else {
      throw "No protocol available to send messages";
    }

    if (node.filter) {
      this._subscribe = node.filter.subscribe.bind(node.filter);
    } else if (node.relay) {
      // TODO: Why do relay and filter have different interfaces?
      //  this._subscribe = node.relay.subscribeWithUnsubscribe;
      throw "Not implemented";
    } else {
      throw "No protocol available to receive messages";
    }

    if (node.store) {
      this._retrieve = node.store.queryGenerator.bind(node.store);
      const peerManagerEvents = (node as any)?.peerManager?.events;
      if (
        peerManagerEvents !== undefined &&
        (options?.queryOnConnect ?? true)
      ) {
        log.info("auto-query enabled");
        this.queryOnConnect = new QueryOnConnect(
          [this.decoder],
          peerManagerEvents,
          node.events,
          this._retrieve.bind(this)
        );
      }
    }

    this.syncMinIntervalMs =
      options?.syncMinIntervalMs ?? DEFAULT_SYNC_MIN_INTERVAL_MS;

    this.sweepInBufIntervalMs =
      options?.sweepInBufIntervalMs ?? DEFAULT_SWEEP_IN_BUF_INTERVAL_MS;

    const retryIntervalMs =
      options?.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
    const maxRetryAttempts =
      options?.maxRetryAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;

    if (retryIntervalMs && maxRetryAttempts) {
      // TODO: there is a lot to improve. e.g. not point retry to send if node is offline.
      this.retryManager = new RetryManager(retryIntervalMs, maxRetryAttempts);
    }

    if (this._retrieve) {
      this.missingMessageRetriever = new MissingMessageRetriever(
        this.decoder,
        options?.retrieveFrequencyMs,
        this._retrieve,
        async (msg: T) => {
          await this.processIncomingMessage(msg);
        }
      );
    }

    this.isStarted = false;
  }

  /**
   * Used to identify messages, pass the payload of a message you are
   * about to send to track the events for this message.
   * This is pre-sds wrapping
   * @param messagePayload
   */
  public static getMessageId(messagePayload: Uint8Array): string {
    return MessageChannel.getMessageId(messagePayload);
  }

  /**
   * Create a new message channels. Message channels enables end-to-end
   * reliability by ensuring that all messages in the channel are received
   * by other users, and retrieved by this local node.
   *
   * emits events about outgoing messages, see [[`ReliableChannel`]] docs.
   *
   * Note that all participants in a message channels need to get the messages
   * from the channel. Meaning:
   * - all participants must be able to decrypt the messages
   * - all participants must be subscribing to content topic(s) where the messages are sent
   *
   * @param node The waku node to use to send and receive messages
   * @param channelId An id for the channel, all participants of the channel should use the same id
   * @param senderId An id for the sender, to ensure acknowledgements are only valid if originating from someone else; best if persisted between sessions
   * @param encoder A channel operates within a singular encryption layer, hence the same encoder is needed for all messages
   * @param decoder A channel operates within a singular encryption layer, hence the same decoder is needed for all messages
   * @param options
   */
  public static async create<T extends IDecodedMessage>(
    node: IWaku,
    channelId: ChannelId,
    senderId: SenderId,
    encoder: IEncoder,
    decoder: IDecoder<T>,
    options?: ReliableChannelOptions
  ): Promise<ReliableChannel<T>> {
    const sdsMessageChannel = new MessageChannel(channelId, senderId, options);
    const messageChannel = new ReliableChannel(
      node,
      sdsMessageChannel,
      encoder,
      decoder,
      options
    );

    const autoStart = options?.autoStart ?? true;
    if (autoStart) {
      await node.start();
      await messageChannel.start();
    }

    return messageChannel;
  }

  /**
   * Sends a message in the channel, will attempt to re-send if not acknowledged
   * by other participants.
   *
   * @param messagePayload
   */
  public send(messagePayload: Uint8Array): void {
    const messageId = ReliableChannel.getMessageId(messagePayload);
    if (!this.isStarted) {
      this.safeSendEvent(ReliableChannelEvent.OutMessageIrrecoverableError, {
        detail: { messageId: messageId, error: "channel is not started" }
      });
    }
    const send = this._wrapAndSend.bind(this, messagePayload);
    this.retryManager?.startRetries(messageId, send);

    return send();
  }

  private _wrapAndSend(messagePayload: Uint8Array): void {
    this.messageChannel.pushOutgoingMessage(
      messagePayload,
      async (
        sdsMessage: SdsMessage
      ): Promise<{ success: boolean; retrievalHint?: Uint8Array }> => {
        // Callback is called once message has added to the SDS outgoing queue
        // We start by trying to send the message now.

        // `payload` wrapped in SDS
        const sdsPayload = sdsMessage.encode();

        const wakuMessage = {
          payload: sdsPayload
        };

        const messageId = ReliableChannel.getMessageId(messagePayload);

        // TODO: should the encoder give me the message hash?
        // Encoding now to fail early, used later to get message hash
        const protoMessage = await this.encoder.toProtoObj(wakuMessage);
        if (!protoMessage) {
          this.safeSendEvent(
            ReliableChannelEvent.OutMessageIrrecoverableError,
            {
              detail: {
                messageId: messageId,
                error: "could not encode message"
              }
            }
          );
          return { success: false };
        }
        const retrievalHint = messageHash(
          this.encoder.pubsubTopic,
          protoMessage
        );

        this.safeSendEvent(ReliableChannelEvent.OutMessageSending, {
          detail: messageId
        });

        const sendRes = await this._send(this.encoder, wakuMessage);

        // If it's a recoverable failure, we will try again to send later
        // If not, then we should error to the user now
        for (const { error } of sendRes.failures) {
          if (IRRECOVERABLE_SENDING_ERRORS.includes(error)) {
            // Not recoverable, best to return it
            log.error("Irrecoverable error, cannot send message: ", error);
            this.safeSendEvent(
              ReliableChannelEvent.OutMessageIrrecoverableError,
              {
                detail: {
                  messageId,
                  error
                }
              }
            );
            return { success: false, retrievalHint };
          }
        }

        return {
          success: true,
          retrievalHint
        };
      }
    );

    // Process outgoing messages straight away
    this.messageChannel
      .processTasks()
      .then(() => {
        this.messageChannel.sweepOutgoingBuffer();
      })
      .catch((err) => {
        log.error("error encountered when processing sds tasks", err);
      });
  }

  private async subscribe(): Promise<boolean> {
    this.assertStarted();
    return this._subscribe(this.decoder, async (message: T) => {
      await this.processIncomingMessage(message);
    });
  }

  /**
   * Don't forget to call `this.messageChannel.sweepIncomingBuffer();` once done.
   * @param msg
   * @private
   */
  private async processIncomingMessage<T extends IDecodedMessage>(
    msg: T
  ): Promise<void> {
    // New message arrives, we need to unwrap it first
    const sdsMessage = SdsMessage.decode(msg.payload);

    if (!sdsMessage) {
      log.error("could not SDS decode message", msg);
      return;
    }

    if (sdsMessage.channelId !== this.messageChannel.channelId) {
      log.warn(
        "ignoring message with different channel id",
        sdsMessage.channelId
      );
      return;
    }

    const retrievalHint = msg.hash;
    log.info(`processing message ${sdsMessage.messageId}:${msg.hashStr}`);
    // SDS Message decoded, let's pass it to the channel so we can learn about
    // missing messages or the status of previous outgoing messages
    this.messageChannel.pushIncomingMessage(sdsMessage, retrievalHint);

    this.missingMessageRetriever?.removeMissingMessage(sdsMessage.messageId);

    if (sdsMessage.content && sdsMessage.content.length > 0) {
      // Now, process the message with callback

      // Overrides msg.payload with unwrapped payload
      // TODO: can we do better?
      const { payload: _p, ...allButPayload } = msg;
      const unwrappedMessage = Object.assign(allButPayload, {
        payload: sdsMessage.content,
        hash: msg.hash,
        hashStr: msg.hashStr,
        version: msg.version,
        contentTopic: msg.contentTopic,
        pubsubTopic: msg.pubsubTopic,
        timestamp: msg.timestamp,
        rateLimitProof: msg.rateLimitProof,
        ephemeral: msg.ephemeral,
        meta: msg.meta
      });

      this.safeSendEvent(ReliableChannelEvent.InMessageReceived, {
        detail: unwrappedMessage as unknown as T
      });
    }

    this.queueProcessTasks();
  }

  private async processIncomingMessages<T extends IDecodedMessage>(
    messages: T[]
  ): Promise<void> {
    for (const message of messages) {
      await this.processIncomingMessage(message);
    }
  }

  // TODO: For now we only queue process tasks for incoming messages
  // As this is where there is most volume
  private queueProcessTasks(): void {
    // If one is already queued, then we can ignore it
    if (!this.processTaskTimeout) {
      this.processTaskTimeout = setTimeout(
        () =>
          void this.messageChannel.processTasks().catch((err) => {
            log.error("error encountered when processing sds tasks", err);
          }),
        1000
      ); // we ensure that we don't call process tasks more than once per second
    }
  }

  public async start(): Promise<boolean> {
    if (this.isStarted) return true;
    this.isStarted = true;
    this.setupEventListeners();
    this.restartSync();
    this.startSweepIncomingBufferLoop();
    if (this._retrieve) {
      this.missingMessageRetriever?.start();
      this.queryOnConnect?.start();
    }
    return this.subscribe();
  }

  public stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.stopSync();
    this.stopSweepIncomingBufferLoop();
    this.missingMessageRetriever?.stop();
    this.queryOnConnect?.stop();
    // TODO unsubscribe
    // TODO unsetMessageListeners
  }

  private assertStarted(): void {
    if (!this.isStarted) throw Error("Message Channel must be started");
  }

  private startSweepIncomingBufferLoop(): void {
    this.stopSweepIncomingBufferLoop();
    this.sweepInBufInterval = setInterval(() => {
      log.info("sweep incoming buffer");
      this.messageChannel.sweepIncomingBuffer();
    }, this.sweepInBufIntervalMs);
  }

  private stopSweepIncomingBufferLoop(): void {
    if (this.sweepInBufInterval) clearInterval(this.sweepInBufIntervalMs);
  }

  private restartSync(multiplier: number = 1): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    if (this.syncMinIntervalMs) {
      const timeoutMs = this.random() * this.syncMinIntervalMs * multiplier;

      this.syncTimeout = setTimeout(() => {
        void this.sendSyncMessage();
        // Always restart a sync, no matter whether the message was sent.
        // Set a multiplier so we wait a bit longer to not hog the conversation
        void this.restartSync(2);
      }, timeoutMs);
    }
  }

  private stopSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
  }

  // Used to enable overriding when testing
  private random(): number {
    return Math.random();
  }

  private safeSendEvent<T extends ReliableChannelEvent>(
    event: T,
    eventInit?: CustomEventInit
  ): void {
    try {
      this.dispatchEvent(new CustomEvent(event, eventInit));
    } catch (error) {
      log.error(`Failed to dispatch event ${event}:`, error);
    }
  }

  private async sendSyncMessage(): Promise<void> {
    this.assertStarted();
    await this.messageChannel.pushOutgoingSyncMessage(
      async (syncMessage: SyncMessage): Promise<boolean> => {
        // Callback is called once message has added to the SDS outgoing queue
        // We start by trying to send the message now.

        // `payload` wrapped in SDS
        const sdsPayload = syncMessage.encode();

        const wakuMessage = {
          payload: sdsPayload
        };

        const sendRes = await this._send(this.encoder, wakuMessage);
        if (sendRes.failures.length > 0) {
          log.error("Error sending sync message: ", sendRes);
          return false;
        }

        return true;
      }
    );

    // Process outgoing messages straight away
    // TODO: review and optimize
    await this.messageChannel.processTasks();
    this.messageChannel.sweepOutgoingBuffer();
  }

  private setupEventListeners(): void {
    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessageSent,
      (event) => {
        if (event.detail.content) {
          const messageId = ReliableChannel.getMessageId(event.detail.content);
          this.safeSendEvent(ReliableChannelEvent.OutMessageSent, {
            detail: messageId
          });
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail) {
          this.safeSendEvent(ReliableChannelEvent.OutMessageAcknowledged, {
            detail: event.detail
          });

          // Stopping retries
          this.retryManager?.stopRetries(event.detail);
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessagePossiblyAcknowledged,
      (event) => {
        if (event.detail) {
          this.safeSendEvent(
            ReliableChannelEvent.OutMessagePossiblyAcknowledged,
            {
              detail: {
                messageId: event.detail.messageId,
                possibleAckCount: event.detail.count
              }
            }
          );
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.InSyncReceived,
      (_event) => {
        // restart the timeout when a sync message has been received
        this.restartSync();
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.InMessageReceived,
      (event) => {
        // restart the timeout when a content message has been received
        if (isContentMessage(event.detail)) {
          // send a sync message faster to ack someone's else
          this.restartSync(0.5);
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessageSent,
      (event) => {
        // restart the timeout when a content message has been sent
        if (isContentMessage(event.detail)) {
          this.restartSync();
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.InMessageMissing,
      (event) => {
        for (const { messageId, retrievalHint } of event.detail) {
          if (retrievalHint && this.missingMessageRetriever) {
            this.missingMessageRetriever.addMissingMessage(
              messageId,
              retrievalHint
            );
          }
        }
      }
    );

    if (this.queryOnConnect) {
      this.queryOnConnect.addEventListener(
        QueryOnConnectEvent.MessagesRetrieved,
        (event) => {
          void this.processIncomingMessages(event.detail);
        }
      );
    }
  }
}
