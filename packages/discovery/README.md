# @waku/discovery

Peer discovery implementations for Waku nodes.

## Features

- **DNS Discovery** - Discover peers via DNS-over-HTTPS using ENR records
- **Peer Exchange** - Discover peers through the Waku peer exchange protocol  
- **Local Peer Cache** - Cache discovered peers in local storage

## Installation

```bash
npm install @waku/discovery
```

## Usage

```typescript
import { wakuDnsDiscovery, wakuPeerExchangeDiscovery } from "@waku/discovery";
import { createLightNode } from "@waku/sdk";
import { enrTree } from "@waku/discovery";

const waku = await createLightNode({
  libp2p: {
    peerDiscovery: [
      wakuDnsDiscovery([enrTree["SANDBOX"]], {
        store: 3,
        filter: 3,
        lightPush: 3
      }),
      wakuPeerExchangeDiscovery(["/waku/2/rs/0/0"])
    ]
  }
});
```

## API

See [API documentation](https://docs.waku.org/docs/js-waku/js-waku-discovery).

## Development

For implementation details and development notes, see [CLAUDE.md](./CLAUDE.md).