import Waku from '../build/main/lib/waku';
import { TOPIC } from '../build/main/lib/waku_relay';
import { Message } from '../build/main/lib/waku_message';

import readline from 'readline';

;(async function() {

  const waku = await Waku.create();
  console.log('Waku started');
  await waku.dial('/ip4/134.209.139.210/tcp/30303/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ');
  // await waku.dial('/ip4/134.209.113.86/tcp/9000/p2p/16Uiu2HAmVVi6Q4j7MAKVibquW8aA27UNrA4Q8Wkz9EetGViu8ZF1');
  console.log('Static node has been dialed');

  // TODO: Automatically subscribe
  await waku.relay.subscribe();
  console.log('Subscribed to waku relay');

  // TODO: Bubble event to waku, infere topic, decode msg
  waku.libp2p.pubsub.on(TOPIC, event => {
    const msg = Message.fromBinary(event.data);
    console.log(msg.utf8Payload());
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Ready to chat!');
  rl.prompt();
  rl.on('line', async (line) => {
      rl.prompt();
      const msg = Message.fromUtf8String(line);
       await waku.relay.publish(msg);
  });

})();
