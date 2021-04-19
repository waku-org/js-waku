import React from 'react';
import { useWaku } from './WakuContext';

interface Props {
  message: string
}

const Send = (props: Props) => {
  const { waku } = useWaku();

  return (
    <button className='sendButton' onClick={async () => {
      await waku!.send(props.message);
    }}>
    </button>
  );
};

export default Send;
