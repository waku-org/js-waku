import { Paper } from '@material-ui/core';
import React from 'react';
import './App.css';
import Room from './Room';
import WakuMock from './WakuMock';
import { WakuContext } from './WakuContext';

interface Props {
}

interface State {
  messages: string[],
  waku?: WakuMock
}

class App extends React.Component<Props, State> {
  waku?: WakuMock;

  constructor(props: Props) {
    super(props);

    this.state = {
      messages: []
    };

    WakuMock.create().then((wakuMock) => {

      this.setState({ waku: wakuMock, messages: this.state.messages });

      wakuMock.on('message', (message) => {
        const messages = this.state.messages.slice();
        messages.push(message.message);
        this.setState({ messages });
      });
    });
  }

  render() {
    return (
      <div className='App'>
        <div className='chat-room'>
          <WakuContext.Provider value={{ waku: this.state.waku }}>
            <Paper >
              <Room lines={this.state.messages} />
            </Paper>
          </WakuContext.Provider>
        </div>
      </div>
    );
  }
}

export default App;
