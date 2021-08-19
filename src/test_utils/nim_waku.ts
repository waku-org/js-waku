/**
 * @hidden
 * @module
 */

import { ChildProcess, spawn } from 'child_process';
import { randomInt } from 'crypto';

import appRoot from 'app-root-path';
import axios from 'axios';
import debug from 'debug';
import { Multiaddr, multiaddr } from 'multiaddr';
import PeerId from 'peer-id';

import { hexToBuf } from '../lib/utils';
import { DefaultPubSubTopic } from '../lib/waku';
import { WakuMessage } from '../lib/waku_message';
import * as proto from '../proto/waku/v2/message';

import { existsAsync, mkdirAsync, openAsync } from './async_fs';
import waitForLine from './log_file';

const dbg = debug('waku:nim-waku');

const NIM_WAKU_DEFAULT_P2P_PORT = 60000;
const NIM_WAKU_DEFAULT_RPC_PORT = 8545;
const NIM_WAKU_DIR = appRoot + '/nim-waku';
const NIM_WAKU_BIN = NIM_WAKU_DIR + '/build/wakunode2';

const LOG_DIR = './log';

export interface Args {
  staticnode?: string;
  nat?: 'none';
  listenAddress?: string;
  relay?: boolean;
  rpc?: boolean;
  rpcAdmin?: boolean;
  nodekey?: string;
  portsShift?: number;
  logLevel?: LogLevel;
  persistMessages?: boolean;
  lightpush?: boolean;
  topics?: string;
  rpcPrivate?: boolean;
}

export enum LogLevel {
  Error = 'error',
  Info = 'info',
  Warn = 'warn',
  Debug = 'debug',
  Trace = 'trace',
  Notice = 'notice',
  Fatal = 'fatal',
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface WakuRelayMessage {
  payload: string;
  contentTopic?: string;
  timestamp?: number; // Float in seconds
}

export class NimWaku {
  private process?: ChildProcess;
  private pid?: number;
  private portsShift: number;
  private peerId?: PeerId;
  private multiaddrWithId?: Multiaddr;
  private logPath: string;

  constructor(logName: string) {
    this.portsShift = randomInt(0, 5000);
    this.logPath = `${LOG_DIR}/nim-waku_${logName}.log`;
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

    const logFile = await openAsync(this.logPath, 'w');

    const mergedArgs = defaultArgs();

    // Object.assign overrides the properties with the source (if there are conflicts)
    Object.assign(
      mergedArgs,
      { portsShift: this.portsShift, logLevel: LogLevel.Trace },
      args
    );

    const argsArray = argsToArray(mergedArgs);
    this.process = spawn(NIM_WAKU_BIN, argsArray, {
      cwd: NIM_WAKU_DIR,
      stdio: [
        'ignore', // stdin
        logFile, // stdout
        logFile, // stderr
      ],
    });
    this.pid = this.process.pid;
    dbg(
      `nim-waku ${
        this.process.pid
      } started at ${new Date().toLocaleTimeString()}`
    );

    this.process.on('exit', (signal) => {
      dbg(
        `nim-waku ${
          this.process ? this.process.pid : this.pid
        } process exited with ${signal} at ${new Date().toLocaleTimeString()}`
      );
    });

    this.process.on('error', (err) => {
      console.log(
        `nim-waku ${
          this.process ? this.process.pid : this.pid
        } process encountered an error: ${err} at ${new Date().toLocaleTimeString()}`
      );
    });

    dbg("Waiting to see 'Node setup complete' in nim-waku logs");
    await this.waitForLog('Node setup complete', 9000);
    dbg('nim-waku node has been started');
  }

  public stop(): void {
    dbg(
      `nim-waku ${
        this.process ? this.process.pid : this.pid
      } getting SIGINT at ${new Date().toLocaleTimeString()}`
    );
    this.process ? this.process.kill('SIGINT') : null;
    this.process = undefined;
  }

  async waitForLog(msg: string, timeout: number): Promise<void> {
    return waitForLine(this.logPath, msg, timeout);
  }

  /** Calls nim-waku2 JSON-RPC API `get_waku_v2_admin_v1_peers` to check
   * for known peers
   * @throws if nim-waku2 isn't started.
   */
  async peers(): Promise<string[]> {
    this.checkProcess();

    return this.rpcCall<string[]>('get_waku_v2_admin_v1_peers', []);
  }

  async info(): Promise<RpcInfoResponse> {
    this.checkProcess();

    return this.rpcCall<RpcInfoResponse>('get_waku_v2_debug_v1_info', []);
  }

  async sendMessage(
    message: WakuMessage,
    pubsubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    if (!message.payload) {
      throw 'Attempting to send empty message';
    }
    let timestamp;
    if (message.timestamp) {
      timestamp = message.timestamp.valueOf() / 1000;
      if (Number.isInteger(timestamp)) {
        // Add a millisecond to ensure it's not an integer
        // Until https://github.com/status-im/nim-waku/issues/691 is done
        timestamp += 0.001;
      }
    }

    const rpcMessage = {
      payload: bufToHex(message.payload),
      contentTopic: message.contentTopic,
      timestamp,
    };

    return this.rpcCall<boolean>('post_waku_v2_relay_v1_message', [
      pubsubTopic ? pubsubTopic : DefaultPubSubTopic,
      rpcMessage,
    ]);
  }

