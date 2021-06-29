import { Dispatch, SetStateAction, useEffect } from 'react';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import { decode, DirectMessage, PublicKeyMessage } from './messages';
import { decryptMessage, KeyPair, validatePublicKeyMessage } from './crypto';
import { Message } from './Messages';
import { DirectMessageContentTopic, PublicKeyContentTopic } from './App';

interface Props {
  waku: Waku | undefined;
  setWaku: (waku: Waku) => void;
  ethDmKeyPair: KeyPair | undefined;
  setPublicKeys: Dispatch<SetStateAction<Map<string, string>>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  address: string | undefined;
}

/**
 * Does all the waku initialisation
 */
export default function InitWaku({
  waku,
  setWaku,
  ethDmKeyPair,
  setPublicKeys,
  setMessages,
  address,
}: Props) {
  useEffect(() => {
    if (waku) return;
    initWaku()
      .then((wakuNode) => {
        console.log('waku: ready');
        setWaku(wakuNode);
      })
      .catch((e) => {
        console.error('Failed to initiate Waku', e);
      });
  }, [waku, setWaku]);

  const observerPublicKeyMessage = handlePublicKeyMessage.bind(
    {},
    ethDmKeyPair?.publicKey,
    setPublicKeys
  );

  const observerDirectMessage =
    ethDmKeyPair && address
      ? handleDirectMessage.bind(
          {},
          setMessages,
          ethDmKeyPair.privateKey,
          address
        )
      : undefined;

  useEffect(() => {
    if (!waku) return;
    waku.relay.addObserver(observerPublicKeyMessage, [PublicKeyContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      waku.relay.deleteObserver(observerPublicKeyMessage, [
        PublicKeyContentTopic,
      ]);
    };
  });

  useEffect(() => {
    if (!waku) return;
    if (!observerDirectMessage) return;
    waku.relay.addObserver(observerDirectMessage, [DirectMessageContentTopic]);

    return function cleanUp() {
      if (!waku) return;
      if (!observerDirectMessage) return;
      waku.relay.deleteObserver(observerDirectMessage, [
        DirectMessageContentTopic,
      ]);
    };
  });

  return <p>{!!waku ? 'Waku is ready' : 'Waku is loading'}</p>;
}

async function initWaku(): Promise<Waku> {
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
  // Works with react-scripts
  if (process?.env?.NODE_ENV === 'development') {
    return getStatusFleetNodes(Environment.Test);
  } else {
    return getStatusFleetNodes(Environment.Prod);
  }
}

function handlePublicKeyMessage(
  myPublicKey: string | undefined,
  setter: Dispatch<SetStateAction<Map<string, string>>>,
  msg: WakuMessage
) {
  if (!msg.payload) return;
  const publicKeyMsg: PublicKeyMessage = decode(msg.payload);
  if (publicKeyMsg.ethDmPublicKey === myPublicKey) return;
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log(`Public Key Message Received, valid: ${res}`, publicKeyMsg);

  setter((prevPks: Map<string, string>) => {
    prevPks.set(publicKeyMsg.ethAddress, publicKeyMsg.ethDmPublicKey);
    return new Map(prevPks);
  });
}

async function handleDirectMessage(
  setter: Dispatch<SetStateAction<Message[]>>,
  privateKey: string,
  address: string,
  wakuMsg: WakuMessage
) {
  console.log('Waku Message received:', wakuMsg);
  if (!wakuMsg.payload) return;
  const directMessage: DirectMessage = decode(wakuMsg.payload);
  if (directMessage.toAddress !== address) return;

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
