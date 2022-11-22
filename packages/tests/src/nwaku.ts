import { ChildProcess, spawn } from "child_process";

import type { PeerId } from "@libp2p/interface-peer-id";
import { peerIdFromString } from "@libp2p/peer-id";
import { Multiaddr, multiaddr } from "@multiformats/multiaddr";
import { bytesToHex, hexToBytes } from "@waku/byte-utils";
import { DefaultPubSubTopic } from "@waku/core";
import appRoot from "app-root-path";
import debug from "debug";
import portfinder from "portfinder";

import { existsAsync, mkdirAsync, openAsync } from "./async_fs";
import { delay } from "./delay";
import waitForLine from "./log_file";

const log = debug("waku:nwaku");

const WAKU_SERVICE_NODE_DIR =
  process.env.WAKU_SERVICE_NODE_DIR ?? appRoot + "/nwaku";
const WAKU_SERVICE_NODE_BIN =
  process.env.WAKU_SERVICE_NODE_BIN ??
  WAKU_SERVICE_NODE_DIR + "/build/wakunode2";
const WAKU_SERVICE_NODE_PARAMS =
  process.env.WAKU_SERVICE_NODE_PARAMS ?? undefined;
const NODE_READY_LOG_LINE = "Node setup complete";

const LOG_DIR = "./log";

const OneMillion = BigInt(1_000_000);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
BigInt.prototype.toJSON = function toJSON() {
  return Number(this);
};

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
  topics?: string;
  rpcPrivate?: boolean;
  websocketSupport?: boolean;
  tcpPort?: number;
  rpcPort?: number;
  websocketPort?: number;
  manualArgs?: string[];
}

export enum LogLevel {
  Error = "ERROR",
  Info = "INFO",
  Warn = "WARN",
  Debug = "DEBUG",
  Trace = "TRACE",
  Notice = "NOTICE",
  Fatal = "FATAL",
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
  payload: number[];
  contentTopic?: string;
  version?: number;
  timestamp?: bigint; // Unix epoch time in nanoseconds as a 64-bits integer value.
}

export interface MessageRpcResponseHex {
  payload: string;
  contentTopic?: string;
  version?: number;
  timestamp?: bigint; // Unix epoch time in nanoseconds as a 64-bits integer value.
}

export class Nwaku {
  private process?: ChildProcess;
  private pid?: number;
  private peerId?: PeerId;
  private multiaddrWithId?: Multiaddr;
  private readonly logPath: string;
  private rpcPort?: number;

  /**
   * Convert a [[WakuMessage]] to a [[WakuRelayMessage]]. The latter is used
   * by the nwaku JSON-RPC API.
   */
  static toMessageRpcQuery(message: {
    payload: Uint8Array;
    contentTopic: string;
    timestamp?: Date;
  }): MessageRpcQuery {
    if (!message.payload) {
      throw "Attempting to convert empty message";
    }

    let timestamp;
    if (message.timestamp) {
      timestamp = BigInt(message.timestamp.valueOf()) * OneMillion;
    }

    return {
      payload: bytesToHex(message.payload),
      contentTopic: message.contentTopic,
      timestamp,
    };
  }

  constructor(logName: string) {
    this.logPath = `${LOG_DIR}/nwaku_${logName}.log`;
  }

