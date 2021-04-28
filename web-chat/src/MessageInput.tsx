import React, { ChangeEvent, KeyboardEvent, useState } from 'react';
import { Button, Grid, TextField } from '@material-ui/core';
import { useWaku } from './WakuContext';

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
    <Grid container direction="row" alignItems="center">
      <Grid item xs={11}>
        <TextField
          variant="outlined"
          label="Send a message"
          value={inputText}
          fullWidth={true}
          InputLabelProps={{
            shrink: true,
          }}
          onChange={messageHandler}
          onKeyPress={keyPressHandler}
          disabled={!waku}
        />
      </Grid>
      <Grid item xs={1}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={sendMessage}
          disabled={!waku}
        >
          Send
        </Button>
      </Grid>
    </Grid>
  );
}
