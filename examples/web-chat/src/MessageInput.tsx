import { ChangeEvent, KeyboardEvent, useState } from "react";
import { useWaku } from "./WakuContext";
import {
  TextInput,
  TextComposer,
  Row,
  Fill,
  Fit,
  SendButton,
} from "@livechat/ui-kit";

interface Props {
  sendMessage: ((msg: string) => Promise<void>) | undefined;
}

export default function MessageInput(props: Props) {
  const [inputText, setInputText] = useState<string>("");
  const { waku } = useWaku();

  const sendMessage = async () => {
    if (props.sendMessage) {
      await props.sendMessage(inputText);
      setInputText("");
    }
  };

  const messageHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
  };

  const keyPressHandler = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    ) {
      await sendMessage();
    }
  };

  // Enable the button if there are relay peers available or the user is sending a command
  const activeButton =
    (waku && waku.relay.getPeers().size !== 0) || inputText.startsWith("/");

  return (
    <TextComposer
      onKeyDown={keyPressHandler}
      onChange={messageHandler}
      active={activeButton}
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
