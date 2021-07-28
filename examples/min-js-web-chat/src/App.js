import './App.css';
import { Waku } from 'js-waku';
import * as React from 'react';

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStarting, setWakuStarting] = React.useState(false);

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStarting) return;

    setWakuStarting(true);

    Waku.create().then((waku) => {
      setWaku(waku);
      setWakuStarting(false);
    });
  }, [waku, wakuStarting]);

  const wakuStatus = !!waku ? 'Started' : wakuStarting ? 'Loading' : 'Error';

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
      </header>
    </div>
  );
}

export default App;
