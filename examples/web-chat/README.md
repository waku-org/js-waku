# Web Chat App

**Demonstrates**:

- Group chat
- React/TypeScript
- Waku Relay
- Waku Store

A ReactJS chat app is provided as a showcase of the library used in the browser.
It implements [Waku v2 Toy Chat](https://rfc.vac.dev/spec/22/) protocol.
A deployed version is available at https://js-waku.wakuconnect.dev/examples/web-chat/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/web-chat   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku
```

Use `/help` to see the available commands.
