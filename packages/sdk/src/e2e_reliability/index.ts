import { type IWaku } from "@waku/interfaces";
import {
  type MessageChannelOptions,
  MessageChannel as SdsMessageChannel
} from "@waku/sds";

export class MessageChannel {
  private constructor(
    public node: IWaku,
    public messageChannel: SdsMessageChannel
  ) {}

  public static create(
    node: IWaku,
    channelId: string,
    channelOptions?: MessageChannelOptions
  ): MessageChannel {
    const sdsMessageChannel = new SdsMessageChannel(channelId, channelOptions);
    return new MessageChannel(node, sdsMessageChannel);
  }
}
