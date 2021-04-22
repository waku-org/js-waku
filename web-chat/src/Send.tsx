import React from 'react';
import { Button } from '@material-ui/core';

interface Props {
  sendMessage: () => void
}

const Send = (props: Props) => {
  return (
    <Button variant="contained" color="primary" size="large" onClick={props.sendMessage}>
      Send
    </Button>
  );
};

export default Send;
