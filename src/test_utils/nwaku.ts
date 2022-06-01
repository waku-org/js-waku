/**
 * @hidden
 * @module
 */

import { ChildProcess, spawn } from "child_process";

import appRoot from "app-root-path";
import debug from "debug";
import { Multiaddr, multiaddr } from "multiaddr";
import PeerId from "peer-id";
import portfinder from "portfinder";

import { DefaultPubSubTopic } from "../lib/constants";
import { hexToBytes } from "../lib/utils";
import { WakuMessage } from "../lib/waku_message";
import * as proto from "../proto/waku/v2/message";

import { existsAsync, mkdirAsync, openAsync } from "./async_fs";
import waitForLine from "./log_file";

const dbg = debug("waku:nwaku");

const NIM_WAKU_DIR = appRoot + "/nim-waku";
const NIM_WAKU_BIN = NIM_WAKU_DIR + "/build/wakunode2";

const LOG_DIR = "./log";

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
  persistMessages?: boolean;
  lightpush?: boolean;
  filter?: boolean;
  store?: boolean;
  topics?: string;
  rpcPrivate?: boolean;
  websocketSupport?: boolean;
  tcpPort?: number;
  rpcPort?: number;
  websocketPort?: number;
}

export enum LogLevel {
  Error = "error",
  Info = "info",
  Warn = "warn",
  Debug = "debug",
  Trace = "trace",
  Notice = "notice",
  Fatal = "fatal",
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface WakuRelayMessage {
  payload: string; // Hex encoded data string without `0x` prefix.
  contentTopic?: string;
  timestamp?: number; // Unix epoch time in nanoseconds as a 64-bits integer value.
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
  static toWakuRelayMessage(message: WakuMessage): WakuRelayMessage {
    if (!message.payload) {
      throw "Attempting to convert empty message";
    }

    let timestamp;
    if (message.proto.timestamp) {
      timestamp = message.proto.timestamp.toNumber();
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
        logLevel: LogLevel.Trace,
      },
      args
    );

    const argsArray = argsToArray(mergedArgs);
    dbg(`nwaku args: ${argsArray.join(" ")}`);
    this.process = spawn(NIM_WAKU_BIN, argsArray, {
      cwd: NIM_WAKU_DIR,
      stdio: [
        "ignore", // stdin
        logFile, // stdout
        logFile, // stderr
      ],
    });
    this.pid = this.process.pid;
    dbg(
      `nwaku ${this.process.pid} started at ${new Date().toLocaleTimeString()}`
    );

    this.process.on("exit", (signal) => {
      dbg(
        `nwaku ${
          this.process ? this.process.pid : this.pid
        } process exited with ${signal} at ${new Date().toLocaleTimeString()}`
      );
    });

    this.process.on("error", (err) => {
      console.log(
        `nwaku ${
          this.process ? this.process.pid : this.pid
        } process encountered an error: ${err} at ${new Date().toLocaleTimeString()}`
      );
    });

    dbg("Waiting to see 'Node setup complete' in nwaku logs");
    await this.waitForLog("Node setup complete", 15000);
    dbg("nwaku node has been started");
  }

  public stop(): void {
    const pid = this.process ? this.process.pid : this.pid;
    dbg(`nwaku ${pid} getting SIGINT at ${new Date().toLocaleTimeString()}`);
    if (!this.process) throw "nwaku process not set";
    const res = this.process.kill("SIGINT");
    dbg(`nwaku ${pid} interrupted:`, res);
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
    message: WakuRelayMessage,
    pubSubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    return this.rpcCall<boolean>("post_waku_v2_relay_v1_message", [
      pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
      message,
    ]);
  }

  async messages(): Promise<WakuMessage[]> {
    this.checkProcess();

    const isDefined = (msg: WakuMessage | undefined): msg is WakuMessage => {
      return !!msg;
    };

    const protoMsgs = await this.rpcCall<proto.WakuMessage[]>(
      "get_waku_v2_relay_v1_messages",
      [DefaultPubSubTopic]
    );

    const msgs = await Promise.all(
      protoMsgs.map(async (protoMsg) => await WakuMessage.decodeProto(protoMsg))
    );

    return msgs.filter(isDefined);
  }

  async getAsymmetricKeyPair(): Promise<KeyPair> {
    this.checkProcess();

    const { seckey, pubkey } = await this.rpcCall<{
      seckey: string;
      pubkey: string;
    }>("get_waku_v2_private_v1_asymmetric_keypair", []);

    return { privateKey: seckey, publicKey: pubkey };
  }

  async postAsymmetricMessage(
    message: WakuRelayMessage,
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
  ): Promise<WakuRelayMessage[]> {
    this.checkProcess();

    return await this.rpcCall<WakuRelayMessage[]>(
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
    message: WakuRelayMessage,
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
  ): Promise<WakuRelayMessage[]> {
    this.checkProcess();

    return await this.rpcCall<WakuRelayMessage[]>(
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
    this.peerId = PeerId.createFromB58String(peerIdStr);
    return { peerId: this.peerId, multiaddrWithId: this.multiaddrWithId };
  }

  get rpcUrl(): string {
    return `http://localhost:${this.rpcPort}/`;
  }

  private async rpcCall<T>(
    method: string,
    params: Array<string | number | unknown>
  ): Promise<T> {
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
    const kebabKey = key.replace(/([A-Z])/, (_, capital) => {
      return "-" + capital.toLowerCase();
    });

    const arg = `--${kebabKey}=${value}`;
    array.push(arg);
  }

  return array;
}

export function defaultArgs(): Args {
  return {
    nat: "none",
    listenAddress: "127.0.0.1",
    relay: true,
    rpc: true,
    rpcAdmin: true,
    websocketSupport: true,
  };
}

export function strToHex(str: string): string {
  let hex: string;
  try {
    hex = unescape(encodeURIComponent(str))
      .split("")
      .map(function (v) {
        return v.charCodeAt(0).toString(16);
      })
      .join("");
  } catch (e) {
    hex = str;
    console.log("invalid text input: " + str);
  }
  return hex;
}

export function bytesToHex(buffer: Uint8Array): string {
  return Array.prototype.map
    .call(buffer, (x) => ("00" + x.toString(16)).slice(-2))
    .join("");
}

interface RpcInfoResponse {
  // multiaddrs including peer id.
  listenAddresses: string[];
  enrUri?: string;
}
