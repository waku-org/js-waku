import { Waku } from 'js-waku';
import * as React from 'react';

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    Waku.create({ bootstrap: true }).then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      waku.waitForConnectedPeer().then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  return (
    <div className='App'>
      <header className='App-header'>
        <p>Waku node's status: {wakuStatus}</p>
      </header>
    </div>
  );
}

export default App;
