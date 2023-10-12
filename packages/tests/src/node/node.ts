import type { PeerId } from "@libp2p/interface/peer-id";
import { peerIdFromString } from "@libp2p/peer-id";
import { Multiaddr, multiaddr } from "@multiformats/multiaddr";
import { DefaultPubSubTopic } from "@waku/core";
import { isDefined } from "@waku/utils";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import debug from "debug";
import pRetry from "p-retry";
import portfinder from "portfinder";

import { existsAsync, mkdirAsync, openAsync } from "../async_fs.js";
import { delay } from "../delay.js";
import waitForLine from "../log_file.js";

import Dockerode from "./dockerode.js";
import {
  Args,
  KeyPair,
  LogLevel,
  MessageRpcQuery,
  MessageRpcResponse
} from "./interfaces.js";

const log = debug("waku:node");

const WAKU_SERVICE_NODE_PARAMS =
  process.env.WAKU_SERVICE_NODE_PARAMS ?? undefined;
const NODE_READY_LOG_LINE = "Node setup complete";

const DOCKER_IMAGE_NAME = process.env.WAKUNODE_IMAGE || "wakuorg/nwaku:v0.20.0";

const isGoWaku = DOCKER_IMAGE_NAME.includes("go-waku");

const LOG_DIR = "./log";

const OneMillion = BigInt(1_000_000);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
BigInt.prototype.toJSON = function toJSON() {
  return Number(this);
};

