import { expect } from "chai";

import { pushOrInitMapSet } from "./push_or_init_map.js";

describe("pushOrInitMapSet", () => {
  it("Init the array if not present", () => {
    const map = new Map();
    const key = "key";
    const value = "value";

    pushOrInitMapSet(map, key, value);

    expect(map.get(key)).to.deep.eq(new Set([value]));
  });

  it("Push to array if already present", () => {
    const map = new Map();
    const key = "key";
    const value1 = "value1";
    const value2 = "value2";

    pushOrInitMapSet(map, key, value1);
    pushOrInitMapSet(map, key, value2);

    expect(map.get(key)).to.deep.eq(new Set([value1, value2]));
  });
});
