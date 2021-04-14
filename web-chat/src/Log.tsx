import React from 'react';

interface Props {
  lines: string[]
}

interface State {
}

export default class Log extends React.Component<Props, State> {
  render() {
    return (
      <div className='log'>
        {this.renderLines(this.props.lines)}
      </div>
    );
  }

  renderLines(lines: string[]) {

    const renderedLines = [];
    for (const line of lines) {
      renderedLines.push(<div className='log-row'>{line}</div>);
    }

    return (
      <div>
        {renderedLines}
      </div>
    );
  }
}