export class NimGoNode {
  private docker?: Dockerode;
  private peerId?: PeerId;
  private multiaddrWithId?: Multiaddr;
  private websocketPort?: number;
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
      payload: Buffer.from(message.payload).toString("base64"),
      contentTopic: message.contentTopic,
      timestamp
    };
  }

  constructor(logName: string) {
    this.logPath = `${LOG_DIR}/wakunode_${logName}.log`;
  }

  type(): "go-waku" | "nwaku" {
    return isGoWaku ? "go-waku" : "nwaku";
  }

  get nodeType(): "go-waku" | "nwaku" {
    return isGoWaku ? "go-waku" : "nwaku";
  }

  async start(args: Args = {}): Promise<void> {
    this.docker = await Dockerode.createInstance(DOCKER_IMAGE_NAME);
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

    await openAsync(this.logPath, "w");

    const mergedArgs = defaultArgs();

    // waku nodes takes some time to bind port so to decrease chances of conflict
    // we also randomize the first port that portfinder will try
    const startPort = Math.floor(Math.random() * (65535 - 1025) + 1025);

    const ports: number[] = await new Promise((resolve, reject) => {
      portfinder.getPorts(4, { port: startPort }, (err, ports) => {
        if (err) reject(err);
        resolve(ports);
      });
    });

    if (isGoWaku && !args.logLevel) {
      args.logLevel = LogLevel.Debug;
    }

    const [rpcPort, tcpPort, websocketPort, discv5UdpPort] = ports;
    this.rpcPort = rpcPort;
    this.websocketPort = websocketPort;

    // `legacyFilter` is required to enable filter v1 with go-waku
    const { legacyFilter = false, ..._args } = args;

    // Object.assign overrides the properties with the source (if there are conflicts)
    Object.assign(
      mergedArgs,
      {
        rpcPort,
        tcpPort,
        websocketPort,
        ...(args?.peerExchange && { discv5UdpPort }),
        ...(isGoWaku && { minRelayPeersToPublish: 0, legacyFilter })
      },
      { rpcAddress: "0.0.0.0" },
      _args
    );

    process.env.WAKUNODE2_STORE_MESSAGE_DB_URL = "";

    if (this.docker.container) {
      await this.docker.stop();
    }

    await this.docker.startContainer(
      ports,
      mergedArgs,
      this.logPath,
      WAKU_SERVICE_NODE_PARAMS
    );

    try {
      log(`Waiting to see '${NODE_READY_LOG_LINE}' in ${this.type} logs`);
      await this.waitForLog(NODE_READY_LOG_LINE, 15000);
      if (process.env.CI) await delay(100);
      log(`${this.type} node has been started`);
    } catch (error) {
      log(`Error starting ${this.type}: ${error}`);
      if (this.docker.container) await this.docker.stop();
      throw error;
    }
  }

  async startWithRetries(
    args: Args = {},
    options: {
      retries?: number;
    } = { retries: 3 }
  ): Promise<void> {
    await pRetry(
      async () => {
        try {
          await this.start(args);
        } catch (error) {
          log("Nwaku node failed to start:", error);
          await this.stop();
          throw error;
        }
      },
      { retries: options.retries }
    );
  }

  public async stop(): Promise<void> {
    await this.docker?.stop();
    delete this.docker;
  }

  async waitForLog(msg: string, timeout: number): Promise<void> {
    return waitForLine(this.logPath, msg, timeout);
  }

  /** Calls nwaku JSON-RPC API `get_waku_v2_admin_v1_peers` to check
   * for known peers
   * @throws if WakuNode isn't started.
   */
  async peers(): Promise<string[]> {
    this.checkProcess();

    return this.rpcCall<string[]>("get_waku_v2_admin_v1_peers", []);
  }

  async info(): Promise<RpcInfoResponse> {
    this.checkProcess();

    return this.rpcCall<RpcInfoResponse>("get_waku_v2_debug_v1_info", []);
  }

  async ensureSubscriptions(
    pubsubTopics: string[] = [DefaultPubSubTopic]
  ): Promise<boolean> {
    this.checkProcess();

    return this.rpcCall<boolean>("post_waku_v2_relay_v1_subscriptions", [
      pubsubTopics
    ]);
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
      message
    ]);
  }

  async messages(
    pubsubTopic: string = DefaultPubSubTopic
  ): Promise<MessageRpcResponse[]> {
    this.checkProcess();

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
      "0x" + bytesToHex(publicKey)
    ]);
  }

  async getAsymmetricMessages(
    privateKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<MessageRpcResponse[]> {
    this.checkProcess();

    return await this.rpcCall<MessageRpcResponse[]>(
      "get_waku_v2_private_v1_asymmetric_messages",
      [
        pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
        "0x" + bytesToHex(privateKey)
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
      "0x" + bytesToHex(symKey)
    ]);
  }

  async getSymmetricMessages(
    symKey: Uint8Array,
    pubSubTopic?: string
  ): Promise<MessageRpcResponse[]> {
    this.checkProcess();

    return await this.rpcCall<MessageRpcResponse[]>(
      "get_waku_v2_private_v1_symmetric_messages",
      [
        pubSubTopic ? pubSubTopic : DefaultPubSubTopic,
        "0x" + bytesToHex(symKey)
      ]
    );
  }

  async getPeerId(): Promise<PeerId> {
    if (this.peerId) return this.peerId;
    this.peerId = await this._getPeerId();
    return this.peerId;
  }

  async getMultiaddrWithId(): Promise<Multiaddr> {
    if (this.multiaddrWithId) return this.multiaddrWithId;

    const peerId = await this.getPeerId();

    this.multiaddrWithId = multiaddr(
      `/ip4/127.0.0.1/tcp/${this.websocketPort}/ws/p2p/${peerId.toString()}`
    );
    return this.multiaddrWithId;
  }

  private async _getPeerId(): Promise<PeerId> {
    if (this.peerId) {
      return this.peerId;
    }
    const res = await this.info();
    const multiaddrWithId = res.listenAddresses
      .map((ma) => multiaddr(ma))
      .find((ma) => ma.protoNames().includes("ws"));
    if (!multiaddrWithId) throw `${this.type} did not return a ws multiaddr`;
    const peerIdStr = multiaddrWithId.getPeerId();
    if (!peerIdStr) throw `${this.type} multiaddr does not contain peerId`;
    this.peerId = peerIdFromString(peerIdStr);

    return this.peerId;
  }

  get rpcUrl(): string {
    return `http://127.0.0.1:${this.rpcPort}/`;
  }

  async rpcCall<T>(
    method: string,
    params: Array<string | number | unknown>
  ): Promise<T> {
    return await pRetry(
      async () => {
        try {
          log("RPC Query: ", method, params);
          const res = await fetch(this.rpcUrl, {
            method: "POST",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method,
              params
            }),
            headers: new Headers({ "Content-Type": "application/json" })
          });
          const json = await res.json();
          log(`RPC Response: `, JSON.stringify(json));
          return json.result;
        } catch (error) {
          log(`${this.rpcUrl} failed with error:`, error);
          await delay(10);
          throw error;
        }
      },
      { retries: 5 }
    );
  }

  private checkProcess(): void {
    if (!this.docker?.container) {
      throw `${this.type} container hasn't started`;
    }
  }
}

export function defaultArgs(): Args {
  return {
    listenAddress: "0.0.0.0",
    rpc: true,
    relay: false,
    rpcAdmin: true,
    websocketSupport: true,
    logLevel: LogLevel.Trace
  };
}

interface RpcInfoResponse {
  // multiaddrs including peer id.
  listenAddresses: string[];
  enrUri?: string;
}

export function base64ToUtf8(b64: string): string {
  return Buffer.from(b64, "base64").toString("utf-8");
}
