import React from 'react';
import Send from './Send';

interface Props {
  lines: string[]
}

interface State {
}


export default class Room extends React.Component<Props, State> {
  render() {
    return (
      <div>
        <Send />
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
