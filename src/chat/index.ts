import readline from 'readline';
import util from 'util';

import TCP from 'libp2p-tcp';
import Multiaddr from 'multiaddr';

import Waku from '../lib/waku';
import { WakuMessage } from '../lib/waku_message';
import { RelayDefaultTopic } from '../lib/waku_relay';
import { StoreCodec } from '../lib/waku_store';

import { ChatMessage } from './chat_message';

const ChatContentTopic = 'dingpu';

(async function () {
  const opts = processArguments();

  const waku = await Waku.create({
    listenAddresses: [opts.listenAddr],
    modules: { transport: [TCP] },
  });
  console.log('PeerId: ', waku.libp2p.peerId.toB58String());
  console.log('Listening on ');
  waku.libp2p.multiaddrs.forEach((address) => {
    console.log(`\t- ${address}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let nick = 'js-waku';
  try {
    const question = util.promisify(rl.question).bind(rl);
    // Looks like wrong type definition of promisify is picked.
    // May be related to https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20497
    nick = ((await question(
      'Please choose a nickname: '
    )) as unknown) as string;
  } catch (e) {
    console.log('Using default nick.');
  }

  console.log(`Hi, ${nick}!`);

  // TODO: Bubble event to waku, infer topic, decode msg
  // Tracked with https://github.com/status-im/js-waku/issues/19
  waku.libp2p.pubsub.on(RelayDefaultTopic, (event) => {
    const wakuMsg = WakuMessage.decode(event.data);
    if (wakuMsg.payload) {
      const chatMsg = ChatMessage.decode(wakuMsg.payload);
      printMessage(chatMsg);
    }
  });

  if (opts.staticNode) {
    console.log(`Dialing ${opts.staticNode}`);
    await waku.dial(opts.staticNode);
  }

  // If we connect to a peer with WakuStore, we run the protocol
  // TODO: Instead of doing it `once` it should always be done but
  // only new messages should be printed
  waku.libp2p.peerStore.once(
    'change:protocols',
    async ({ peerId, protocols }) => {
      if (protocols.includes(StoreCodec)) {
        console.log(
          `Retrieving archived messages from ${peerId.toB58String()}`
        );
        const messages = await waku.store.queryHistory(peerId, [
          ChatContentTopic,
        ]);
        messages?.map((msg) => {
          if (msg.payload) {
            const chatMsg = ChatMessage.decode(msg.payload);
            printMessage(chatMsg);
          }
        });
      }
    }
  );

  console.log('Ready to chat!');
  rl.prompt();
  for await (const line of rl) {
    rl.prompt();
    const chatMessage = new ChatMessage(new Date(), nick, line);

    const msg = WakuMessage.fromBytes(chatMessage.encode(), ChatContentTopic);
    await waku.relay.send(msg);
  }
})();

interface Options {
  staticNode?: Multiaddr;
  listenAddr: string;
}

function processArguments(): Options {
  const passedArgs = process.argv.slice(2);

  let opts: Options = { listenAddr: '/ip4/0.0.0.0/tcp/0' };

  while (passedArgs.length) {
    const arg = passedArgs.shift();
    switch (arg) {
      case '--staticNode':
        opts = Object.assign(opts, {
          staticNode: new Multiaddr(passedArgs.shift()),
        });
        break;
      case '--listenAddr':
        opts = Object.assign(opts, { listenAddr: passedArgs.shift() });
        break;
      default:
        console.log(`Unsupported argument: ${arg}`);
        process.exit(1);
    }
  }

  return opts;
}

function printMessage(chatMsg: ChatMessage) {
  const timestamp = chatMsg.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  console.log(`<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`);
}
