export type RequestId = string;

// todo: make it IMessage type
export type WakuLikeMessage = {
  contentTopic: string;
  payload: Uint8Array;
  ephemeral?: boolean;
  rateLimitProof?: boolean;
};

export interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(contentTopic: string): Promise<boolean>;
}
