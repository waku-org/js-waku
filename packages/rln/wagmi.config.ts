import { defineConfig } from "@wagmi/cli";
import { actions } from "@wagmi/cli/plugins";
import type { Abi } from "viem";

import {
  PRICE_CALCULATOR_CONTRACT,
  RLN_CONTRACT
} from "./src/contract/constants.js";

export default defineConfig({
  out: "src/generated/wagmi.ts",
  contracts: [
    {
      name: "RLN",
      address: {
        [RLN_CONTRACT.chainId]: RLN_CONTRACT.address as `0x${string}`
      },
      abi: RLN_CONTRACT.abi as Abi
    },
    {
      name: "PriceCalculator",
      address: {
        [PRICE_CALCULATOR_CONTRACT.chainId]:
          PRICE_CALCULATOR_CONTRACT.address as `0x${string}`
      },
      abi: PRICE_CALCULATOR_CONTRACT.abi as Abi
    }
  ],
  plugins: [actions({})]
});
