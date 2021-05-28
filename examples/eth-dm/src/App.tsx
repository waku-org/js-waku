import React, { useEffect, useState } from 'react';
import './App.css';
import { Environment, getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';

declare let window: any;

function App() {
  const [waku, setWaku] = useState<Waku>();
  // const [provider, setProvider] = useState(new ethers.providers.Web3Provider(window.ethereum));

  useEffect(() => {
    if (!waku) {
      initWaku().then((wakuNode) => {
        setWaku(wakuNode);
      }).catch(e => {
        console.error('Failed to initiate Waku', e);
      });
    }
  }, [waku]);

  return (
    <div className='App'>
      <header className='App-header'>
      </header>
    </div>
  );
}

export default App;

async function initWaku(): Promise<Waku> {
  const waku = await Waku.create({});

  const nodes = await getNodes();
  await Promise.all(
    nodes.map((addr) => {
      return waku.dial(addr);
    })
  );

  return waku;
}

function getNodes() {
  // Works with react-scripts
  if (process?.env?.NODE_ENV === 'development') {
    return getStatusFleetNodes(Environment.Test);
  } else {
    return getStatusFleetNodes(Environment.Prod);
  }
}
