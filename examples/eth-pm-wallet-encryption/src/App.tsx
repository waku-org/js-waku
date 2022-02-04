import "@ethersproject/shims";

import React, { useEffect, useState } from "react";
import "./App.css";
import { Waku } from "js-waku";
import { Message } from "./messaging/Messages";
import "fontsource-roboto";
import { AppBar, IconButton, Toolbar, Typography } from "@material-ui/core";
import {
  createMuiTheme,
  ThemeProvider,
  makeStyles,
} from "@material-ui/core/styles";
import { lightBlue, orange, teal } from "@material-ui/core/colors";
import WifiIcon from "@material-ui/icons/Wifi";
import BroadcastPublicKey from "./BroadcastPublicKey";
import Messaging from "./messaging/Messaging";
import {
  PrivateMessageContentTopic,
  handlePrivateMessage,
  handlePublicKeyMessage,
  initWaku,
  PublicKeyContentTopic,
} from "./waku";
import { Web3Provider } from "@ethersproject/providers/src.ts/web3-provider";
import GetEncryptionPublicKey from "./GetEncryptionPublicKey";
import ConnectWallet from "./ConnectWallet";

const theme = createMuiTheme({
  palette: {
    primary: {
      main: orange[500],
    },
    secondary: {
      main: lightBlue[600],
    },
  },
});

const useStyles = makeStyles({
  root: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  appBar: {
    // height: '200p',
  },
  container: {
    display: "flex",
    flex: 1,
  },
  main: {
    flex: 1,
    margin: "10px",
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
  const [provider, setProvider] = useState<Web3Provider>();
  const [encPublicKey, setEncPublicKey] = useState<Uint8Array>();
  const [publicKeys, setPublicKeys] = useState<Map<string, Uint8Array>>(
    new Map()
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [address, setAddress] = useState<string>();
  const [peerStats, setPeerStats] = useState<{
    relayPeers: number;
    lightPushPeers: number;
  }>({
    relayPeers: 0,
    lightPushPeers: 0,
  });

  const classes = useStyles();

  // Waku initialization
  useEffect(() => {
    if (waku) return;
    initWaku()
      .then((_waku) => {
        console.log("waku: ready");
        setWaku(_waku);
      })
      .catch((e) => {
        console.error("Failed to initiate Waku", e);
      });
  }, [waku]);

  useEffect(() => {
    if (!waku) return;

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
    if (!address) return;
    if (!provider?.provider?.request) return;

    const observerPrivateMessage = handlePrivateMessage.bind(
      {},
      setMessages,
      address,
      provider.provider.request
    );

    waku.relay.addObserver(observerPrivateMessage, [
      PrivateMessageContentTopic,
    ]);

    return function cleanUp() {
      if (!waku) return;
      if (!observerPrivateMessage) return;
      waku.relay.deleteObserver(observerPrivateMessage, [
        PrivateMessageContentTopic,
      ]);
    };
  }, [waku, address, provider?.provider?.request]);

  useEffect(() => {
    if (!waku) return;

    const interval = setInterval(async () => {
      let lightPushPeers = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _peer of waku.store.peers) {
        lightPushPeers++;
      }

      setPeerStats({
        relayPeers: waku.relay.getPeers().size,
        lightPushPeers,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [waku]);

  let addressDisplay = "";
  if (address) {
    addressDisplay =
      address.substr(0, 6) + "..." + address.substr(address.length - 4, 4);
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
                color={waku ? undefined : "disabled"}
                style={waku ? { color: teal[500] } : {}}
              />
            </IconButton>
            <Typography className={classes.peers} aria-label="connected-peers">
              Peers: {peerStats.relayPeers} relay, {peerStats.lightPushPeers}{" "}
              light push
            </Typography>
            <Typography variant="h6" className={classes.title}>
              Ethereum Private Message with Wallet Encryption
            </Typography>
            <Typography>{addressDisplay}</Typography>
          </Toolbar>
        </AppBar>

        <div className={classes.container}>
          <main className={classes.main}>
            <fieldset>
              <legend>Wallet</legend>
              <ConnectWallet
                setProvider={setProvider}
                setAddress={setAddress}
              />
            </fieldset>
            <fieldset>
              <legend>Encryption Keys</legend>
              <GetEncryptionPublicKey
                setEncPublicKey={setEncPublicKey}
                providerRequest={provider?.provider?.request}
                address={address}
              />
              <BroadcastPublicKey
                address={address}
                encryptionPublicKey={encPublicKey}
                waku={waku}
                providerRequest={provider?.provider?.request}
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
