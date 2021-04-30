import { ChangeEvent, KeyboardEvent, useState } from 'react';
import { useWaku } from './WakuContext';
import {
  TextInput,
  TextComposer,
  Row,
  Fill,
  Fit,
  SendButton,
} from '@livechat/ui-kit';

interface Props {
  messageHandler: (msg: string) => void;
  sendMessage: (() => Promise<void>) | undefined;
}

export default function MessageInput(props: Props) {
  const [inputText, setInputText] = useState<string>('');
  const { waku } = useWaku();

  const sendMessage = async () => {
    if (props.sendMessage) {
      await props.sendMessage();
      setInputText('');
    }
  };

  const messageHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
    props.messageHandler(event.target.value);
  };

  const keyPressHandler = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      await sendMessage();
    }
  };

  return (
    <TextComposer
      onKeyDown={keyPressHandler}
      onChange={messageHandler}
      active={!!waku}
      onButtonClick={sendMessage}
    >
      <Row align="center">
        <Fill>
          <TextInput value={inputText} />
        </Fill>
        <Fit>
          <SendButton />
        </Fit>
      </Row>
    </TextComposer>
  );
}
