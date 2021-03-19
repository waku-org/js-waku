import { ChildProcess, spawn } from 'child_process';
import { randomInt } from 'crypto';

import appRoot from 'app-root-path';
import axios from 'axios';
import Multiaddr from 'multiaddr';
import multiaddr from 'multiaddr';
import PeerId from 'peer-id';

import { Message } from '../lib/waku_message';
import { TOPIC } from '../lib/waku_relay';

import { existsAsync, mkdirAsync, openAsync } from './async_fs';
import waitForLine from './log_file';

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
}

export class NimWaku {
  private process?: ChildProcess;
  private portsShift: number;
  private peerId?: PeerId;
  private logPath: string;

  constructor(testName: string) {
    this.portsShift = randomInt(0, 5000);

    const logFilePrefix = testName.replace(/ /g, '_').replace(/[':()]/g, '');

    this.logPath = `${LOG_DIR}/${logFilePrefix}-nim-waku.log`;
  }

  async start(args: Args) {
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
    Object.assign(mergedArgs, { portsShift: this.portsShift }, args);

    const argsArray = argsToArray(mergedArgs);
    this.process = spawn(NIM_WAKU_BIN, argsArray, {
      cwd: NIM_WAKU_DIR,
      stdio: [
        'ignore', // stdin
        logFile, // stdout
        logFile, // stderr
      ],
    });

    await this.waitForLog('RPC Server started');
  }

  public stop() {
    this.process ? this.process.kill('SIGINT') : null;
  }

  async waitForLog(msg: string) {
    return waitForLine(this.logPath, msg);
  }

  /** Calls nim-waku2 JSON-RPC API `get_waku_v2_admin_v1_peers` to check
   * for known peers
   * @throws if nim-waku2 isn't started.
   */
  async peers() {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_admin_v1_peers', []);

    return res.result;
  }

  async info(): Promise<RpcInfoResponse> {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_debug_v1_info', []);

    return res.result;
  }

  async sendMessage(message: Message) {
    this.checkProcess();

    const rpcMessage = {
      payload: bufToHex(message.payload),
      contentTopic: message.contentTopic,
    };

    const res = await this.rpcCall('post_waku_v2_relay_v1_message', [
      TOPIC,
      rpcMessage,
    ]);

    return res.result;
  }

  async messages() {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_relay_v1_messages', [TOPIC]);

    return res.result;
  }

  async getPeerId(): Promise<PeerId> {
    if (this.peerId) {
      return this.peerId;
    }

    const res = await this.info();
    const strPeerId = multiaddr(res.listenStr).getPeerId();

    return PeerId.createFromB58String(strPeerId);
  }

  get multiaddr(): Multiaddr {
    const port = NIM_WAKU_DEFAULT_P2P_PORT + this.portsShift;
    return multiaddr(`/ip4/127.0.0.1/tcp/${port}/`);
  }

  get rpcUrl(): string {
    const port = NIM_WAKU_DEFAULT_RPC_PORT + this.portsShift;
    return `http://localhost:${port}/`;
  }

  private async rpcCall(method: string, params: any[]) {
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

    return res.data;
  }

  private checkProcess() {
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
  return '0x' + hex;
}

export function bufToHex(buffer: Uint8Array) {
  return (
    '0x' +
    Array.prototype.map
      .call(buffer, (x) => ('00' + x.toString(16)).slice(-2))
      .join('')
  );
}

interface RpcInfoResponse {
  // multiaddr including id.
  listenStr: string;
}
