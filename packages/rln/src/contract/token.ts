import { type Address, formatUnits, PublicClient, WalletClient } from "viem";

/**
 * Minimal ERC20 ABI containing only the functions we need
 */
export const erc20Abi = [
  {
    type: "function",
    inputs: [{ name: "account", internalType: "address", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", internalType: "uint8", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view"
  }
] as const;

export interface TokenBalance {
  /** Raw balance as bigint */
  raw: bigint;
  /** Formatted balance as string (e.g., "100.5") */
  formatted: string;
  /** Token decimals */
  decimals: number;
  /** Token symbol (if available) */
  symbol?: string;
  /** User's wallet address */
  userAddress: Address;
}

/**
 * Gets the token balance for the connected wallet
 * @param walletClient The viem wallet client with a connected account
 * @param publicClient The viem public client for reading contract state
 * @param tokenAddress The ERC20 token contract address
 * @returns Promise<TokenBalance> The token balance information
 * @throws Error if no account is connected to the wallet client
 *
 * @example
 * ```typescript
 * const { walletClient, publicClient } = await createViemClientsFromWindow();
 * const balance = await getTokenBalance(walletClient, publicClient, "0x...");
 * console.log(`Balance: ${balance.formatted} ${balance.symbol}`);
 * ```
 */
export async function getTokenBalance(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<TokenBalance> {
  if (!walletClient.account) {
    throw new Error("No account connected to wallet client");
  }

  const userAddress = walletClient.account.address;

  // Read balance, decimals, and symbol in parallel
  const [balance, decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    }),
    publicClient
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol"
      })
      .catch(() => undefined) // Symbol is optional, some tokens don't have it
  ]);

  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
    decimals,
    symbol,
    userAddress
  };
}
