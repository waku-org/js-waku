import { expect } from "chai";

import { argsToArray, defaultArgs } from "./nwaku";

describe("nwaku", () => {
  it("Correctly serialized arguments", function () {
    const args = defaultArgs();
    Object.assign(args, { portsShift: 42 });

    const actual = argsToArray(args);

    const expected = [
      "--nat=none",
      "--listen-address=127.0.0.1",
      "--relay=true",
      "--rpc=true",
      "--rpc-admin=true",
      "--websocket-support=true",
      "--ports-shift=42",
    ];

    expect(actual).to.deep.equal(expected);
  });
});
