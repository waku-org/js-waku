import readline from 'readline';
import util from 'util';

import {
  ChatMessage,
  getStatusFleetNodes,
  StoreCodec,
  Waku,
  WakuMessage,
} from 'js-waku';
import TCP from 'libp2p-tcp';
import { multiaddr, Multiaddr } from 'multiaddr';

const ChatContentTopic = 'dingpu';

export default async function startChat(): Promise<void> {
  let opts = processArguments();

  if (opts.autoDial) {
    opts = await addFleetNodes(opts);
  }

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
    console.log('Using default nick. Due to ', e);
  }

  console.log(`Hi, ${nick}!`);

  waku.relay.addObserver(
    (message) => {
      if (message.payload) {
        const chatMsg = ChatMessage.decode(message.payload);
        console.log(formatMessage(chatMsg));
      }
    },
    [ChatContentTopic]
  );

  await Promise.all(
    opts.staticNodes.map((addr) => {
      console.log(`Dialing ${addr}`);
      return waku.dial(addr);
    })
  );

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
        const messages = await waku.store.queryHistory({
          peerId,
          contentTopics: [ChatContentTopic],
        });
        messages?.map((msg) => {
          if (msg.payload) {
            const chatMsg = ChatMessage.decode(msg.payload);
            console.log(formatMessage(chatMsg));
          }
        });
      }
    }
  );

  console.log('Ready to chat!');
  rl.prompt();
  for await (const line of rl) {
    rl.prompt();
    const chatMessage = ChatMessage.fromUtf8String(new Date(), nick, line);

    const msg = WakuMessage.fromBytes(chatMessage.encode(), ChatContentTopic);
    await waku.relay.send(msg);
  }
}

interface Options {
  staticNodes: Multiaddr[];
  listenAddr: string;
  autoDial: boolean;
}

function processArguments(): Options {
  const passedArgs = process.argv.slice(2);

  let opts: Options = {
    listenAddr: '/ip4/0.0.0.0/tcp/0',
    staticNodes: [],
    autoDial: false,
  };

  while (passedArgs.length) {
    const arg = passedArgs.shift();
    switch (arg) {
      case '--staticNode':
        opts.staticNodes.push(multiaddr(passedArgs.shift()!));
        break;
      case '--listenAddr':
        opts = Object.assign(opts, { listenAddr: passedArgs.shift() });
        break;
      case '--autoDial':
        opts.autoDial = true;
        break;
      default:
        console.log(`Unsupported argument: ${arg}`);
        process.exit(1);
    }
  }

  return opts;
}

export function formatMessage(chatMsg: ChatMessage): string {
  const timestamp = chatMsg.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  return `<${timestamp}> ${chatMsg.nick}: ${chatMsg.payloadAsUtf8}`;
}

async function addFleetNodes(opts: Options): Promise<Options> {
  await getStatusFleetNodes().then((nodes) =>
    nodes.map((addr) => {
      opts.staticNodes.push(multiaddr(addr));
    })
  );
  return opts;
}
