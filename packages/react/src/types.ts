import type { Protocols, Waku } from "@waku/interfaces";
import type { waku } from "@waku/sdk";
export type { CreateWakuNodeOptions } from "@waku/sdk";

export type HookState = {
  isLoading: boolean;
  error: undefined | string;
};

export type CreateNodeResult<T extends Waku> = HookState & {
  node: undefined | T;
};

export type BootstrapNodeOptions<T = object> = {
  options?: T;
  protocols?: Protocols[];
};

export type ContentPair = {
  encoder: waku.Encoder;
  decoder: waku.Decoder;
};

export type ReactChildrenProps = {
  children?: React.ReactNode;
};
