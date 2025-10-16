import {
  TransactionId,
  Wormhole,
  signSendWait,
  Chain,
  ChainAddress,
  ChainContext,
  Network,
  Signer,
  chainToPlatform,
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";
import "@wormhole-foundation/sdk-evm-ntt";
import { formatUnits, Hex, parseUnits, PublicClient } from "viem";
import { balanceOfAbi } from "./abi";
import { TxnReturnType } from "./types";

export const UPDATED_NTT_TOKENS = {
  [process.env.BASE_NETWORK!]: {
    token: process.env.AVAIL_TOKEN_BASE!,
    manager: process.env.MANAGER_ADDRESS_BASE!,
    transceiver: {
      wormhole: process.env.WORMHOLE_TRANSCEIVER_BASE!,
    },
  },
  [process.env.ETH_NETWORK!]: {
    token: process.env.AVAIL_TOKEN_ETH!,
    manager: process.env.MANAGER_ADDRESS_ETH!,
    transceiver: {
      wormhole: process.env.WORMHOLE_TRANSCEIVER_ETH!,
    },
  },
};

export interface SignerStuff<N extends Network, C extends Chain> {
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}

export async function getSigner<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>,
): Promise<SignerStuff<N, C>> {
  let signer: Signer;
  const platform = chainToPlatform(chain.chain);
  switch (platform) {
    case "Evm":
      signer = await evm.getSigner(
        await chain.getRpc(),
        process.env.EVM_POOL_SEED!,
      );
      break;
    default:
      throw new Error("Unrecognized platform: " + platform);
  }

  return {
    chain,
    signer: signer as Signer<N, C>,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}

export async function initiateWormholeBridge(
  publicClient: PublicClient,
  srcChain: string,
  dstChain: string,
): Promise<TxnReturnType> {
  const wh = new Wormhole(
    process.env.CONFIG! as "Mainnet" | "Testnet" | "Devnet",
    [evm.Platform],
    {
      chains: {
        [process.env.BASE_NETWORK!]: {
          rpc: process.env.BASE_RPC_URL,
        },
        [process.env.ETH_NETWORK!]: {
          rpc: process.env.ETH_RPC_URL,
        },
      },
    },
  );

  const src = wh.getChain(
    srcChain as "BaseSepolia" | "Sepolia" | "Base" | "Ethereum",
  );
  const dst = wh.getChain(
    dstChain as "BaseSepolia" | "Sepolia" | "Base" | "Ethereum",
  );

  const srcSigner = await getSigner(src);
  const dstSigner = await getSigner(dst);

  const srcNtt = await src.getProtocol("Ntt", {
    ntt: UPDATED_NTT_TOKENS[src.chain],
  });

  const balance = await publicClient.readContract({
    address: UPDATED_NTT_TOKENS[src.chain]!.token as Hex,
    abi: balanceOfAbi,
    functionName: "balanceOf",
    args: [srcSigner.address.address.toString() as Hex],
  });

  console.log(
    `💰 Current AVAIL balance on source ${srcChain}: ${formatUnits(balance, await srcNtt.getTokenDecimals())}`,
  );

  if (balance === 0n) throw new Error("No AVAIL tokens to bridge");
  const ethBalance = await publicClient.getBalance({
    address: srcSigner.address.address.toString() as Hex,
  });

  let txnIds!: TransactionId[];

  for (let i = 0; i < 3; i++) {
    try {
      const minEthRequired = parseUnits("0.001", 18);
      if (ethBalance < minEthRequired) {
        throw new Error(
          `Insufficient ETH for gas. Required: 0.001 ETH, Current: ${formatUnits(ethBalance, 18)} ETH`,
        );
      }

      console.log("🔄 Initiating bridge to Base...");

      const xfer = () =>
        srcNtt.transfer(srcSigner.address.address, balance, dstSigner.address, {
          queue: false,
          automatic: true,
        });

      const _txids: TransactionId[] = await signSendWait(
        src,
        xfer(),
        srcSigner.signer,
      );
      txnIds = _txids;
      break;
    } catch (e: any) {
      console.log("TRY NO", i + 1, "failed due to --", e.message);
      if (i === 2)
        throw new Error(
          `retries exhausted while sending wormhole txn ${e.message}`,
        );
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }

  console.log("✅ Bridge transaction initiated");
  console.log(
    `🔗 View on wormholescan: https://wormholescan.io/#/tx/${txnIds[1]?.txid ?? txnIds[0].txid}?network=Testnet`,
  );

  if (!txnIds) {
    throw new Error("No Txn ids available something went wrong here");
  }

  return {
    txHash: txnIds[1]?.txid ?? txnIds[0].txid,
    status: "initiated",
  };
}
