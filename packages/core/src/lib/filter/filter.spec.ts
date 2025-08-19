import type { Libp2p } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { FilterCodecs, FilterCore } from "./filter.js";

function mockLibp2p(unhandle: sinon.SinonStub): Libp2p {
  return {
    handle: sinon.stub().resolves(unhandle),
    components: {
      events: {
        addEventListener: sinon.stub(),
        removeEventListener: sinon.stub()
      },
      connectionManager: {
        getConnections: sinon.stub().returns([])
      }
    }
  } as unknown as Libp2p;
}

describe("FilterCore", () => {
  it("registers handler and removes on stop", async () => {
    const unhandle = sinon.stub().resolves();
    const libp2p = mockLibp2p(unhandle);

    const core = new FilterCore(async () => Promise.resolve(), libp2p);

    await core.stop();

    expect((libp2p.handle as any).calledOnceWith(FilterCodecs.PUSH)).to.be.true;
    expect(unhandle.calledOnce).to.be.true;
  });
});
