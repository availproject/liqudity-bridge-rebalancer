import { initiateWormholeBridge } from "../utils/wormhole";
import { baseClient, publicClient, walletClient } from "../utils/client";
import { Hex, PublicClient } from "viem";
import {
  contractReceiveAvail,
  getExplorerURLs,
  getMerkleProof,
} from "../utils/helpers";
import { HeadResponse, IChain } from "../utils/types";
import { entrypoint } from "./entrypoint";

async function main() {
  try {
    // while (true) {
    //   const headRsp = await fetch(process.env.BRIDGE_API_URL + "/avl/head");
    //   if (!headRsp.ok) throw new Error("Failed to fetch chain head");
    //   const head = (await headRsp.json()) as HeadResponse;
    //   const lastCommittedBlock = head.data.end;
    //   let lastTransactionHash;
    //   let hasReceivedAvail;

    //   const proof = await getMerkleProof(
    //     "0x1119140d887b41284dcfa50001d0ec536bc5a56c41ed5029d59b9d637184dfed",
    //     1,
    //   );

    //   console.log("✅ Proof fetched successfully", proof);

    //   for (let i = 0; i < 30; i++) {
    //     try {
    //       const result = await contractReceiveAvail(
    //         walletClient,
    //         publicClient,
    //         proof,
    //       );
    //       if (result.status !== "success")
    //         throw new Error("Transaction failed");
    //       console.log(`✅ AVAIL received`);
    //       console.log(
    //         `🔗 View on Etherscan: ${getExplorerURLs(IChain.ETH, result.txHash, "Txn")}`,
    //       );
    //       lastTransactionHash = result.txHash as Hex;
    //       hasReceivedAvail = true;
    //       break;
    //     } catch (error: any) {
    //       if (i === 29) throw new Error("Failed to claim after 30 attempts");
    //       console.log(
    //         `❌ Claim attempt ${i + 1}/30 failed, retrying...`,
    //         error.message,
    //       );
    //       await new Promise((r) => setTimeout(r, 10 * 60 * 1000));
    //     }
    //   }

    //   if (hasReceivedAvail) {
    //     const wormholeTxnIds = await initiateWormholeBridge(
    //       publicClient,
    //       process.env.ETH_NETWORK!,
    //       process.env.BASE_NETWORK!,
    //     );
    //     console.log(
    //       "✅ bridged to wormhole successfully, flow done",
    //       wormholeTxnIds,
    //     );
    //     break;
    //   }

    //   console.log(
    //     `⏳ Waiting for bridge commitment on ethereum (${lastCommittedBlock}/})...`,
    //   );
    //   await new Promise((r) => setTimeout(r, 60 * 1000));
    // }
    // await entrypoint();

    const a = await initiateWormholeBridge(
      publicClient,
      process.env.ETH_NETWORK!,
      process.env.BASE_NETWORK!,
      BigInt(10000000000000),
    );

    // const a = await initiateWormholeBridge(
    //   baseClient as PublicClient,
    //   process.env.BASE_NETWORK!,
    //   process.env.ETH_NETWORK!,
    //   BigInt(10000000000000),
    // );

    console.log(a);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
