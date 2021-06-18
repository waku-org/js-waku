import '@ethersproject/shims';

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import './App.css';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { ethers } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
import {
  createPublicKeyMessage,
  generateEthDmKeyPair,
  KeyPair,
  validatePublicKeyMessage,
} from './crypto';
import * as EthCrypto from 'eth-crypto';
import { DirectMessage, PublicKeyMessage } from './messages';
import { Message, Messages } from './Messages';

const PublicKeyContentTopic = '/eth-dm/1/public-key/json';
const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

declare let window: any;

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [provider, setProvider] = useState<Web3Provider>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair>();
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (provider) return;
    try {
      window.ethereum.enable();
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

    generateEthDmKeyPair(provider.getSigner())
      .then((keyPair) => {
        setEthDmKeyPair(keyPair);
      })
      .catch((e) => {
        console.error('Failed to generate Key Pair', e);
      });
  };

  const observerPublicKeyMessage = handlePublicKeyMessage.bind(
    {},
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
      waku.relay.send(wakuMsg).catch((e) => {
        console.error('Failed to send Public Key Message');
      });
    } else {
      createPublicKeyMessage(provider.getSigner(), ethDmKeyPair.publicKey)
        .then((msg) => {
          setPublicKeyMsg(msg);
          const wakuMsg = encodePublicKeyWakuMessage(msg);
          waku.relay.send(wakuMsg).catch((e) => {
            console.error('Failed to send Public Key Message');
          });
        })
        .catch((e) => {
          console.error('Failed to creat Eth-Dm Publication message', e);
        });
    }
  };

  const sendDummyMessage = () => {
    if (!waku) return;

    console.log(`Sending messages to ${publicKeys.size} peers`);
    publicKeys.forEach(async (publicKey, address) => {
      const msg = await encodeEncryptedWakuMessage(
        'Here is a secret message',
        publicKey,
        address
      );
      await waku?.lightPush.push(msg);
    });
  };

  const wakuReady = !!waku ? 'Waku is ready' : 'Waku is loading';

  return (
    <div className="App">
      <header className="App-header">
        {wakuReady}
        <button onClick={generateKeyPair} disabled={!provider}>
          Generate Eth-DM Key Pair
        </button>
        <button onClick={broadcastPublicKey} disabled={!ethDmKeyPair || !waku}>
          Broadcast Eth-DM Public Key
        </button>
        <button
          onClick={sendDummyMessage}
          disabled={!waku || publicKeys.size === 0}
        >
          Send Direct Message
        </button>
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
  // if (process?.env?.NODE_ENV === 'development') {
  return getStatusFleetNodes(Environment.Test);
  // } else {
  //   return getStatusFleetNodes(Environment.Prod);
  // }
}

function encodePublicKeyWakuMessage(ethDmMsg: PublicKeyMessage): WakuMessage {
  const payload = encode(ethDmMsg);
  return WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}

async function encodeEncryptedWakuMessage(
  message: string,
  publicKey: string,
  address: string
): Promise<WakuMessage> {
  const encryptedMsg = await EthCrypto.encryptWithPublicKey(publicKey, message);

  const directMsg: DirectMessage = {
    toAddress: address,
    encMessage: encryptedMsg,
  };

  const payload = encode(directMsg);
  return WakuMessage.fromBytes(payload, DirectMessageContentTopic);
}

function handlePublicKeyMessage(
  setter: Dispatch<SetStateAction<Map<string, string>>>,
  msg: WakuMessage
) {
  if (!msg.payload) return;
  const publicKeyMsg: PublicKeyMessage = decode(msg.payload);
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
  const text = await EthCrypto.decryptWithPrivateKey(
    privateKey,
    directMessage.encMessage
  );

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

function encode<T>(msg: T): Buffer {
  const jsonStr = JSON.stringify(msg);
  return Buffer.from(jsonStr, 'utf-8');
}

function decode<T>(bytes: Uint8Array): T {
  const buf = Buffer.from(bytes);
  const str = buf.toString('utf-8');
  return JSON.parse(str);
}
