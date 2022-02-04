import { Button } from "@material-ui/core";
import React, { useState } from "react";
import {
  createPublicKeyMessage,
  KeyPair,
  PublicKeyMessageEncryptionKey,
} from "./crypto";
import { PublicKeyMessage } from "./messaging/wire";
import { WakuMessage, Waku } from "js-waku";
import { PublicKeyContentTopic } from "./waku";

interface Props {
  EncryptionKeyPair: KeyPair | undefined;
  waku: Waku | undefined;
  address: string | undefined;
  providerRequest:
    | ((request: { method: string; params?: Array<any> }) => Promise<any>)
    | undefined;
}

export default function BroadcastPublicKey({
  EncryptionKeyPair,
  waku,
  address,
  providerRequest,
}: Props) {
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();

  const broadcastPublicKey = () => {
    if (!EncryptionKeyPair) return;
    if (!address) return;
    if (!waku) return;
    if (!providerRequest) return;

    if (publicKeyMsg) {
      encodePublicKeyWakuMessage(publicKeyMsg)
        .then((wakuMsg) => {
          waku.lightPush.push(wakuMsg).catch((e) => {
            console.error("Failed to send Public Key Message", e);
          });
        })
        .catch((e) => {
          console.log("Failed to encode Public Key Message in Waku Message", e);
        });
    } else {
      createPublicKeyMessage(
        address,
        EncryptionKeyPair.publicKey,
        providerRequest
      )
        .then((msg) => {
          setPublicKeyMsg(msg);
          encodePublicKeyWakuMessage(msg)
            .then((wakuMsg) => {
              waku.lightPush
                .push(wakuMsg)
                .then((res) => console.log("Public Key Message pushed", res))
                .catch((e) => {
                  console.error("Failed to send Public Key Message", e);
                });
            })
            .catch((e) => {
              console.log(
                "Failed to encode Public Key Message in Waku Message",
                e
              );
            });
        })
        .catch((e) => {
          console.error("Failed to create public key message", e);
        });
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={broadcastPublicKey}
      disabled={!EncryptionKeyPair || !waku || !address || !providerRequest}
    >
      Broadcast Encryption Public Key
    </Button>
  );
}

async function encodePublicKeyWakuMessage(
  publicKeyMessage: PublicKeyMessage
): Promise<WakuMessage> {
  const payload = publicKeyMessage.encode();
  return await WakuMessage.fromBytes(payload, PublicKeyContentTopic, {
    symKey: PublicKeyMessageEncryptionKey,
  });
}
