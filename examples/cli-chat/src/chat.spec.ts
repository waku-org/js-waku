import { expect } from 'chai';
import { ChatMessage } from 'waku';

import { formatMessage } from './chat';

describe('CLI Chat app', () => {
  it('Format message', () => {
    const date = new Date(234325324);
    const chatMessage = ChatMessage.fromUtf8String(
      date,
      'alice',
      'Hello world!'
    );

    expect(formatMessage(chatMessage)).to.match(/^<.*> alice: Hello world!$/);
  });
});
