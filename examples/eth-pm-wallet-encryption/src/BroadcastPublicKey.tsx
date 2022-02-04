import { Button } from "@material-ui/core";
import React from "react";
import { createPublicKeyMessage } from "./crypto";
import { PublicKeyMessage } from "./messaging/wire";
import { WakuMessage, Waku } from "js-waku";
import { PublicKeyContentTopic } from "./waku";

interface Props {
  encryptionPublicKey: Uint8Array | undefined;
  waku: Waku | undefined;
  address: string | undefined;
  providerRequest:
    | ((request: { method: string; params?: Array<any> }) => Promise<any>)
    | undefined;
}

export default function BroadcastPublicKey({
  encryptionPublicKey,
  address,
  waku,
  providerRequest,
}: Props) {
  const broadcastPublicKey = () => {
    if (!encryptionPublicKey) return;
    if (!address) return;
    if (!waku) return;
    if (!providerRequest) return;

    console.log("Creating Public Key Message");
    createPublicKeyMessage(address, encryptionPublicKey, providerRequest)
      .then((msg) => {
        console.log("Public Key Message created");
        encodePublicKeyWakuMessage(msg)
          .then((wakuMsg) => {
            console.log("Public Key Message encoded");
            waku.lightPush
              .push(wakuMsg)
              .then((res) => console.log("Public Key Message pushed", res))
              .catch((e) => {
                console.error("Failed to send Public Key Message", e);
              });
          })
          .catch(() => {
            console.log("Failed to encode Public Key Message in Waku Message");
          });
      })
      .catch((e) => {
        console.error("Failed to create public key message", e);
      });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={broadcastPublicKey}
      disabled={!encryptionPublicKey || !waku || !address || !providerRequest}
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
