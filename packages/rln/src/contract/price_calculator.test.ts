import { expect } from "chai";
import { ethers } from "ethers";

import { RLNBaseContract } from "./rln_base_contract.js";

function createRealRLNBaseContract(
  provider: ethers.providers.Provider
): RLNBaseContract {
  const dummy = Object.create(RLNBaseContract.prototype);
  dummy.contract = { provider };
  return dummy as RLNBaseContract;
}

describe("RLNBaseContract.getPriceForRateLimit (integration)", function () {
  this.timeout(10000);

  const rpcUrl = "https://rpc.sepolia.linea.build";
  let provider: ethers.providers.JsonRpcProvider;

  before(() => {
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  });

  const rateLimits = [20, 200, 600];

  rateLimits.forEach((rateLimit) => {
    it(`returns token and price for rateLimit=${rateLimit}`, async () => {
      const rlnBase = createRealRLNBaseContract(provider);
      const result = await rlnBase.getPriceForRateLimit(rateLimit);
      expect(result.token).to.be.a("string");
      expect(result.token.length).to.equal(42); // address length
      expect(result.price).to.be.instanceOf(ethers.BigNumber);
      expect(result.price.gt(0)).to.be.true;
    });
  });
});
