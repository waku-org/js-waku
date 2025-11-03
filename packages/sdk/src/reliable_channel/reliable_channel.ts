import { TypedEventEmitter } from "@libp2p/interface";
import {
  type ContentTopic,
  type IDecodedMessage,
  type IDecoder,
  type IWaku,
  LightPushError,
  QueryRequestParams
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
import { bytesToHex } from "@waku/utils/bytes";

import { ReliableChannelEvent, ReliableChannelEvents } from "./events.js";
import { RetryManager } from "./retry_manager.js";

const log = new Logger("sdk:reliable-channel");

const DEFAULT_SYNC_MIN_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_RETRY_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_MAX_RETRY_ATTEMPTS = 10;
const DEFAULT_SWEEP_IN_BUF_INTERVAL_MS = 5 * 1000;
const DEFAULT_PROCESS_TASK_MIN_ELAPSE_MS = 1000;

const IRRECOVERABLE_SENDING_ERRORS: LightPushError[] = [
  LightPushError.ENCODE_FAILED,
  LightPushError.EMPTY_PAYLOAD,
  LightPushError.SIZE_TOO_BIG,
  LightPushError.RLN_PROOF_GENERATION
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
   * Whether to auto start the message channel
   *
   * @default true
   */
  autoStart?: boolean;

  /** The minimum elapse time between calling the underlying channel process
   * task for incoming messages. This is to avoid overload when processing
   * a lot of messages.
   *
   * @default 1000 (1 second)
   */
  processTaskMinElapseMs?: number;
};

/**
 * It is best for SDS (e2e reliability) to happen within the encryption layer.
 * Hence, the consumer need to pass encryption and decryption methods for
 * outgoing and incoming messages.
 */
export interface IEncryption {
  encrypt: (clearPayload: Uint8Array) => Uint8Array | Promise<Uint8Array>;
  decrypt: (encryptedPayload: Uint8Array) => Uint8Array | Promise<Uint8Array>;
}

/**
 * An easy-to-use reliable channel that ensures all participants to the channel have eventual message consistency.
 *
 * Use events to track:
 * - if your outgoing messages are sent, acknowledged or error out
 * - for new incoming messages
 * @emits [[ReliableChannelEvents]]
 *
 */
export class ReliableChannel extends TypedEventEmitter<ReliableChannelEvents> {
  // TODO: this is PoC, we assume that message id is returned, and `undefined` means some error.
  // Borrowed from https://github.com/waku-org/js-waku/pull/2583/ for now
  private readonly _send: (
    contentTopic: string,
    payload: Uint8Array,
    ephemeral?: boolean
  ) => Promise<Uint8Array | undefined>;

  private readonly _subscribe: (contentTopics: ContentTopic[]) => void;

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
  // private readonly missingMessageRetriever?: MissingMessageRetriever;
  // private readonly queryOnConnect?: QueryOnConnect<T>;
  private readonly processTaskMinElapseMs: number;
  private _started: boolean;
  private encryption: IEncryption;

  private constructor(
    public node: IWaku,
    public messageChannel: MessageChannel,
    private contentTopic: ContentTopic,
    encryption?: IEncryption,
    options?: ReliableChannelOptions
  ) {
    super();
    if (node.lightPush) {
      // TODO: this is just a PoC
      // this._send = node.lightPush.send.bind(node.lightPush);
    } else if (node.relay) {
      // this._send = node.relay.send.bind(node.relay);
    } else {
      throw "No protocol available to send messages";
    }

    this._subscribe = node.subscribe.bind(node);

    // If no encryption, just set a pass through without changing the payload to keep the code simpler
    this.encryption = encryption ?? {
      encrypt: (p: Uint8Array) => p,
      decrypt: (p: Uint8Array) => p
    };

    if (node.store) {
      this._retrieve = node.store.queryGenerator.bind(node.store);
      const peerManagerEvents = (node as any)?.peerManager?.events;
      if (
        peerManagerEvents !== undefined &&
        (options?.queryOnConnect ?? true)
      ) {
        // this.queryOnConnect = new QueryOnConnect(
        //   [this.decoder],
        //   this.isChannelMessageWithCausalHistory.bind(this),
        //   peerManagerEvents,
        //   node.events,
        //   this._retrieve.bind(this)
        // );
        // TODO: stop using decoder for store
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

    this.processTaskMinElapseMs =
      options?.processTaskMinElapseMs ?? DEFAULT_PROCESS_TASK_MIN_ELAPSE_MS;

    if (this._retrieve) {
      // this.missingMessageRetriever = new MissingMessageRetriever(
      //   this.decoder,
      //   options?.retrieveFrequencyMs,
      //   this._retrieve,
      //   async (msg: T) => {
      //     await this.processIncomingMessage(msg.payload);
      //   }
      // );
      // TODO: stop using decoder for store
    }

    this._started = false;
  }

  public get isStarted(): boolean {
    return this._started;
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
  public static async create(
    node: IWaku,
    channelId: ChannelId,
    senderId: SenderId,
    contentTopic: ContentTopic,
    encryption?: IEncryption,
    options?: ReliableChannelOptions
  ): Promise<ReliableChannel> {
    const sdsMessageChannel = new MessageChannel(channelId, senderId, options);
    const messageChannel = new ReliableChannel(
      node,
      sdsMessageChannel,
      contentTopic,
      encryption,
      options
    );

    const autoStart = options?.autoStart ?? true;
    if (autoStart) {
      messageChannel.start();
    }

    return messageChannel;
  }

  /**
   * Sends a message in the channel, will attempt to re-send if not acknowledged
   * by other participants.
   *
   * @param messagePayload
   * @returns the message id
   */
  public send(messagePayload: Uint8Array): string {
    const messageId = ReliableChannel.getMessageId(messagePayload);
    if (!this._started) {
      this.safeSendEvent("sending-message-irrecoverable-error", {
        detail: { messageId: messageId, error: "channel is not started" }
      });
    }
    const wrapAndSendBind = this._wrapAndSend.bind(this, messagePayload);
    this.retryManager?.startRetries(messageId, wrapAndSendBind);
    wrapAndSendBind();
    return messageId;
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
        const encPayload = await this.encryption.encrypt(sdsPayload);

        const messageId = ReliableChannel.getMessageId(messagePayload);

        this.safeSendEvent("sending-message", {
          detail: messageId
        });

        const retrievalHint = await this._send(this.contentTopic, encPayload);

        // If it's a recoverable failure, we will try again to send later
        // If not, then we should error to the user now
        // for (const { error } of sendRes.failures) {
        //   if (IRRECOVERABLE_SENDING_ERRORS.includes(error)) {
        //     // Not recoverable, best to return it
        //     log.error("Irrecoverable error, cannot send message: ", error);
        //     this.safeSendEvent("sending-message-irrecoverable-error", {
        //       detail: {
        //         messageId,
        //         error
        //       }
        //     });
        //     return { success: false, retrievalHint };
        //   }
        // }
        // TODO: if failure, process it

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

  private subscribe(): void {
    this.assertStarted();
    this.node.messageEmitter.addEventListener(this.contentTopic, (event) => {
      const { payload, messageHash } = event.detail;
      // messageHash is the retrievalHint
      void this.processIncomingMessage(payload, messageHash);
    });

    this._subscribe([this.contentTopic]);
  }

  /**
   * Don't forget to call `this.messageChannel.sweepIncomingBuffer();` once done.
   * @private
   * @param payload
   */
  private async processIncomingMessage(
    payload: Uint8Array,
    retrievalHint: Uint8Array
  ): Promise<void> {
    // Decrypt first
    // TODO: skip on failure
    const decPayload = await this.encryption.decrypt(payload);

    // Unwrap SDS layer
    const sdsMessage = SdsMessage.decode(decPayload);

    if (!sdsMessage) {
      log.error("could not SDS decode message");
      return;
    }

    if (sdsMessage.channelId !== this.messageChannel.channelId) {
      log.warn(
        "ignoring message with different channel id",
        sdsMessage.channelId
      );
      return;
    }

    log.info(
      `processing message ${sdsMessage.messageId}:${bytesToHex(retrievalHint)}`
    );
    // SDS Message decoded, let's pass it to the channel so we can learn about
    // missing messages or the status of previous outgoing messages
    this.messageChannel.pushIncomingMessage(sdsMessage, retrievalHint);

    // TODO
    // this.missingMessageRetriever?.removeMissingMessage(sdsMessage.messageId);

    if (sdsMessage.content && sdsMessage.content.length > 0) {
      // Now, process the message with callback
      this.safeSendEvent("message-received", {
        detail: sdsMessage.content
      });
    }

    this.queueProcessTasks();
  }

  // private async processIncomingMessages<T extends IDecodedMessage>(
  //   messages: T[]
  // ): Promise<void> {
  //   for (const message of messages) {
  //     await this.processIncomingMessage(message.payload);
  //   }
  // }

  // TODO: For now we only queue process tasks for incoming messages
  // As this is where there is most volume
  private queueProcessTasks(): void {
    // If one is already queued, then we can ignore it
    if (this.processTaskTimeout === undefined) {
      this.processTaskTimeout = setTimeout(() => {
        void this.messageChannel.processTasks().catch((err) => {
          log.error("error encountered when processing sds tasks", err);
        });

        // Clear timeout once triggered
        clearTimeout(this.processTaskTimeout);
        this.processTaskTimeout = undefined;
      }, this.processTaskMinElapseMs); // we ensure that we don't call process tasks more than once per second
    }
  }

  public start(): void {
    if (this._started) return;
    this._started = true;
    this.setupEventListeners();
    this.restartSync();
    this.startSweepIncomingBufferLoop();
    // if (this._retrieve) {
    //   this.missingMessageRetriever?.start();
    //   this.queryOnConnect?.start();
    // }
    this.subscribe();
  }

  public stop(): void {
    if (!this._started) return;
    this._started = false;
    this.stopSync();
    this.stopSweepIncomingBufferLoop();
    // this.missingMessageRetriever?.stop();
    // this.queryOnConnect?.stop();
    // TODO unsubscribe
    // TODO unsetMessageListeners
  }

  private assertStarted(): void {
    if (!this._started) throw Error("Message Channel must be started");
  }

  private startSweepIncomingBufferLoop(): void {
    this.stopSweepIncomingBufferLoop();
    this.sweepInBufInterval = setInterval(() => {
      log.info("sweep incoming buffer");
      this.messageChannel.sweepIncomingBuffer();
    }, this.sweepInBufIntervalMs);
  }

  private stopSweepIncomingBufferLoop(): void {
    if (this.sweepInBufInterval) clearInterval(this.sweepInBufInterval);
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

  private isChannelMessageWithCausalHistory(msg: T): boolean {
    // TODO: we do end-up decoding messages twice as this is used to stop store queries.
    const sdsMessage = SdsMessage.decode(msg.payload);

    if (!sdsMessage) {
      return false;
    }

    if (sdsMessage.channelId !== this.messageChannel.channelId) {
      return false;
    }

    return sdsMessage.causalHistory && sdsMessage.causalHistory.length > 0;
  }

  private setupEventListeners(): void {
    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessageSent,
      (event) => {
        if (event.detail.content) {
          const messageId = ReliableChannel.getMessageId(event.detail.content);
          this.safeSendEvent("message-sent", {
            detail: messageId
          });
        }
      }
    );

    this.messageChannel.addEventListener(
      MessageChannelEvent.OutMessageAcknowledged,
      (event) => {
        if (event.detail) {
          this.safeSendEvent("message-acknowledged", {
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
          this.safeSendEvent("message-possibly-acknowledged", {
            detail: {
              messageId: event.detail.messageId,
              possibleAckCount: event.detail.count
            }
          });
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

    // this.messageChannel.addEventListener(
    //   MessageChannelEvent.InMessageMissing,
    //   (event) => {
    //     for (const { messageId, retrievalHint } of event.detail) {
    //       if (retrievalHint && this.missingMessageRetriever) {
    //         this.missingMessageRetriever.addMissingMessage(
    //           messageId,
    //           retrievalHint
    //         );
    //       }
    //     }
    //   }
    // );

    // if (this.queryOnConnect) {
    //   this.queryOnConnect.addEventListener(
    //     QueryOnConnectEvent.MessagesRetrieved,
    //     (event) => {
    //       void this.processIncomingMessages(event.detail);
    //     }
    //   );
    // }
  }
}
