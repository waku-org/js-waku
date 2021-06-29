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
import {
  AppBar,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from '@material-ui/core';
import SendMessage from './SendMessage';
import KeyPairHandling from './key_pair_handling/KeyPairHandling';
import InitWaku from './InitWaku';
import {
  createMuiTheme,
  ThemeProvider,
  makeStyles,
} from '@material-ui/core/styles';
import { teal, purple, green } from '@material-ui/core/colors';
import WifiIcon from '@material-ui/icons/Wifi';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/json';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

declare let window: any;

const theme = createMuiTheme({
  palette: {
    primary: {
      main: purple[500],
    },
    secondary: {
      main: teal[600],
    },
  },
});

const useStyles = makeStyles({
  root: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  appBar: {
    // height: '200p',
  },
  container: {
    display: 'flex',
    flex: 1,
  },
  main: {
    flex: 1,
    margin: '10px',
  },
  wakuStatus: {},
});

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [provider, setProvider] = useState<Web3Provider>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair | undefined>();
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [address, setAddress] = useState<string>();

  const classes = useStyles();

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
    provider
      ?.getSigner()
      .getAddress()
      .then((address) => setAddress(address));
  });

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
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        <AppBar className={classes.appBar} position="static">
          <Toolbar>
            <Typography>Ethereum Direct Message</Typography>
            <IconButton
              edge="end"
              className={classes.wakuStatus}
              aria-label="waku-status"
            >
              <WifiIcon
                color={waku ? undefined : 'disabled'}
                style={waku ? { color: green[500] } : {}}
              />
            </IconButton>
          </Toolbar>
        </AppBar>

        <div className={classes.container}>
          <main className={classes.main}>
            <InitWaku
              ethDmKeyPair={ethDmKeyPair}
              setMessages={setMessages}
              setPublicKeys={setPublicKeys}
              setWaku={setWaku}
              waku={waku}
              address={address}
            />
            <fieldset>
              <legend>Eth-DM Key Pair</legend>
              <KeyPairHandling
                ethDmKeyPair={ethDmKeyPair}
                setEthDmKeyPair={(keyPair) => setEthDmKeyPair(keyPair)}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={broadcastPublicKey}
                disabled={!ethDmKeyPair || !waku}
              >
                Broadcast Eth-DM Public Key
              </Button>
            </fieldset>
            <fieldset>
              <legend>Messaging</legend>
              <SendMessage recipients={publicKeys} waku={waku} />
              <Messages messages={messages} />
            </fieldset>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;

function encodePublicKeyWakuMessage(ethDmMsg: PublicKeyMessage): WakuMessage {
  const payload = encode(ethDmMsg);
  return WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}
