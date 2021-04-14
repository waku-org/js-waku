import React from 'react';

interface Props {
}

interface State {
  lines: string[];
}

export default class Log extends React.Component<Props, State> {
  state: State = {
    lines: [
      'here',
      'is',
      'a',
      'line'
    ]
  };

  render() {
    return (
      <div className='log'>
        {this.renderLines()}
      </div>
    );
  }

  renderLines() {

    const lines = [];
    for (const line of this.state.lines) {
      lines.push(<div className='log-row'>{line}</div>);
    }

    return (
      <div>
        {lines}
      </div>
    );
  }
}
