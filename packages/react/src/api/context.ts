import { createDecoder, createEncoder } from "@waku/core";
import { LightNode } from "@waku/interfaces";
import { createContext } from "react";

import { MessageDecoder } from "./proto_helpers/group_chat/MessageDecoder.js";

export type ContextType = {
  node: LightNode | undefined;
  encoderDecoder: [
    ReturnType<typeof createEncoder>,
    ReturnType<typeof createDecoder>
  ];
  messages: MessageDecoder[];
};

export const WakuContext = createContext<ContextType>({} as ContextType);
