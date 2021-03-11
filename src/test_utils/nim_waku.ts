import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';

import axios from 'axios';
import Multiaddr from 'multiaddr';
import multiaddr from 'multiaddr';
import PeerId from 'peer-id';

import { Message } from '../lib/waku_message';
import { TOPIC } from '../lib/waku_relay';

import waitForLine from './log_file';

const openAsync = promisify(fs.open);

const NIM_WAKU_BIN = '/home/froyer/src/status-im/nim-waku/build/wakunode2';
const NIM_WAKU_RPC_URL = 'http://localhost:8545/';
const NIM_WAKU_PEER_ID = PeerId.createFromB58String(
  '16Uiu2HAkyzsXzENw5XBDYEQQAeQTCYjBJpMLgBmEXuwbtcrgxBJ4'
);
const NIM_WAKKU_LISTEN_ADDR = multiaddr('/ip4/127.0.0.1/tcp/60000/');

export interface Args {
  staticnode?: string;
  nat?: 'none';
  listenAddress?: string;
  relay?: boolean;
  rpc?: boolean;
  rpcAdmin?: boolean;
  nodekey?: string;
}

export class NimWaku {
  private process?: ChildProcess;

  async start(args: Args) {
    // Start a local only node with the right RPC commands
    // The fixed nodekey ensures the node has a fixed Peerid: 16Uiu2HAkyzsXzENw5XBDYEQQAeQTCYjBJpMLgBmEXuwbtcrgxBJ4

    const logPath = './nim-waku.log';

    const logFile = await openAsync(logPath, 'w');

    const mergedArgs = argsToArray(mergeArguments(args));
    this.process = spawn(NIM_WAKU_BIN, mergedArgs, {
      cwd: '/home/froyer/src/status-im/nim-waku/',
      stdio: [
        'ignore', // stdin
        logFile, // stdout
        logFile, // stderr
      ],
    });

    this.process.on('exit', (signal) => {
      console.log(`ERROR: nim-waku node stopped: ${signal}`);
    });

    await waitForLine(logPath, 'RPC Server started');
    console.log('Nim waku RPC is started');
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

  async info() {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_debug_v1_info', []);

    return res.result;
  }

  async sendMessage(message: Message) {
    this.checkProcess();

    let payload;
    if (typeof message.payload === 'string') {
      payload = strToHex(message.payload);
    } else {
      payload = bufToHex(message.payload);
    }

    const rpcMessage = {
      payload,
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

  get peerId(): PeerId {
    return NIM_WAKU_PEER_ID;
  }

  get multiaddr(): Multiaddr {
    return NIM_WAKKU_LISTEN_ADDR;
  }

  private async rpcCall(method: string, params: any[]) {
    const res = await axios.post(
      NIM_WAKU_RPC_URL,
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

function defaultArgs(): Args {
  return {
    nat: 'none',
    listenAddress: '127.0.0.1',
    relay: true,
    rpc: true,
    rpcAdmin: true,
    nodekey: 'B2C4E3DB22EA6EB6850689F7B3DF3DDA73F59C87EFFD902BEDCEE90A3A2341A6',
  };
}

export function mergeArguments(args: Args): Args {
  const res = defaultArgs();

  Object.assign(res, args);

  return res;
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
