# Minimal ReactJS Waku Relay App

**Demonstrates**:

- Group chat
- React/JavaScript
- `create-react-app`/`react-scripts` 5.0.0
- Waku Relay
- Protobuf using `protons`.
- No async/await syntax.

A barebone chat app to illustrate the [ReactJS Relay guide](https://docs.wakuconnect.dev/docs/guides/07_reactjs_relay/).

The `master` branch's HEAD is deployed at https://js-waku.wakuconnect.dev/examples/relay-reactjs-chat/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/relay-reactjs-chat
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/
```
