import { expect } from "chai";

import { argsToArray, bytesToHex, defaultArgs, strToHex } from "./nwaku.js";

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

  it("Convert utf-8 string to hex", function () {
    const str = "This is an utf-8 string.";
    const expected = "5468697320697320616e207574662d3820737472696e672e";

    const actual = strToHex(str);
    expect(actual).deep.equal(expected);
  });

  it("Convert buffer to hex", function () {
    const buf = Uint8Array.from([
      0x54, 0x68, 0x69, 0x73, 0x20, 0x69, 0x73, 0x20, 0x61, 0x6e, 0x20, 0x75,
      0x74, 0x66, 0x2d, 0x38, 0x20, 0x73, 0x74, 0x72, 0x69, 0x6e, 0x67, 0x2e,
    ]);
    const expected = "5468697320697320616e207574662d3820737472696e672e";

    const actual = bytesToHex(buf);
    expect(actual).to.deep.equal(expected);
  });
});