  async start(args?: Args): Promise<void> {
    try {
      await existsAsync(LOG_DIR);
    } catch (e) {
      try {
        await mkdirAsync(LOG_DIR);
      } catch (e) {
        // Looks like 2 tests tried to create the director at the same time,
        // it can be ignored
      }
    }

    const logFile = await openAsync(this.logPath, "w");

    const mergedArgs = defaultArgs();

    const ports: number[] = await new Promise((resolve, reject) => {
      portfinder.getPorts(3, {}, (err, ports) => {
        if (err) reject(err);
        resolve(ports);
      });
    });

    this.rpcPort = ports[0];

    // Object.assign overrides the properties with the source (if there are conflicts)
    Object.assign(
      mergedArgs,
      {
        tcpPort: ports[1],
        rpcPort: this.rpcPort,
        websocketPort: ports[2],
      },
      args
    );

    const { manualArgs: manualFlags } = mergedArgs;

    mergedArgs.manualArgs && delete mergedArgs.manualArgs;

    process.env.WAKUNODE2_STORE_MESSAGE_DB_URL = "";

    const argsArray = argsToArray(mergedArgs);
    if (manualFlags) {
      argsArray.push(...manualFlags);
    }
    if (WAKU_SERVICE_NODE_PARAMS) {
      argsArray.push(WAKU_SERVICE_NODE_PARAMS);
    }
    log(`nwaku args: ${argsArray.join(" ")}`);

    this.process = spawn(WAKU_SERVICE_NODE_BIN, argsArray, {
      cwd: WAKU_SERVICE_NODE_DIR,
      stdio: [
        "ignore", // stdin
        logFile, // stdout
        logFile, // stderr
      ],
    });
    this.pid = this.process.pid;
    log(
      `nwaku ${this.process.pid} started at ${new Date().toLocaleTimeString()}`
    );

    this.process.on("exit", (signal) => {
      log(
        `nwaku ${
          this.process ? this.process.pid : this.pid
        } process exited with ${signal} at ${new Date().toLocaleTimeString()}`
      );
    });

    this.process.on("error", (err) => {
      log(
        `nwaku ${
          this.process ? this.process.pid : this.pid
        } process encountered an error: ${err} at ${new Date().toLocaleTimeString()}`
      );
    });

    log(`Waiting to see '${NODE_READY_LOG_LINE}' in nwaku logs`);
    await this.waitForLog(NODE_READY_LOG_LINE, 15000);
    if (process.env.CI) await delay(100);
    log("nwaku node has been started");
  }

  public stop(): void {
    const pid = this.process ? this.process.pid : this.pid;
    log(`nwaku ${pid} getting SIGINT at ${new Date().toLocaleTimeString()}`);
    if (!this.process) throw "nwaku process not set";
    const res = this.process.kill("SIGINT");
    log(`nwaku ${pid} interrupted:`, res);
    this.process = undefined;
  }

  async waitForLog(msg: string, timeout: number): Promise<void> {
    return waitForLine(this.logPath, msg, timeout);
  }

  /** Calls nwaku JSON-RPC API `get_waku_v2_admin_v1_peers` to check
   * for known peers
   * @throws if nwaku isn't started.
   */
  async peers(): Promise<string[]> {
    this.checkProcess();

    return this.rpcCall<string[]>("get_waku_v2_admin_v1_peers", []);
  }

  async info(): Promise<RpcInfoResponse> {
    this.checkProcess();

    return this.rpcCall<RpcInfoResponse>("get_waku_v2_debug_v1_info", []);
  }

  async sendMessage(
    message: MessageRpcQuery,
    pubSubTopic: string = DefaultPubSubTopic
  ): Promise<boolean> {
    this.checkProcess();

    if (typeof message.timestamp === "undefined") {
      message.timestamp = BigInt(new Date().valueOf()) * OneMillion;
    }

    return this.rpcCall<boolean>("post_waku_v2_relay_v1_message", [
      pubSubTopic,
      message,
    ]);
  }

  async messages(
    pubsubTopic: string = DefaultPubSubTopic
  ): Promise<MessageRpcResponse[]> {
    this.checkProcess();

    const isDefined = (
      msg: MessageRpcResponse | undefined
    ): msg is MessageRpcResponse => {
      return !!msg;
    };

    const msgs = await this.rpcCall<MessageRpcResponse[]>(
      "get_waku_v2_relay_v1_messages",
      [pubsubTopic]
    );

    return msgs.filter(isDefined);
  }

  async getAsymmetricKeyPair(): Promise<KeyPair> {
    this.checkProcess();

    const { privateKey, publicKey, seckey, pubkey } = await this.rpcCall<{
      seckey: string;
      pubkey: string;
      privateKey: string;
      publicKey: string;
    }>("get_waku_v2_private_v1_asymmetric_keypair", []);

    // To be removed once https://github.com/vacp2p/rfc/issues/507 is fixed
    if (seckey) {
      return { privateKey: seckey, publicKey: pubkey };
    } else {
      return { privateKey, publicKey };
    }
  }

