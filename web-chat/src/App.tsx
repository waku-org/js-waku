import React from 'react';
import './App.css';
import Room from './Room';
import WakuMock from './WakuMock';

interface Props {
}

interface State {
  messages: string[]
}

class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      messages: []
    };

     WakuMock.create().then((wakuMock) => {
       wakuMock.on('message',(message)=>{
         const messages = this.state.messages.slice();
         messages.push(message.message);
         this.setState({messages});
       })
     });
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
