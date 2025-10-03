import type {
  IEncoder,
  ILightPush,
  IMessage,
  IWaku,
  LightPushSDKResult
} from "@waku/interfaces";
import React from "react";

type AbstractLightPushNode = IWaku & {
  lightPush: ILightPush;
};

type UseLightPushParams = {
  encoder: undefined | IEncoder;
  node: undefined | AbstractLightPushNode;
};

type PushFn = (message: IMessage) => Promise<LightPushSDKResult>;

type UseLightPushResult = {
  push?: undefined | PushFn;
};

export const useLightPush = (
  params: UseLightPushParams
): UseLightPushResult => {
  const { node, encoder } = params;

  const push = React.useCallback<PushFn>(
    (message) => {
      return node!.lightPush.send(encoder as IEncoder, message);
    },
    [node, encoder]
  );

  if (!node && !encoder) {
    return {};
  }

  return {
    push
  };
};
