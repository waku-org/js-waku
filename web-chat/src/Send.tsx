import React from 'react';
import { useWaku } from './WakuContext';

interface Props {
}

interface State {
}

const Send = () => {
  const { waku } = useWaku();

  return (
    <button className='sendButton' onClick={async () => {
      await waku!.send('Hello world!');
    }}>
    </button>
  );
};

export default Send;
