import 'react-native-get-random-values';

import '@ethersproject/shims';

import React, { useEffect, useState } from 'react';
import './App.css';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { ethers } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
import {
  createPublicKeyMessage,
  PublicKeyMessage,
  generateEthDmKeyPair,
  KeyPair,
} from './crypto';

const ContentTopic = '/eth-dm/1/public-key/json';

declare let window: any;

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [provider, setProvider] = useState<Web3Provider>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair>();

  useEffect(() => {
    if (provider) return;
    const _provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(_provider);
  }, [provider]);

  useEffect(() => {
    if (waku) return;
    initWaku()
      .then((wakuNode) => {
        setWaku(wakuNode);
      })
      .catch((e) => {
        console.error('Failed to initiate Waku', e);
      });
  }, [waku]);

  useEffect(() => {
    if (ethDmKeyPair) return;
    if (!provider) return;

    generateEthDmKeyPair(provider.getSigner())
      .then((keyPair) => {
        setEthDmKeyPair(keyPair);
      })
      .catch((e) => {
        console.error('Failed to generate Key Pair', e);
      });
  }, [ethDmKeyPair, provider]);

  const onClick = () => {
    if (!ethDmKeyPair) return;
    if (!provider) return;
    if (!waku) return;

    createPublicKeyMessage(provider.getSigner(), ethDmKeyPair.publicKey)
      .then((msg) => {
        const wakuMsg = createWakuMessage(msg);
        waku.relay.send(wakuMsg).catch((e) => {
          console.error('Failed to send Public Key Message');
        });
      })
      .catch((e) => {
        console.error('Failed to creat Eth-Dm Publication message', e);
      });
  };

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={onClick} disabled={!ethDmKeyPair || !waku}>
          Broadcast Eth-DM Public Key
        </button>
      </header>
    </div>
  );
}

export default App;

async function initWaku(): Promise<Waku> {
  const waku = await Waku.create({});

  const nodes = await getNodes();
  await Promise.all(
    nodes.map((addr) => {
      return waku.dial(addr);
    })
  );

  return waku;
}

function getNodes() {
  // Works with react-scripts
  if (process?.env?.NODE_ENV === 'development') {
    return getStatusFleetNodes(Environment.Test);
  } else {
    return getStatusFleetNodes(Environment.Prod);
  }
}

function createWakuMessage(ethDmMsg: PublicKeyMessage): WakuMessage {
  const payload = Buffer.from(JSON.stringify(ethDmMsg));
  return WakuMessage.fromBytes(payload, ContentTopic);
}
