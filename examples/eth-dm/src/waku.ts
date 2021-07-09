import { Dispatch, SetStateAction } from 'react';
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { decode, DirectMessage, PublicKeyMessage } from './messaging/wire';
import { decryptMessage, validatePublicKeyMessage } from './crypto';
import { Message } from './messaging/Messages';
import { bufToHex, equalByteArrays } from 'js-waku/lib/utils';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/proto';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/json';

export async function initWaku(): Promise<Waku> {
  const waku = await Waku.create({});

  // Dial all nodes it can find
  getStatusFleetNodes().then((nodes) => {
    nodes.forEach((addr) => {
      waku.dial(addr);
    });
  });

  // Wait to be connected to at least one peer
  await new Promise((resolve, reject) => {
    // If we are not connected to any peer within 10sec let's just reject
    // As we are not implementing connection management in this example

    setTimeout(reject, 10000);
    waku.libp2p.connectionManager.on('peer:connect', () => {
      resolve(null);
    });
  });

  return waku;
}

export function handlePublicKeyMessage(
  myAddress: string,
  setter: Dispatch<SetStateAction<Map<string, string>>>,
  msg: WakuMessage
) {
  console.log('Public Key Message received:', msg);
  if (!msg.payload) return;
  const publicKeyMsg = PublicKeyMessage.decode(msg.payload);
  if (!publicKeyMsg) return;
  const ethDmPublicKey = bufToHex(publicKeyMsg.ethDmPublicKey);
  console.log(ethDmPublicKey, myAddress);
  if (myAddress && equalByteArrays(publicKeyMsg.ethAddress, myAddress)) return;

  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log('Is Public Key Message valid?', res);

  if (res) {
    setter((prevPks: Map<string, string>) => {
      prevPks.set(bufToHex(publicKeyMsg.ethAddress), ethDmPublicKey);
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
  // Only decrypt messages for us
  if (!equalByteArrays(directMessage.toAddress, address)) return;

  try {
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
  } catch (e) {
    console.log(' Failed to decrypt message', e);
  }
}
