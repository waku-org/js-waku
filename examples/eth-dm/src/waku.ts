import { Dispatch, SetStateAction, useEffect } from 'react';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { decode, DirectMessage, PublicKeyMessage } from './messaging/wire';
import { decryptMessage, KeyPair, validatePublicKeyMessage } from './crypto';
import { Message } from './messaging/Messages';
import { byteArrayToHex } from './utils';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/proto';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

export async function initWaku(): Promise<Waku> {
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
  return getStatusFleetNodes(Environment.Prod);
}

export function handlePublicKeyMessage(
  myPublicKey: string | undefined,
  setter: Dispatch<SetStateAction<Map<string, string>>>,
  msg: WakuMessage
) {
  console.log('Public Key Message received:', msg);
  if (!msg.payload) return;
  const publicKeyMsg = PublicKeyMessage.decode(msg.payload);
  if (!publicKeyMsg) return;
  const ethDmPublicKey = byteArrayToHex(publicKeyMsg.ethDmPublicKey);
  if (ethDmPublicKey === myPublicKey) return;

  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log('Is Public Key Message valid?', res);

  if (res) {
    setter((prevPks: Map<string, string>) => {
      prevPks.set(byteArrayToHex(publicKeyMsg.ethAddress), ethDmPublicKey);
      return new Map(prevPks);
    });
  }
}

export async function handleDirectMessage(
  setter: Dispatch<SetStateAction<Message[]>>,
  privateKey: string,
  address: string,
  wakuMsg: WakuMessage
) {
  console.log('Direct Message received:', wakuMsg);
  if (!wakuMsg.payload) return;
  const directMessage: DirectMessage = decode(wakuMsg.payload);
  // Do not return our own messages
  if (directMessage.toAddress === address) return;

  const text = await decryptMessage(privateKey, directMessage);

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
