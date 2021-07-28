import './App.css';
import { getStatusFleetNodes, Waku } from 'js-waku';
import * as React from 'react';

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('NotStarted');

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'NotStarted') return;

    setWakuStatus('Starting');

    Waku.create().then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      bootstrapWaku(waku).then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
      </header>
    </div>
  );
}

export default App;

async function bootstrapWaku(waku) {
  const nodes = await getStatusFleetNodes();
  await Promise.all(nodes.map((addr) => waku.dial(addr)));
}
