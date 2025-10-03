import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IWaku,
  Protocols
} from "@waku/interfaces";
export type { CreateNodeOptions, AutoSharding } from "@waku/interfaces";

export type HookState = {
  isLoading: boolean;
  error: undefined | string;
};

export type CreateNodeResult<T extends IWaku> = HookState & {
  node: undefined | T;
};

export type BootstrapNodeOptions<T = Record<string, never>> = {
  options?: T;
  protocols?: Protocols[];
};

export type ContentPair = {
  encoder: IEncoder;
  decoder: IDecoder<IDecodedMessage>;
};

export type ReactChildrenProps = {
  children?: React.ReactNode;
};
