import { Button } from '@material-ui/core';
import React, { useState } from 'react';
import { createPublicKeyMessage, KeyPair } from './crypto';
import { PublicKeyMessage } from './messaging/wire';
import { WakuMessage, Waku } from 'js-waku';
import { Signer } from '@ethersproject/abstract-signer';
import { PublicKeyContentTopic } from './waku';

interface Props {
  EncryptionKeyPair: KeyPair | undefined;
  waku: Waku | undefined;
  signer: Signer | undefined;
}

export default function BroadcastPublicKey({
  signer,
  EncryptionKeyPair,
  waku,
}: Props) {
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();

  const broadcastPublicKey = () => {
    if (!EncryptionKeyPair) return;
    if (!signer) return;
    if (!waku) return;

    if (publicKeyMsg) {
      encodePublicKeyWakuMessage(publicKeyMsg)
        .then((wakuMsg) => {
          waku.lightPush.push(wakuMsg).catch((e) => {
            console.error('Failed to send Public Key Message', e);
          });
        })
        .catch(() => {
          console.log('Failed to encode Public Key Message in Waku Message');
        });
    } else {
      createPublicKeyMessage(signer, EncryptionKeyPair.publicKey)
        .then((msg) => {
          setPublicKeyMsg(msg);
          encodePublicKeyWakuMessage(msg)
            .then((wakuMsg) => {
              waku.lightPush
                .push(wakuMsg)
                .then((res) => console.log('Public Key Message pushed', res))
                .catch((e) => {
                  console.error('Failed to send Public Key Message', e);
                });
            })
            .catch(() => {
              console.log(
                'Failed to encode Public Key Message in Waku Message'
              );
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
      disabled={!EncryptionKeyPair || !waku}
    >
      Broadcast Encryption Public Key
    </Button>
  );
}

async function encodePublicKeyWakuMessage(
  publicKeyMessage: PublicKeyMessage
): Promise<WakuMessage> {
  const payload = publicKeyMessage.encode();
  return await WakuMessage.fromBytes(payload, PublicKeyContentTopic);
}
