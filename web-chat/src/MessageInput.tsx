import React, { ChangeEvent } from 'react';
import { TextField } from '@material-ui/core';

interface Props {
  messageHandler: (msg: string) => void;
}

interface State {
  inputText: string;
}

export default class MessageInput extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      inputText: ''
    };
  }

  messageHandler(event: ChangeEvent<HTMLInputElement>) {
    this.props.messageHandler(event.target.value);
  }

  render() {
    return (
      <TextField variant='outlined'
                 label='Send a message'
                 fullWidth
                 style={{ margin: 8 }}
                 margin="normal"
                 InputLabelProps={{
                   shrink: true,
                 }}
                 onChange={this.messageHandler.bind(this)}
      />
    );
  }
}