  async messages(): Promise<WakuMessage[]> {
    this.checkProcess();

    const isDefined = (msg: WakuMessage | undefined): msg is WakuMessage => {
      return !!msg;
    };

    const protoMsgs = await this.rpcCall<proto.WakuMessage[]>(
      'get_waku_v2_relay_v1_messages',
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
    }>('get_waku_v2_private_v1_asymmetric_keypair', []);

    return { privateKey: seckey, publicKey: pubkey };
  }

  async postAsymmetricMessage(
    message: WakuRelayMessage,
    publicKey: Uint8Array,
    pubsubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    if (!message.payload) {
      throw 'Attempting to send empty message';
    }

    return this.rpcCall<boolean>('post_waku_v2_private_v1_asymmetric_message', [
      pubsubTopic ? pubsubTopic : DefaultPubSubTopic,
      message,
      '0x' + bufToHex(publicKey),
    ]);
  }

  async getAsymmetricMessages(
    privateKey: Uint8Array,
    pubsubTopic?: string
  ): Promise<WakuRelayMessage[]> {
    this.checkProcess();

    return await this.rpcCall<WakuRelayMessage[]>(
      'get_waku_v2_private_v1_asymmetric_messages',
      [
        pubsubTopic ? pubsubTopic : DefaultPubSubTopic,
        '0x' + bufToHex(privateKey),
      ]
    );
  }

  async getSymmetricKey(): Promise<Buffer> {
    this.checkProcess();

    return this.rpcCall<string>(
      'get_waku_v2_private_v1_symmetric_key',
      []
    ).then(hexToBuf);
  }

  async postSymmetricMessage(
    message: WakuRelayMessage,
    symKey: Uint8Array,
    pubsubTopic?: string
  ): Promise<boolean> {
    this.checkProcess();

    if (!message.payload) {
      throw 'Attempting to send empty message';
    }

    return this.rpcCall<boolean>('post_waku_v2_private_v1_symmetric_message', [
      pubsubTopic ? pubsubTopic : DefaultPubSubTopic,
      message,
      '0x' + bufToHex(symKey),
    ]);
  }

  async getSymmetricMessages(
    symKey: Uint8Array,
    pubsubTopic?: string
  ): Promise<WakuRelayMessage[]> {
    this.checkProcess();

    return await this.rpcCall<WakuRelayMessage[]>(
      'get_waku_v2_private_v1_symmetric_messages',
      [pubsubTopic ? pubsubTopic : DefaultPubSubTopic, '0x' + bufToHex(symKey)]
    );
  }

  async getPeerId(): Promise<PeerId> {
    return await this.setPeerId().then((res) => res.peerId);
  }

  async getMultiaddrWithId(): Promise<Multiaddr> {
    return await this.setPeerId().then((res) => res.multiaddrWithId);
  }

  private async setPeerId(): Promise<{
    peerId: PeerId;
    multiaddrWithId: Multiaddr;
  }> {
    if (this.peerId && this.multiaddrWithId) {
      return { peerId: this.peerId, multiaddrWithId: this.multiaddrWithId };
    }
    const res = await this.info();
    this.multiaddrWithId = multiaddr(res.listenStr);
    const peerIdStr = this.multiaddrWithId.getPeerId();
    if (!peerIdStr) throw 'Nim-waku multiaddr does not contain peerId';
    this.peerId = PeerId.createFromB58String(peerIdStr);
    return { peerId: this.peerId, multiaddrWithId: this.multiaddrWithId };
  }

  get multiaddr(): Multiaddr {
    const port = NIM_WAKU_DEFAULT_P2P_PORT + this.portsShift;
    return multiaddr(`/ip4/127.0.0.1/tcp/${port}/`);
  }

  get rpcUrl(): string {
    const port = NIM_WAKU_DEFAULT_RPC_PORT + this.portsShift;
    return `http://localhost:${port}/`;
  }

  private async rpcCall<T>(
    method: string,
    params: Array<string | number | unknown>
  ): Promise<T> {
    const res = await axios.post(
      this.rpcUrl,
      {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return res.data.result;
  }

  private checkProcess(): void {
    if (!this.process) {
      throw "Nim Waku isn't started";
    }
  }
}

export function argsToArray(args: Args): Array<string> {
  const array = [];

  for (const [key, value] of Object.entries(args)) {
    // Change the key from camelCase to kebab-case
    const kebabKey = key.replace(/([A-Z])/, (_, capital) => {
      return '-' + capital.toLowerCase();
    });

    const arg = `--${kebabKey}=${value}`;
    array.push(arg);
  }

  return array;
}

export function defaultArgs(): Args {
  return {
    nat: 'none',
    listenAddress: '127.0.0.1',
    relay: true,
    rpc: true,
    rpcAdmin: true,
  };
}

export function strToHex(str: string): string {
  let hex: string;
  try {
    hex = unescape(encodeURIComponent(str))
      .split('')
      .map(function (v) {
        return v.charCodeAt(0).toString(16);
      })
      .join('');
  } catch (e) {
    hex = str;
    console.log('invalid text input: ' + str);
  }
  return hex;
}

export function bufToHex(buffer: Uint8Array): string {
  return Array.prototype.map
    .call(buffer, (x) => ('00' + x.toString(16)).slice(-2))
    .join('');
}

interface RpcInfoResponse {
  // multiaddr including id.
  listenStr: string;
}
