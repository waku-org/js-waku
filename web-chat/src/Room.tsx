import React from 'react';
import Input from './Input';
import Send from './Send';

interface Props {
  lines: string[],
}

interface State {
  messageToSend: string
}


export default class Room extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { messageToSend: '' };
  }

  render() {
    return (
      <div>
        <Input messageHandler={(msg: string) => {
          this.setState({ messageToSend: msg });
        }
        } />
        <Send message={this.state.messageToSend} />
        <div className='room'>
          {this.renderLines(this.props.lines)}
        </div>
      </div>
    );
  }

  renderLines(lines: string[]) {

    const renderedLines = [];
    for (const line of lines) {
      renderedLines.push(<div className='room-row'>{line}</div>);
    }

    return (
      <div>
        {renderedLines}
      </div>
    );
  }
}
