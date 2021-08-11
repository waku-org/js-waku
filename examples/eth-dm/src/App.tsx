import '@ethersproject/shims';

import React, { useEffect, useState } from 'react';
import './App.css';
import { Waku } from 'js-waku';
import { ethers } from 'ethers';
import { Signer } from '@ethersproject/abstract-signer';
import { KeyPair } from './crypto';
import { Message } from './messaging/Messages';
import 'fontsource-roboto';
import { AppBar, IconButton, Toolbar, Typography } from '@material-ui/core';
import KeyPairHandling from './key_pair_handling/KeyPairHandling';
import {
  createMuiTheme,
  ThemeProvider,
  makeStyles,
} from '@material-ui/core/styles';
import { teal, purple, green } from '@material-ui/core/colors';
import WifiIcon from '@material-ui/icons/Wifi';
import BroadcastPublicKey from './BroadcastPublicKey';
import Messaging from './messaging/Messaging';
import {
  DirectMessageContentTopic,
  handleDirectMessage,
  handlePublicKeyMessage,
  initWaku,
  PublicKeyContentTopic,
} from './waku';

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
  wakuStatus: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
  peers: {},
});

function App() {
  const [waku, setWaku] = useState<Waku>();
  const [signer, setSigner] = useState<Signer>();
  const [ethDmKeyPair, setEthDmKeyPair] = useState<KeyPair | undefined>();
  const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [address, setAddress] = useState<string>();

  const classes = useStyles();

  useEffect(() => {
    try {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then((accounts: string[]) => {
          const _provider = new ethers.providers.Web3Provider(window.ethereum);
          setAddress(accounts[0]);
          setSigner(_provider.getSigner());
        });
    } catch (e) {
      console.error('No web3 provider available');
    }
  }, [address, signer]);

  // Waku initialization
  useEffect(() => {
    if (waku) return;
    initWaku()
      .then((_waku) => {
        console.log('waku: ready');
        setWaku(_waku);
      })
      .catch((e) => {
        console.error('Failed to initiate Waku', e);
      });
  }, [waku]);

  useEffect(() => {
    if (!waku) return;
    if (!address) return;

    const observerPublicKeyMessage = handlePublicKeyMessage.bind(
      {},
      address,
      setPublicKeys
    );

    waku.relay.addObserver(observerPublicKeyMessage, [PublicKeyContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      waku.relay.deleteObserver(observerPublicKeyMessage, [
        PublicKeyContentTopic,
      ]);
    };
  }, [waku, address]);

  useEffect(() => {
    if (!waku) return;
    if (!ethDmKeyPair) return;

    waku.relay.addDecryptionKey(ethDmKeyPair.privateKey);

    return function cleanUp() {
      if (!waku) return;
      if (!ethDmKeyPair) return;

      waku.relay.deleteDecryptionKey(ethDmKeyPair.privateKey);
    };
  }, [waku, ethDmKeyPair]);

  useEffect(() => {
    if (!waku) return;
    if (!ethDmKeyPair) return;
    if (!address) return;

    const observerDirectMessage = handleDirectMessage.bind(
      {},
      setMessages,
      ethDmKeyPair.privateKey,
      address
    );

    waku.relay.addObserver(observerDirectMessage, [DirectMessageContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      if (!observerDirectMessage) return;
      waku.relay.deleteObserver(observerDirectMessage, [
        DirectMessageContentTopic,
      ]);
    };
  }, [waku, address, ethDmKeyPair]);

  let relayPeers = 0;
  let lightPushPeers = 0;
  if (waku) {
    relayPeers = waku.relay.getPeers().size;
    lightPushPeers = waku.lightPush.peers.length;
  }

  let addressDisplay = '';
  if (address) {
    addressDisplay =
      address.substr(0, 6) + '...' + address.substr(address.length - 4, 4);
  }

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        <AppBar className={classes.appBar} position="static">
          <Toolbar>
            <IconButton
              edge="start"
              className={classes.wakuStatus}
              aria-label="waku-status"
            >
              <WifiIcon
                color={waku ? undefined : 'disabled'}
                style={waku ? { color: green[500] } : {}}
              />
            </IconButton>
            <Typography className={classes.peers} aria-label="connected-peers">
              Peers: {relayPeers} relay, {lightPushPeers} light push
            </Typography>
            <Typography variant="h6" className={classes.title}>
              Ethereum Direct Message
            </Typography>
            <Typography>{addressDisplay}</Typography>
          </Toolbar>
        </AppBar>

        <div className={classes.container}>
          <main className={classes.main}>
            <fieldset>
              <legend>Eth-DM Key Pair</legend>
              <KeyPairHandling
                ethDmKeyPair={ethDmKeyPair}
                setEthDmKeyPair={setEthDmKeyPair}
              />
              <BroadcastPublicKey
                signer={signer}
                ethDmKeyPair={ethDmKeyPair}
                waku={waku}
              />
            </fieldset>
            <fieldset>
              <legend>Messaging</legend>
              <Messaging
                recipients={publicKeys}
                waku={waku}
                messages={messages}
              />
            </fieldset>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
