export interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(contentTopic: string): Promise<boolean>;
}
