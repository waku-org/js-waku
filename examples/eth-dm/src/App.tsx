import '@ethersproject/shims';

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import './App.css';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { ethers } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
import {
  createPublicKeyMessage,
  decryptMessage,
  generateEthDmKeyPair,
  KeyPair,
  recoverKeysFromPrivateKey,
  validatePublicKeyMessage,
} from './crypto';
import { decode, DirectMessage, encode, PublicKeyMessage } from './messages';
import { Message, Messages } from './Messages';
import 'fontsource-roboto';
import { Button } from '@material-ui/core';
import { SendMessage } from './SendMessage';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/json';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

const EthDmKeyStorageKey = 'ethDmKey';

declare let window: any;

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [provider, setProvider] = useState<Web3Provider>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair | undefined>(
    retrieveKeysFromStorage
  );
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!ethDmKeyPair) return;
    saveKeysToStorage(ethDmKeyPair);
  }, [ethDmKeyPair]);

  useEffect(() => {
    if (provider) return;
    try {
      window.ethereum.request({ method: 'eth_requestAccounts' });
      const _provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(_provider);
    } catch (e) {
      console.error('No web3 provider available');
    }
  }, [provider]);

  useEffect(() => {
    if (waku) return;
    initWaku()
      .then((wakuNode) => {
        console.log('waku: ready');
        setWaku(wakuNode);
      })
      .catch((e) => {
        console.error('Failed to initiate Waku', e);
      });
  }, [waku]);

  const generateKeyPair = () => {
    if (ethDmKeyPair) return;
    if (!provider) return;

    generateEthDmKeyPair()
      .then((keyPair) => {
        setEthDmKeyPair(keyPair);
      })
      .catch((e) => {
        console.error('Failed to generate Key Pair', e);
      });
  };

  const observerPublicKeyMessage = handlePublicKeyMessage.bind(
    {},
    ethDmKeyPair?.publicKey,
    setPublicKeys
  );

  const observerDirectMessage = ethDmKeyPair
    ? handleDirectMessage.bind({}, setMessages, ethDmKeyPair.privateKey)
    : undefined;

  useEffect(() => {
    if (!waku) return;
    waku.relay.addObserver(observerPublicKeyMessage, [PublicKeyContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      waku.relay.deleteObserver(observerPublicKeyMessage, [
        PublicKeyContentTopic,
      ]);
    };
  });

  useEffect(() => {
    if (!waku) return;
    if (!observerDirectMessage) return;
    waku.relay.addObserver(observerDirectMessage, [DirectMessageContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      if (!observerDirectMessage) return;
      waku.relay.deleteObserver(observerDirectMessage, [
        DirectMessageContentTopic,
      ]);
    };
  });

  const broadcastPublicKey = () => {
    if (!ethDmKeyPair) return;
    if (!provider) return;
    if (!waku) return;

    if (publicKeyMsg) {
      const wakuMsg = encodePublicKeyWakuMessage(publicKeyMsg);
      waku.lightPush.push(wakuMsg).catch((e) => {
        console.error('Failed to send Public Key Message');
      });
    } else {
      createPublicKeyMessage(provider.getSigner(), ethDmKeyPair.publicKey)
        .then((msg) => {
          setPublicKeyMsg(msg);
          const wakuMsg = encodePublicKeyWakuMessage(msg);
          waku.lightPush.push(wakuMsg).catch((e) => {
            console.error('Failed to send Public Key Message');
          });
        })
        .catch((e) => {
          console.error('Failed to creat Eth-Dm Publication message', e);
        });
    }
  };

  const wakuReady = !!waku ? 'Waku is ready' : 'Waku is loading';

  return (
    <div className="App">
      <header className="App-header">
        {wakuReady}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={generateKeyPair}
            disabled={!provider || !!ethDmKeyPair}
          >
            Generate Eth-DM Key Pair
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={broadcastPublicKey}
            disabled={!ethDmKeyPair || !waku}
          >
            Broadcast Eth-DM Public Key
          </Button>
        </div>
        <SendMessage recipients={publicKeys} waku={waku} />
        <Messages messages={messages} />
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

function encodePublicKeyWakuMessage(ethDmMsg: PublicKeyMessage): WakuMessage {
  const payload = encode(ethDmMsg);
  return WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}

function handlePublicKeyMessage(
  myPublicKey: string | undefined,
  setter: Dispatch<SetStateAction<Map<string, string>>>,
  msg: WakuMessage
) {
  if (!msg.payload) return;
  const publicKeyMsg: PublicKeyMessage = decode(msg.payload);
  if (publicKeyMsg.ethDmPublicKey === myPublicKey) return;
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log(`Public Key Message Received, valid: ${res}`, publicKeyMsg);

  setter((prevPks: Map<string, string>) => {
    prevPks.set(publicKeyMsg.ethAddress, publicKeyMsg.ethDmPublicKey);
    return new Map(prevPks);
  });
}

async function handleDirectMessage(
  setter: Dispatch<SetStateAction<Message[]>>,
  privateKey: string,
  wakuMsg: WakuMessage
) {
  console.log('Waku Message received:', wakuMsg);
  if (!wakuMsg.payload) return;
  const directMessage: DirectMessage = decode(wakuMsg.payload);
  const text = await decryptMessage(privateKey, directMessage);

  const timestamp = wakuMsg.timestamp ? wakuMsg.timestamp : new Date();

  console.log('Message decrypted:', text);
  setter((prevMsgs: Message[]) => {
    const copy = prevMsgs.slice();
    copy.push({
      text: text,
      timestamp: timestamp,
    });
    return copy;
  });
}

function saveKeysToStorage(ethDmKeyPair: KeyPair) {
  // /!\ Bad idea to store keys in clear. At least put a password on it.
  localStorage.setItem(EthDmKeyStorageKey, ethDmKeyPair.privateKey);
}

function retrieveKeysFromStorage() {
  const privateKey = window.localStorage.getItem(EthDmKeyStorageKey);
  if (privateKey) {
    return recoverKeysFromPrivateKey(privateKey);
  }
  return;
}
