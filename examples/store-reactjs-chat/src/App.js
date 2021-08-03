import './App.css';
import { getStatusFleetNodes, Waku } from 'js-waku';
import * as React from 'react';
// import protons from 'protons';

// const ContentTopic = '/toy-chat/2/huilong/proto';

// const proto = protons(`
// message ChatMessage {
//   uint64 timestamp = 1;
//   string nick = 2;
//   bytes text = 3;
// }
// `);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');
  const [connections, setConnections] = React.useState();
  const [connectionHasChanged, setConnectionHasChanged] = React.useState(false);

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    Waku.create({ relayKeepAlive: 5 }).then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      bootstrapWaku(waku).then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  React.useEffect(()=> {
    connectionChange(waku, setConnectionHasChanged)
  }, [waku, connectionHasChanged])

  React.useEffect(() => {
    if (!waku) return

    const conns = Array.from(waku.libp2p.connections).map(([peerId, connections]) => {
      return (
        <li>

          {peerId}
          <ul>
            {connections.map((connection) => {
              return (
                <li>
                  <small>{connection.remoteAddr.toString()}: {connection.stat.status}</small>
                </li>
              );
            })}
          </ul>
        </li>
      );
    });

    setConnections(conns)
    setConnectionHasChanged(false)

  }, [waku, wakuStatus, connectionHasChanged])

  return (
    <div className="App">
      <header className="App-header">
        <h2>{wakuStatus}</h2>
        <h3>Connections</h3>
        <ul>
          {connections}
        </ul>
      </header>
    </div>
  );
}

export default App;

async function bootstrapWaku(waku) {
  const nodes = await getStatusFleetNodes();
  await Promise.all(nodes.map((addr) => waku.dial(addr)));
}

// function decodeMessage(wakuMessage) {
//   if (!wakuMessage.payload) return;
//
//   const { timestamp, nick, buf } = proto.ChatMessage.decode(
//     wakuMessage.payload
//   );
//
//   const time = new Date();
//   time.setTime(timestamp);
//
//   const text = Buffer.from(buf).toString('utf-8');
//
//   return { text, timestamp: time, nick };
// }

function connectionChange(waku, setChange) {
  if (!waku) return;

  waku.libp2p.connectionManager.on('peer:connect', () => {
    setChange(true)
  })
  waku.libp2p.connectionManager.on('peer:disconnect', () => {
    console.log("Peer disconnected")
    setChange(true)
  })

}
