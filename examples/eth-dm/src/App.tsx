import '@ethersproject/shims';

import React, { useEffect, useState } from 'react';
import './App.css';
import { Waku, WakuMessage } from 'js-waku';
import { ethers } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
import { createPublicKeyMessage, KeyPair } from './crypto';
import { encode, PublicKeyMessage } from './messages';
import Messages, { Message } from './Messages';
import 'fontsource-roboto';
import { Button } from '@material-ui/core';
import SendMessage from './SendMessage';
import KeyPairHandling from './key_pair_handling/KeyPairHandling';
import InitWaku from './InitWaku';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/json';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

declare let window: any;

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [provider, setProvider] = useState<Web3Provider>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair | undefined>();
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);

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

  const broadcastPublicKey = () => {
    if (!ethDmKeyPair) return;
    if (!provider) return;
    if (!waku) return;

    if (publicKeyMsg) {
      const wakuMsg = encodePublicKeyWakuMessage(publicKeyMsg);
      waku.lightPush.push(wakuMsg).catch((e) => {
        console.error('Failed to send Public Key Message', e);
      });
    } else {
      createPublicKeyMessage(provider.getSigner(), ethDmKeyPair.publicKey)
        .then((msg) => {
          setPublicKeyMsg(msg);
          const wakuMsg = encodePublicKeyWakuMessage(msg);
          waku.lightPush.push(wakuMsg).catch((e) => {
            console.error('Failed to send Public Key Message', e);
          });
        })
        .catch((e) => {
          console.error('Failed to creat Eth-Dm Publication message', e);
        });
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <InitWaku
          ethDmKeyPair={ethDmKeyPair}
          setMessages={setMessages}
          setPublicKeys={setPublicKeys}
          setWaku={setWaku}
          waku={waku}
        />
        <KeyPairHandling
          ethDmKeyPair={ethDmKeyPair}
          setEthDmKeyPair={(keyPair) => setEthDmKeyPair(keyPair)}
        />
        <div>
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

function encodePublicKeyWakuMessage(ethDmMsg: PublicKeyMessage): WakuMessage {
  const payload = encode(ethDmMsg);
  return WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}
