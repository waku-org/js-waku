# Minimal ReactJS Waku Store App

- React/JavaScript,
- `create-react-app`/`react-scripts` 5.0.0
- Waku Store,
- Protobuf using `protons`.
- No async/await syntax.

A simple app that retrieves chat messages using [Waku Store](https://rfc.vac.dev/spec/13/)
to illustrate the [Retrieve Messages Using Waku Store With ReactJS guide](https://docs.wakuconnect.dev/docs/guides/08_reactjs_store/).

The `master` branch's HEAD is deployed at https://js-waku.wakuconnect.dev/examples/store-reactjs-chat/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/store-reactjs-chat
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/
```
