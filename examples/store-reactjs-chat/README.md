# Minimal ReactJS Waku Store App

- React/JavaScript,
- Waku Store,
- Protobuf using `protons`.

A simple app that retrieves chat messages using [Waku Store](https://rfc.vac.dev/spec/13/)
to illustrate the [Retrieve Messages Using Waku Store With ReactJS guide](/guides/reactjs-store.md).

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/store-reactjs-chat
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/
```
