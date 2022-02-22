# Minimal Angular (v13) Waku Relay App

**Demonstrates**:

- Group messaging
- Angular/JavaScript
- Waku Relay
- Protobuf using `protons`
- No async/await syntax

A barebones messaging app to illustrate the [Angular Relay guide](https://docs.wakuconnect.dev/docs/guides/10_angular_relay/).

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/relay-reactjs-chat
yarn   # Install dependencies for the web app
yarn start # Start development server to serve the web app on http://localhost:4200/
```

### Known issues

There is a problem when using `npm` to install/run the Angular app.
