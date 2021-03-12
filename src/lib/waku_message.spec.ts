import { fc, testProp } from 'ava-fast-check';

import { WakuMessage } from '../gen/proto/waku/v2/waku_pb';

import { Message } from './waku_message';

// This test is more about documenting how protobuf library works than testing it
testProp('Protobuf round trip binary serialisation', [fc.string()], (t, s) => {
  const wakuMsg = new WakuMessage();
  wakuMsg.setPayload(Buffer.from(s, 'utf-8'));

  const binary = wakuMsg.serializeBinary();
  const actual = WakuMessage.deserializeBinary(binary);

  const payload = actual.getPayload();

  let buf;
  if (typeof payload === 'string') {
    buf = Buffer.from(payload, 'base64');
  } else {
    buf = Buffer.from(payload);
  }

  t.deepEqual(s, buf.toString('utf-8'));
});

testProp(
  'Waku message round trip binary serialisation',
  [fc.string()],
  (t, s) => {
    const msg = Message.fromUtf8String(s);
    const binary = msg.toBinary();
    const actual = Message.fromBinary(binary);

    t.true(
      actual.isEqualTo(msg),
      `${JSON.stringify(actual)}\n${JSON.stringify(msg)}`
    );
  }
);
