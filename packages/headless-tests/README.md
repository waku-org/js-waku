# Waku Headless Tests

This package contains a minimal browser application used for testing the Waku SDK in a browser environment. It is used by the browser-tests package to run end-to-end tests on the SDK.

## Usage

### Build the app

```bash
npm run build
```

### Start the app

```bash
npm start
```

This will start a server on port 8080 by default.

## Integration with browser-tests

This package is designed to be used with the browser-tests package to run end-to-end tests on the SDK. It exposes the Waku API via a global object in the browser. 
