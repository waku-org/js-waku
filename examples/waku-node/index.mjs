import Bootstrap from 'libp2p-bootstrap';
import PeerId from 'peer-id';
import { Waku } from 'js-waku';
import WebRTCDirect from 'libp2p-webrtc-direct';

;
(async () => {

  const hardcodedPeerId = await PeerId.createFromJSON({
    'id': '12D3KooWCuo3MdXfMgaqpLC5Houi1TRoFqgK9aoxok4NK5udMu8m',
    'privKey': 'CAESQAG6Ld7ev6nnD0FKPs033/j0eQpjWilhxnzJ2CCTqT0+LfcWoI2Vr+zdc1vwk7XAVdyoCa2nwUR3RJebPWsF1/I=',
    'pubKey': 'CAESIC33FqCNla/s3XNb8JO1wFXcqAmtp8FEd0SXmz1rBdfy'
  });

  const waku = await Waku.create({
    libp2p: {
      peerId: hardcodedPeerId,
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/9090/http/p2p-webrtc-direct']
      },
      modules: {
        transport: [WebRTCDirect]
      },
    }
  });

  waku.libp2p.connectionManager.on('peer:connect', (connection) => {
    console.info(`Connected to ${connection.remotePeer.toB58String()}!`);
  });

  console.log('Listening on:');
  waku.libp2p.multiaddrs.forEach((ma) => console.log(`${ma.toString()}/p2p/${waku.libp2p.peerId.toB58String()}`));

})();

