import { Message } from "./events.js";

export enum Command {
  Send = "send",
  Receive = "receive",
  SendEphemeral = "sendEphemeral"
}

export interface ParamsByAction {
  [Command.Send]: {
    payload: Uint8Array;
    callback?: (message: Message) => Promise<{
      success: boolean;
      retrievalHint?: Uint8Array;
    }>;
  };
  [Command.Receive]: {
    message: Message;
  };
  [Command.SendEphemeral]: {
    payload: Uint8Array;
    callback?: (message: Message) => Promise<boolean>;
  };
}

export type Task<A extends Command = Command> = {
  command: A;
  params: ParamsByAction[A];
};

// Define a mapping for handlers based on action type
export type Handlers = {
  [A in Command]: (params: ParamsByAction[A]) => Promise<void>;
};
