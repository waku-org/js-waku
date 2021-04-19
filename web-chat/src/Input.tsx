import React from 'react';

interface Props {
  messageHandler: (msg: string)=>void;
}

interface State {
  inputText: string;
}

export default class Input extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      inputText: ''
    };
  }

  render() {
    return (
      <div>
        <label>Enter message:</label>
        <input type='textarea'
               name='textValue'
               onChange={(event) => {
               this.props.messageHandler(event.target.value)
               }
               }
        />
      </div>
    );
  }
}
