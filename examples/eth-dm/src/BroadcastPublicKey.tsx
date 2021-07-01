import { Button } from '@material-ui/core';
import React, { useState } from 'react';
import { createPublicKeyMessage, KeyPair } from './crypto';
import { PublicKeyMessage } from './messaging/wire';
import { WakuMessage, Waku } from 'js-waku';
import { Signer } from '@ethersproject/abstract-signer';
import { PublicKeyContentTopic } from './InitWaku';

interface Props {
  ethDmKeyPair: KeyPair | undefined;
  waku: Waku | undefined;
  signer: Signer | undefined;
}

export default function BroadcastPublicKey({
  signer,
  ethDmKeyPair,
  waku,
}: Props) {
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();

  const broadcastPublicKey = () => {
    if (!ethDmKeyPair) return;
    if (!signer) return;
    if (!waku) return;

    if (publicKeyMsg) {
      const wakuMsg = encodePublicKeyWakuMessage(publicKeyMsg);
      waku.lightPush.push(wakuMsg).catch((e) => {
        console.error('Failed to send Public Key Message', e);
      });
    } else {
      createPublicKeyMessage(signer, ethDmKeyPair.publicKey)
        .then((msg) => {
          setPublicKeyMsg(msg);
          const wakuMsg = encodePublicKeyWakuMessage(msg);
          waku.lightPush.push(wakuMsg).catch((e) => {
            console.error('Failed to send Public Key Message', e);
          });
        })
        .catch((e) => {
          console.error('Failed to create public key message', e);
        });
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={broadcastPublicKey}
      disabled={!ethDmKeyPair || !waku}
    >
      Broadcast Eth-DM Public Key
    </Button>
  );
}

function encodePublicKeyWakuMessage(
  publicKeyMessage: PublicKeyMessage
): WakuMessage {
  const payload = publicKeyMessage.encode();
  return WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}
