import readline from 'readline';
import util from 'util';

import Waku from '../lib/waku';
import { Message } from '../lib/waku_message';
import { TOPIC } from '../lib/waku_relay';
import { delay } from '../test_utils/delay';

import { ChatMessage } from './chat_message';

(async function () {
  const opts = processArguments();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = util.promisify(rl.question).bind(rl);

  // Looks like wrong type definition of promisify is picked.
  // May be related to https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20497
  const nick = ((await question(
    'Please choose a nickname: '
  )) as unknown) as string;
  console.log(`Hi ${nick}!`);

  const waku = await Waku.create({ listenAddresses: [opts.listenAddr] });

  // TODO: Bubble event to waku, infer topic, decode msg
  waku.libp2p.pubsub.on(TOPIC, (event) => {
    const wakuMsg = Message.decode(event.data);
    if (wakuMsg.payload) {
      const chatMsg = ChatMessage.decode(wakuMsg.payload);
      const timestamp = chatMsg.timestamp.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
      });
      console.log(`<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`);
    }
  });

  console.log('Waku started');

  if (opts.staticNode) {
    console.log(`dialing ${opts.staticNode}`);
    await waku.dial(opts.staticNode);
  }

  await new Promise((resolve) =>
    waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
  );

  // TODO: identify if it is possible to listen to an event to confirm dial
  // finished instead of an arbitrary delay.
  await delay(2000);
  // TODO: Automatically subscribe
  await waku.relay.subscribe();
  console.log('Subscribed to waku relay');

  await new Promise((resolve) =>
    waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
  );

  console.log('Ready to chat!');
  rl.prompt();
  for await (const line of rl) {
    rl.prompt();
    const chatMessage = new ChatMessage(new Date(), nick, line);

    const msg = Message.fromBytes(chatMessage.encode());
    await waku.relay.publish(msg);
  }
})();

interface Options {
  staticNode?: string;
  listenAddr: string;
}

function processArguments(): Options {
  const passedArgs = process.argv.slice(2);

  let opts: Options = { listenAddr: '/ip4/0.0.0.0/tcp/0' };

  while (passedArgs.length) {
    const arg = passedArgs.shift();
    switch (arg) {
      case '--staticNode':
        opts = Object.assign(opts, { staticNode: passedArgs.shift() });
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
