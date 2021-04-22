import React, { ChangeEvent, KeyboardEvent } from 'react';
import { TextField } from '@material-ui/core';

interface Props {
  messageHandler: (msg: string) => void;
  sendMessage: () => void;
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
    this.setState({inputText: event.target.value})
    this.props.messageHandler(event.target.value);
  }

  keyPressHandler(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      this.props.sendMessage()
      this.setState({inputText: ''})
    }
  }

  render() {
    return (
      <TextField variant='outlined'
                 label='Send a message'
                 value={this.state.inputText}
                 fullWidth
                 style={{ margin: 8 }}
                 margin="normal"
                 InputLabelProps={{
                   shrink: true,
                 }}
                 onChange={this.messageHandler.bind(this)}
                 onKeyPress={this.keyPressHandler.bind(this)}
      />
    );
  }
}
