import { Connection } from "@libp2p/interface";
import { expect } from "chai";

import { selectOpenConnection } from "./utils.js";

describe("selectOpenConnection", () => {
  it("returns nothing if no connections present", () => {
    const connection = selectOpenConnection([]);

    expect(connection).to.be.undefined;
  });

  it("returns only open connection if one present", () => {
    let expectedCon = createMockConnection({ id: "1", status: "closed" });
    let actualCon = selectOpenConnection([expectedCon]);

    expect(actualCon).to.be.undefined;

    expectedCon = createMockConnection({ id: "1", status: "open" });
    actualCon = selectOpenConnection([expectedCon]);

    expect(actualCon).not.to.be.undefined;
    expect(actualCon?.id).to.be.eq("1");
  });

  it("should return no connections if no open connection provided", () => {
    const closedCon1 = createMockConnection({ status: "closed" });
    const closedCon2 = createMockConnection({ status: "closed" });
    const actualCon = selectOpenConnection([closedCon1, closedCon2]);

    expect(actualCon).to.be.undefined;
  });

  it("should select older connection if present", () => {
    const con1 = createMockConnection({
      status: "open",
      open: 10
    });
    const con2 = createMockConnection({
      status: "open",
      open: 15
    });

    const actualCon = selectOpenConnection([con1, con2]);

    expect(actualCon).not.to.be.undefined;
    expect(actualCon?.timeline.open).to.be.eq(15);
  });
});

type MockConnectionOptions = {
  id?: string;
  status?: string;
  open?: number;
};

function createMockConnection(options: MockConnectionOptions = {}): Connection {
  return {
    id: options.id,
    status: options.status,
    timeline: {
      open: options.open
    }
  } as Connection;
}
