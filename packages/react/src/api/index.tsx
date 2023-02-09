import { createDecoder, createEncoder, WakuOptions } from "@waku/core";
import { createLightNode } from "@waku/create";
import { LightNode, ProtocolCreateOptions } from "@waku/interfaces";
import { useEffect, useState } from "react";

import { ContextType, WakuContext } from "./context.js";
import { MessageDecoder } from "./proto_helpers/group_chat/MessageDecoder.js";

interface InitialiseProps {
  nodeOptions?: ProtocolCreateOptions & WakuOptions;
  encoderDecoderOptions: {
    contentTopic: string;
    ephemeral?: boolean;
  };
}

interface ProviderProps extends InitialiseProps {
  children: JSX.Element | JSX.Element[];
}

export function Provider({
  children,
  ...initialiseProps
}: ProviderProps): JSX.Element {
  const { encoderDecoderOptions, nodeOptions } = initialiseProps;
  const [messages, setMessages] = useState<MessageDecoder[]>([]);
  const [unsubscribe, setUnsubscribe] = useState<
    (() => Promise<void>) | undefined
  >(undefined);

  const encoder = createEncoder(encoderDecoderOptions);
  const decoder = createDecoder(encoderDecoderOptions.contentTopic);

  const _createLightNode = async (): Promise<LightNode | undefined> => {
    const waku = await createLightNode({
      ...nodeOptions,
      defaultBootstrap: true,
    });
    await waku.start();
    setTimeout(() => {
      console.log("node init");
      waku.filter
        .subscribe([decoder], (wakuMessage) => {
          console.log("wakuMessage", wakuMessage);
          const decodedMessage = MessageDecoder.fromWakuMessage(wakuMessage);
          if (decodedMessage) {
            setMessages((messages) => [...messages, decodedMessage]);
          }
        })
        .then((_unsubscribe) => {
          setUnsubscribe(_unsubscribe);
        });
    }, 5000);
    return waku;
  };

  let node: LightNode | undefined;

  _createLightNode().then((waku) => (node = waku));

  const data: ContextType = {
    node,
    messages,
    encoderDecoder: [encoder, decoder],
  };

  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });

  return <WakuContext.Provider value={data}>{children}</WakuContext.Provider>;
}

// export function useMessage(): (
//   | MessageDecoder[]
//   | (() => Promise<void>)
//   | ((message: string, nick: string) => Promise<SendResult>)
// )[] {
//   const { node, encoderDecoder } = useContext(WakuContext);
//   const [encoder] = encoderDecoder;

//   const sendMessage = async (
//     message: string,
//     nick: string
//   ): Promise<SendResult> => {
//     const timestamp = new Date();
//     const chatMessage = ChatMessage.fromUtf8String(timestamp, nick, message);
//     const payload = chatMessage.encode();
//     return await node.lightPush.push(encoder, {
//       payload,
//       timestamp,
//     });
//   };

//   return [sendMessage];
// }
