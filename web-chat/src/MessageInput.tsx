import React, { ChangeEvent, KeyboardEvent, useState } from 'react';
import { Button, Grid, TextField } from '@material-ui/core';
import { useWaku } from './WakuContext';

interface Props {
  messageHandler: (msg: string) => void;
  sendMessage: () => void;
}

export default function MessageInput(props: Props) {
  const [inputText, setInputText] = useState<string>('');
  const { waku } = useWaku();

  const sendMessage = () => {
    props.sendMessage();
    setInputText('');
  };

  const messageHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
    props.messageHandler(event.target.value);
  };

  const keyPressHandler = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <Grid container spacing={2} direction="row" alignItems="center">
      <Grid item xs={11}>
        <TextField
          variant="outlined"
          label="Send a message"
          value={inputText}
          fullWidth
          style={{ margin: 8 }}
          margin="normal"
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
