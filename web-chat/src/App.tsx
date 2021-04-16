import React from 'react';
import './App.css';
import Room from './Room';

interface Props {
}

interface State {
  messages: string[]
}

class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      messages: ['Here is a line', 'Here is another line']
    };
  }

  render() {
    return (
      <div className='App'>
        <div className='chat-room'>
          <Room lines={this.state.messages} />
        </div>
      </div>
    );
  }
}

export default App;