  async postAsymmetricMessage(
    message: MessageRpcQuery,
    publicKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    if (!message.payload) {
      throw "Attempting to send empty message";
    }

    return this.rpcCall<boolean>("post_waku_v2_private_v1_asymmetric_message", [
      pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
      message,
      "0x" + bytesToHex(publicKey),
    ]);
  }

  async getAsymmetricMessages(
    privateKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<MessageRpcResponseHex[]> {
    this.checkProcess();

    return await this.rpcCall<MessageRpcResponseHex[]>(
      "get_waku_v2_private_v1_asymmetric_messages",
      [
        pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
        "0x" + bytesToHex(privateKey),
      ]
    );
  }

  async getSymmetricKey(): Promise<Uint8Array> {
    this.checkProcess();

    return this.rpcCall<string>(
      "get_waku_v2_private_v1_symmetric_key",
      []
    ).then(hexToBytes);
  }

  async postSymmetricMessage(
    message: MessageRpcQuery,
    symKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    if (!message.payload) {
      throw "Attempting to send empty message";
    }

    return this.rpcCall<boolean>("post_waku_v2_private_v1_symmetric_message", [
      pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
      message,
      "0x" + bytesToHex(symKey),
    ]);
  }

  async getSymmetricMessages(
    symKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<MessageRpcResponseHex[]> {
    this.checkProcess();

    return await this.rpcCall<MessageRpcResponseHex[]>(
      "get_waku_v2_private_v1_symmetric_messages",
      [
        pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
        "0x" + bytesToHex(symKey),
      ]
    );
  }

  async getPeerId(): Promise<PeerId> {
    return await this._getPeerId().then((res) => res.peerId);
  }

  async getMultiaddrWithId(): Promise<Multiaddr> {
    return await this._getPeerId().then((res) => res.multiaddrWithId);
  }

  private async _getPeerId(): Promise<{
    peerId: PeerId;
    multiaddrWithId: Multiaddr;
  }> {
    if (this.peerId && this.multiaddrWithId) {
      return { peerId: this.peerId, multiaddrWithId: this.multiaddrWithId };
    }
    const res = await this.info();
    this.multiaddrWithId = res.listenAddresses
      .map((ma) => multiaddr(ma))
      .find((ma) => ma.protoNames().includes("ws"));
    if (!this.multiaddrWithId) throw "Nwaku did not return a ws multiaddr";
    const peerIdStr = this.multiaddrWithId.getPeerId();
    if (!peerIdStr) throw "Nwaku multiaddr does not contain peerId";
    this.peerId = peerIdFromString(peerIdStr);
    return { peerId: this.peerId, multiaddrWithId: this.multiaddrWithId };
  }

  get rpcUrl(): string {
    return `http://localhost:${this.rpcPort}/`;
  }

  private async rpcCall<T>(
    method: string,
    params: Array<string | number | unknown>
  ): Promise<T> {
    log("RPC Query: ", method, params);
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    const json = await res.json();
    log(`RPC Response: `, JSON.stringify(json));
    return json.result;
  }

  private checkProcess(): void {
    if (!this.process) {
      throw "Nwaku hasn't started";
    }
  }
}

export function argsToArray(args: Args): Array<string> {
  const array = [];

  for (const [key, value] of Object.entries(args)) {
    // Change the key from camelCase to kebab-case
    const kebabKey = key.replace(/([A-Z])/g, (_, capital) => {
      return "-" + capital.toLowerCase();
    });

    const arg = `--${kebabKey}=${value}`;
    array.push(arg);
  }

  return array;
}

export function defaultArgs(): Args {
  return {
    listenAddress: "127.0.0.1",
    nat: "none",
    // relay: true,
    rpc: true,
    rpcAdmin: true,
    websocketSupport: true,
    logLevel: LogLevel.Trace,
  };
}

interface RpcInfoResponse {
  // multiaddrs including peer id.
  listenAddresses: string[];
  enrUri?: string;
}
