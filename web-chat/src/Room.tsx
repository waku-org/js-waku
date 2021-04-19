import {
  Container,
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
      <div>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Container maxWidth='xl'>
              {this.renderLines()}
            </Container>
          </Grid>
          <Grid item xs={10}>
            <MessageInput messageHandler={this.messageHandler} />
          </Grid>
          <Grid item xs={2}>
            <Send message={this.state.messageToSend} />
          </Grid>
        </Grid>
      </div>
    );
  }

  // TODO: Make it own component
  renderLines() {
    const renderedLines = [];
    for (const line of this.props.lines) {
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
  }
}
