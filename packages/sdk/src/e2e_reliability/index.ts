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
  SDKProtocolResult
} from "@waku/interfaces";
import {
  type MessageChannelOptions,
  Message as SdsMessage,
  MessageChannel as SdsMessageChannel
} from "@waku/sds";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:e2e-reliability");

const IRRECOVERABLE_SENDING_ERRORS: ProtocolError[] = [
  ProtocolError.ENCODE_FAILED,
  ProtocolError.EMPTY_PAYLOAD,
  ProtocolError.SIZE_TOO_BIG,
  ProtocolError.RLN_PROOF_GENERATION,
  ProtocolError.TOPIC_DECODER_MISMATCH,
  ProtocolError.INVALID_DECODER_TOPICS
];

/**
 * @emits TODO
 */
export class MessageChannel {
  private readonly _send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ISendOptions
  ) => Promise<SDKProtocolResult>;

  private readonly _subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ) => Promise<boolean>;

  private constructor(
    public node: IWaku,
    public messageChannel: SdsMessageChannel
  ) {
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
  }

  /**
   * Create a new message channels. Message channels enables end-to-end
   * reliability by ensuring that all messages in the channel are received
   * by other users, and retrieved by this local node.
   *
   * emits events about outgoing messages, see [[`MessageChannel`]] docs.
   *
   * Note that all participants in a message channels need to get the messages
   * from the channel. Meaning:
   * - all participants must be able to decrypt the messages
   * - all participants must be subscribing to content topic(s) where the messages are sent
   *
   * @param node
   * @param channelId
   * @param channelOptions
   */
  public static create(
    node: IWaku,
    channelId: string,
    channelOptions?: MessageChannelOptions
  ): MessageChannel {
    const sdsMessageChannel = new SdsMessageChannel(channelId, channelOptions);
    return new MessageChannel(node, sdsMessageChannel);
  }

  /**
   * Sends a message in the channel, will attempt to re-send if not acknowledged
   * by other participants.
   *
   * @param encoder
   * @param message
   */
  public async send(encoder: IEncoder, message: IMessage): Promise<void> {
    await this.messageChannel.pushOutgoingMessage(
      message.payload,
      async (
        sdsMessage: SdsMessage
      ): Promise<{ success: boolean; retrievalHint?: Uint8Array }> => {
        // Callback is called once message has added to the SDS outgoing queue
        // We start by trying to send the message now.

        // `payload` wrapped in SDS
        const sdsPayload = sdsMessage.encode();

        const wakuMessage = {
          payload: sdsPayload,
          timestamp: message.timestamp,
          rateLimitProof: message.rateLimitProof
        };

        // TODO: Shouldn't the encoder give me this easily?
        const protoMessage = await encoder.toProtoObj(wakuMessage);
        if (!protoMessage) {
          return { success: false };
        }

        const sendRes = await this._send(encoder, wakuMessage);

        // If it's a recoverable failure, we will try again to send letter
        // If not, then we should error to the user now
        for (const { error } of sendRes.failures) {
          if (IRRECOVERABLE_SENDING_ERRORS.includes(error)) {
            // Not recoverable, best to return it
            // TODO: Should we emit?
            log.error("Irrecoverable error, cannot send message: ", error);
            return { success: false };
          }
        }

        const retrievalHint = messageHash(encoder.pubsubTopic, protoMessage);
        return {
          success: true,
          retrievalHint
        };
      }
    );

    // Process outgoing messages straight away
    // TODO: review and optimize
    await this.messageChannel.processTasks();
  }

  /**
   * Subscribe to a content topic to receive messages. Received messages will
   * be used to determined if a previous message was sent, and whether
   * messages are missed.
   *
   * emits events about incoming messages, see [[`MessageChannel`]] docs.
   *
   * @param decoders[]
   * @param callback function to process incoming messages
   */
  public async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<boolean> {
    return this._subscribe(decoders, async (msg: T): Promise<void> => {
      // New message arrives, we need to unwrap it first
      const sdsMessage = SdsMessage.decode(msg.payload);

      // SDS Message decoded, let's pass it to the channel so we can learn about
      // missing messages or the status of previous outgoing messages
      this.messageChannel.pushIncomingMessage(sdsMessage);

      if (sdsMessage.content) {
        // Now, process the message with callback

        // Overrides msg.payload with unwrapped payload
        // `payload` is just here to be discarded
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { payload, ...allButPayload } = msg;
        const unwrappedMessage = Object.assign(allButPayload, {
          payload: sdsMessage.content
        });

        await callback(unwrappedMessage as unknown as T);
      }

      // Do a process straight away
      // TODO: review and optimize
      await this.messageChannel.processTasks();
    });
  }
}
