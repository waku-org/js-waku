import { Dispatch, SetStateAction } from "react";
import { utils, Waku, WakuMessage } from "js-waku";
import { PrivateMessage, PublicKeyMessage } from "./messaging/wire";
import { validatePublicKeyMessage } from "./crypto";
import { Message } from "./messaging/Messages";
import { equals } from "uint8arrays/equals";

export const PublicKeyContentTopic = "/eth-pm/1/public-key/proto";
export const PrivateMessageContentTopic = "/eth-pm/1/private-message/proto";

export async function initWaku(): Promise<Waku> {
  const waku = await Waku.create({ bootstrap: { default: true } });

  // Wait to be connected to at least one peer
  await new Promise((resolve, reject) => {
    // If we are not connected to any peer within 10sec let's just reject
    // As we are not implementing connection management in this example

    setTimeout(reject, 10000);
    waku.libp2p.connectionManager.on("peer:connect", () => {
      resolve(null);
    });
  });

  return waku;
}

export function handlePublicKeyMessage(
  myAddress: string | undefined,
  setter: Dispatch<SetStateAction<Map<string, Uint8Array>>>,
  msg: WakuMessage
) {
  console.log("Public Key Message received:", msg);
  if (!msg.payload) return;
  const publicKeyMsg = PublicKeyMessage.decode(msg.payload);
  if (!publicKeyMsg) return;
  if (myAddress && equals(publicKeyMsg.ethAddress, utils.hexToBytes(myAddress)))
    return;

  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log("Is Public Key Message valid?", res);

  if (res) {
    setter((prevPks: Map<string, Uint8Array>) => {
      prevPks.set(
        utils.bytesToHex(publicKeyMsg.ethAddress),
        publicKeyMsg.encryptionPublicKey
      );
      return new Map(prevPks);
    });
  }
}

export async function handlePrivateMessage(
  setter: Dispatch<SetStateAction<Message[]>>,
  address: string,
  wakuMsg: WakuMessage
) {
  console.log("Private Message received:", wakuMsg);
  if (!wakuMsg.payload) return;
  const privateMessage = PrivateMessage.decode(wakuMsg.payload);
  if (!privateMessage) {
    console.log("Failed to decode Private Message");
    return;
  }
  if (!equals(privateMessage.toAddress, utils.hexToBytes(address))) return;

  const timestamp = wakuMsg.timestamp ? wakuMsg.timestamp : new Date();

  console.log("Message decrypted:", privateMessage.message);
  setter((prevMsgs: Message[]) => {
    const copy = prevMsgs.slice();
    copy.push({
      text: privateMessage.message,
      timestamp: timestamp,
    });
    return copy;
  });
}
