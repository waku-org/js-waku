import React from 'react';
import { useWaku } from './WakuContext';
import { Button } from '@material-ui/core';

interface Props {
  message: string
}

const Send = (props: Props) => {
  const { waku } = useWaku();

  const handleClick = async () => {
    await waku!.send(props.message);
  };

  return (
    <Button variant="contained" color="primary" size="large" onClick={handleClick}>
      Send
    </Button>
  );
};

export default Send;
