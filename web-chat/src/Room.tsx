import {
  Box,
  Grid,
  List,
  ListItem,
  ListItemText
} from '@material-ui/core';
import React from 'react';
import MessageInput from './MessageInput';
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

  messageHandler(msg: string) {
    this.setState({ messageToSend: msg });
  }


  render() {
    return (
      <Grid container spacing={2}>

        <Grid item xs={12}>
          <Box height={800} maxHeight={800}
               style={{ flex: 1, maxHeight: '100%', overflow: 'scroll' }}>
            <Lines messages={this.props.lines} />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Grid container spacing={2} direction='row' alignItems='center'>
            <Grid item xs={11}>
              <MessageInput messageHandler={this.messageHandler.bind(this)} />
            </Grid>
            <Grid item xs={1}>
              <Send message={this.state.messageToSend} />
            </Grid>
          </Grid>
        </Grid>

      </Grid>
    );
  }
}

interface LinesProps {
  messages: string[]
}

const Lines = (props: LinesProps) => {
  const renderedLines = [];

  for (const line of props.messages) {
    renderedLines.push(<ListItem>
      <ListItemText
        primary={line}
      />
    </ListItem>);
  }

  return (
    <List dense={true}>
      {renderedLines}
    </List>
  );
};
