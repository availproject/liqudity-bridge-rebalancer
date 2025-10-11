import { Keyring } from "avail-js-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, mainnet, sepolia } from "viem/chains";

//read based clients
export const publicClient = createPublicClient({
  chain: process.env.CONFIG === "Mainnet" ? mainnet : sepolia,
  transport: http(),
});

export const baseClient = createPublicClient({
  chain: process.env.CONFIG === "Mainnet" ? mainnet : baseSepolia,
  transport: http(),
});

//write based clients
export const evmAccount = privateKeyToAccount(
  process.env.ETH_POOL_SEED! as `0x${string}`,
);

export const walletClient = createWalletClient({
  account: evmAccount, // Include account here
  chain: process.env.CONFIG === "Mainnet" ? mainnet : sepolia,
  transport: http(),
});

export const availAccount = new Keyring({ type: "sr25519" }).addFromUri(
  process.env.AVAIL_POOL_SEED!,
);
