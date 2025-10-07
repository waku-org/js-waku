import type { IWaku } from "@waku/interfaces";
import type React from "react";
export type { CreateNodeOptions, AutoSharding } from "@waku/interfaces";

type HookState = {
  isLoading: boolean;
  error: undefined | string;
};

export type CreateNodeResult<T extends IWaku> = HookState & {
  node: undefined | T;
};

export type ReactChildrenProps = {
  children?: React.ReactNode;
};
