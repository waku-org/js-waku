import { ChildProcess, spawn } from 'child_process';

import axios from 'axios';
import Multiaddr from 'multiaddr';
import multiaddr from 'multiaddr';
import PeerId from 'peer-id';

import { delay } from './delay';

const NIM_WAKU_BIN = '/home/froyer/src/status-im/nim-waku/build/wakunode2';
const NIM_WAKU_RPC_URL = 'http://localhost:8545/';
const NIM_WAKU_PEER_ID = PeerId.createFromB58String(
  '16Uiu2HAkyzsXzENw5XBDYEQQAeQTCYjBJpMLgBmEXuwbtcrgxBJ4'
);
const NIM_WAKKU_LISTEN_ADDR = multiaddr('/ip4/127.0.0.1/tcp/60000/');

export class NimWaku {
  private process?: ChildProcess;

  async start() {
    // Start a local only node with the right RPC commands
    // The fixed nodekey ensures the node has a fixed Peerid: 16Uiu2HAkyzsXzENw5XBDYEQQAeQTCYjBJpMLgBmEXuwbtcrgxBJ4

    this.process = spawn(
      NIM_WAKU_BIN,
      [
        '--nat=none',
        '--listen-address=127.0.0.1',
        '--relay=true',
        '--rpc=true',
        '--rpc-admin=true',
        '--nodekey=B2C4E3DB22EA6EB6850689F7B3DF3DDA73F59C87EFFD902BEDCEE90A3A2341A6',
      ],
      { cwd: '/home/froyer/src/status-im/nim-waku/' }
    );

    this.process.on('exit', (signal) => {
      console.log(`nim-waku stopped: ${signal}`);
    });

    // TODO: Wait for line "RPC Server started "
    await delay(2000);
    console.log('Nim waku is hopefully started');
  }

  /** Calls nim-waku2 JSON-RPC API `get_waku_v2_admin_v1_peers` to check
   * for known peers
   * @throws if nim-waku2 isn't started.
   */
  async peers(): Promise<string[]> {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_admin_v1_peers', []);

    return res.result;
  }

  async info() {
    this.checkProcess();

    const res = await this.rpcCall('get_waku_v2_debug_v1_info', []);

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
