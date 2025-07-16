import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "ethers";
import sinon from "sinon";

import { RLNBaseContract } from "./rln_base_contract.js";

use(chaiAsPromised);

function createMockRLNBaseContract(provider: any): RLNBaseContract {
  const dummy = Object.create(RLNBaseContract.prototype);
  dummy.contract = { provider };
  return dummy as RLNBaseContract;
}

describe("RLNBaseContract.getPriceForRateLimit (unit)", function () {
  let provider: any;
  let calculateStub: sinon.SinonStub;
  let mockContractFactory: any;

  beforeEach(() => {
    provider = {};
    calculateStub = sinon.stub();
    mockContractFactory = function () {
      return { calculate: calculateStub };
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns token and price for valid calculate", async () => {
    const fakeToken = "0x1234567890abcdef1234567890abcdef12345678";
    const fakePrice = ethers.BigNumber.from(42);
    calculateStub.resolves([fakeToken, fakePrice]);

    const rlnBase = createMockRLNBaseContract(provider);
    const result = await rlnBase.getPriceForRateLimit(20, mockContractFactory);
    expect(result.token).to.equal(fakeToken);
    expect(result.price).to.not.be.null;
    if (result.price) {
      expect(result.price.eq(fakePrice)).to.be.true;
    }
    expect(calculateStub.calledOnceWith(20)).to.be.true;
  });

  it("throws if calculate throws", async () => {
    calculateStub.rejects(new Error("fail"));

    const rlnBase = createMockRLNBaseContract(provider);
    await expect(
      rlnBase.getPriceForRateLimit(20, mockContractFactory)
    ).to.be.rejectedWith("fail");
    expect(calculateStub.calledOnceWith(20)).to.be.true;
  });

  it("throws if calculate returns malformed data", async () => {
    calculateStub.resolves([null, null]);

    const rlnBase = createMockRLNBaseContract(provider);
    const result = await rlnBase.getPriceForRateLimit(20, mockContractFactory);
    expect(result.token).to.be.null;
    expect(result.price).to.be.null;
  });
});
