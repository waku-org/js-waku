import { Dispatch, SetStateAction } from 'react';
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { DirectMessage, PublicKeyMessage } from './messaging/wire';
import { validatePublicKeyMessage } from './crypto';
import { Message } from './messaging/Messages';
import { bufToHex, equalByteArrays } from 'js-waku/lib/utils';

export const PublicKeyContentTopic = '/eth-dm/1/public-key/proto';
export const DirectMessageContentTopic = '/eth-dm/1/direct-message/proto';

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
  address: string,
  wakuMsg: WakuMessage
) {
  console.log('Direct Message received:', wakuMsg);
  if (!wakuMsg.payload) return;
  const directMessage = DirectMessage.decode(wakuMsg.payload);
  if (!directMessage) {
    console.log('Failed to decode Direct Message');
    return;
  }
  if (!equalByteArrays(directMessage.toAddress, address)) return;

  const timestamp = wakuMsg.timestamp ? wakuMsg.timestamp : new Date();

  console.log('Message decrypted:', directMessage.message);
  setter((prevMsgs: Message[]) => {
    const copy = prevMsgs.slice();
    copy.push({
      text: directMessage.message,
      timestamp: timestamp,
    });
    return copy;
  });
}
