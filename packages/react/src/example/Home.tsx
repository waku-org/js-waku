import React from "react";
import { useContext } from "react";

import { WakuContext } from "../api/context.js";

export default function Home(): JSX.Element {
  const { messages } = useContext(WakuContext);
  return (
    <div>
      <h1>Home</h1>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
    </div>
  );
}
