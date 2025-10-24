import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { PublicClient } from "viem";

import { RLNBaseContract } from "./rln_base_contract.js";

use(chaiAsPromised);

function createMockRLNBaseContract(
  mockContract: any,
  mockPublicClient: PublicClient
): RLNBaseContract {
  const dummy = Object.create(RLNBaseContract.prototype);
  dummy.contract = mockContract;
  dummy.publicClient = mockPublicClient;
  return dummy as RLNBaseContract;
}

describe("RLNBaseContract.getPriceForRateLimit (unit)", function () {
  let mockContract: any;
  let mockPublicClient: any;
  let priceCalculatorReadStub: sinon.SinonStub;
  let readContractStub: sinon.SinonStub;

  beforeEach(() => {
    priceCalculatorReadStub = sinon.stub();
    readContractStub = sinon.stub();

    mockContract = {
      read: {
        priceCalculator: priceCalculatorReadStub
      }
    };

    mockPublicClient = {
      readContract: readContractStub
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns token and price for valid calculate", async () => {
    const fakeToken = "0x1234567890abcdef1234567890abcdef12345678";
    const fakePrice = 42n;
    const priceCalculatorAddress = "0xabcdef1234567890abcdef1234567890abcdef12";

    priceCalculatorReadStub.resolves(priceCalculatorAddress);
    readContractStub.resolves([fakeToken, fakePrice]);

    const rlnBase = createMockRLNBaseContract(mockContract, mockPublicClient);
    const result = await rlnBase.getPriceForRateLimit(20);

    expect(result.token).to.equal(fakeToken);
    expect(result.price).to.equal(fakePrice);
    expect(priceCalculatorReadStub.calledOnce).to.be.true;
    expect(readContractStub.calledOnce).to.be.true;

    const readContractCall = readContractStub.getCall(0);
    expect(readContractCall.args[0]).to.deep.include({
      address: priceCalculatorAddress,
      functionName: "calculate",
      args: [20]
    });
  });

  it("throws if calculate throws", async () => {
    const priceCalculatorAddress = "0xabcdef1234567890abcdef1234567890abcdef12";

    priceCalculatorReadStub.resolves(priceCalculatorAddress);
    readContractStub.rejects(new Error("fail"));

    const rlnBase = createMockRLNBaseContract(mockContract, mockPublicClient);
    await expect(rlnBase.getPriceForRateLimit(20)).to.be.rejectedWith("fail");

    expect(priceCalculatorReadStub.calledOnce).to.be.true;
    expect(readContractStub.calledOnce).to.be.true;
  });

  it("returns null values if calculate returns malformed data", async () => {
    const priceCalculatorAddress = "0xabcdef1234567890abcdef1234567890abcdef12";

    priceCalculatorReadStub.resolves(priceCalculatorAddress);
    readContractStub.resolves([null, null]);

    const rlnBase = createMockRLNBaseContract(mockContract, mockPublicClient);
    const result = await rlnBase.getPriceForRateLimit(20);

    expect(result.token).to.be.null;
    expect(result.price).to.be.null;
    expect(priceCalculatorReadStub.calledOnce).to.be.true;
    expect(readContractStub.calledOnce).to.be.true;
  });
});
