import { expect } from 'chai';
import fc from 'fast-check';

import { ChatMessage } from './index';

describe('Chat Message', function () {
  it('Chat message round trip binary serialization', function () {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(0) }),
        fc.string(),
        fc.string(),
        (timestamp, nick, message) => {
          const msg = new ChatMessage(timestamp, nick, message);
          const buf = msg.encode();
          const actual = ChatMessage.decode(buf);

          // Date.toString does not include ms, as we loose this precision by design
          expect(actual.timestamp.toString()).to.eq(timestamp.toString());
          expect(actual.nick).to.eq(nick);
          expect(actual.message).to.eq(message);
        }
      )
    );
  });
});
