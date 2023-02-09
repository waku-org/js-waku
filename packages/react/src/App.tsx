import React from "react";

import { Provider } from "./api/index.js";
import Home from "./example/Home.js";
import "./App.css";

function App(): JSX.Element {
  return (
    <Provider
      encoderDecoderOptions={{ contentTopic: "/toy-chat/2/huilong/proto" }}
    >
      <Home />
    </Provider>
  );
}

export default App;
