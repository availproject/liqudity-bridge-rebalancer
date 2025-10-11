import { Keyring } from "avail-js-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, mainnet, sepolia } from "viem/chains";

//base this out of config - turing / mainnet
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export const evmAccount = privateKeyToAccount(
  process.env.WALLET_SIGNER_KEY_ETH! as `0x${string}`,
);

export const walletClient = createWalletClient({
  account: evmAccount, // Include account here
  chain: sepolia,
  transport: http(),
});

export const baseClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export const availAccount = new Keyring({ type: "sr25519" }).addFromUri(
  process.env.AVAIL_POOL_SEED!,
);
