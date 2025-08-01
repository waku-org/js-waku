import { messageHash } from "@waku/core";
import {
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

export class MessageChannel {
  private readonly _send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ISendOptions
  ) => Promise<SDKProtocolResult>;

  private constructor(
    public node: IWaku,
    public messageChannel: SdsMessageChannel
  ) {
    if (node.lightPush) {
      this._send = node.lightPush.send;
    } else if (node.relay) {
      this._send = node.relay.send;
    } else {
      throw "No protocol available to send messages";
    }
  }

  /**
   * Create a new message channels. Message channels enables end-to-end
   * reliability by ensuring that all messages in the channel are received
   * by other users, and retrieved by this local node.
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
    await this.messageChannel.processTasks();
  }
}
