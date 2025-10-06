import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, mainnet, sepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

export const walletClient = createWalletClient({
  account, // Include account here
  chain: sepolia,
  transport: http(),
});

export const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});
