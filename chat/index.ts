import Waku from '../build/main/lib/waku';
import { TOPIC } from '../build/main/lib/waku_relay';
import { Message } from '../build/main/lib/waku_message';

import readline from 'readline';
import { delay } from '../build/main/test_utils/delay';

;(async function() {

  const waku = await Waku.create();

  // TODO: Bubble event to waku, infere topic, decode msg
  waku.libp2p.pubsub.on(TOPIC, event => {
    const msg = Message.fromBinary(event.data);
    console.log(msg.utf8Payload());
  });

  console.log('Waku started');
  // Status static node
   await waku.dial('/ip4/134.209.139.210/tcp/30303/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ');

  // Richard's node
  // await waku.dial('/ip4/134.209.113.86/tcp/9000/p2p/16Uiu2HAmVVi6Q4j7MAKVibquW8aA27UNrA4Q8Wkz9EetGViu8ZF1');

  // await waku.dial('/ip4/0.0.0.0/tcp/60000/p2p/16Uiu2HAmDVYacyxN4t1SYBhRSTDr6nmYwuY6qWWTgagZm558rFA6')

  await delay(100);

  console.log('Static node has been dialed');

  await new Promise((resolve) =>
    waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
  );

  // TODO: Automatically subscribe
  await waku.relay.subscribe();
  console.log('Subscribed to waku relay');

  await new Promise((resolve) =>
    waku.libp2p.pubsub.once('gossipsub:heartbeat', resolve)
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Ready to chat!');
  rl.prompt();
  rl.on('line', async (line) => {
      rl.prompt();
      const msg = Message.fromUtf8String('(js-chat) ' + line);
       await waku.relay.publish(msg);
  });

})();
