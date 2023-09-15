export interface Args {
  staticnode?: string;
  nat?: "none";
  listenAddress?: string;
  relay?: boolean;
  rpc?: boolean;
  rpcAdmin?: boolean;
  nodekey?: string;
  portsShift?: number;
  logLevel?: LogLevel;
  lightpush?: boolean;
  filter?: boolean;
  store?: boolean;
  peerExchange?: boolean;
  discv5Discovery?: boolean;
  storeMessageDbUrl?: string;
  topic?: string;
  rpcPrivate?: boolean;
  websocketSupport?: boolean;
  tcpPort?: number;
  rpcPort?: number;
  websocketPort?: number;
  discv5BootstrapNode?: string;
  discv5UdpPort?: number;
  // `legacyFilter` is required to enable filter v1 with go-waku
  legacyFilter?: boolean;
}

export enum LogLevel {
  Error = "ERROR",
  Info = "INFO",
  Warn = "WARN",
  Debug = "DEBUG",
  Trace = "TRACE",
  Notice = "NOTICE",
  Fatal = "FATAL"
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface MessageRpcQuery {
  payload: string; // Hex encoded data string without `0x` prefix.
  contentTopic?: string;
  timestamp?: bigint; // Unix epoch time in nanoseconds as a 64-bits integer value.
}

export interface MessageRpcResponse {
  payload: string;
  contentTopic?: string;
  version?: number;
  timestamp?: bigint; // Unix epoch time in nanoseconds as a 64-bits integer value.
  ephemeral?: boolean;
}
