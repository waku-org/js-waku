import React from 'react';

interface Props {
  lines: string[]
}

interface State {
}

export default class Room extends React.Component<Props, State> {
  render() {
    return (
      <div className='room'>
        {this.renderLines(this.props.lines)}
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
