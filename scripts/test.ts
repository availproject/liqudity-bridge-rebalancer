import { initiateWormholeBridge } from "../utils/wormhole";
import { publicClient, walletClient } from "../utils/client";
import { Hex, PublicClient } from "viem";
import { entrypoint } from "./entrypoint";
import { sendNotificationChannel } from "../utils/notifier";
import {
  contractAvailSend,
  contractReceiveAvail,
  getExplorerURLs,
  getMerkleProof,
} from "../utils/helpers";
import { HeadResponse, IChain } from "../utils/types";

async function main() {
  try {
    while (true) {
      const headRsp = await fetch(process.env.BRIDGE_API_URL + "/avl/head");
      if (!headRsp.ok) throw new Error("Failed to fetch chain head");
      const head = (await headRsp.json()) as HeadResponse;
      const lastCommittedBlock = head.data.end;
      let lastTransactionHash;
      let hasReceivedAvail;

      const proof = await getMerkleProof(
        "0x03f9577f3897f7d65bf194289bd93668e023f02718c98306ef909b2706643558",
        1,
      );

      console.log("✅ Proof fetched successfully", proof);

      for (let i = 0; i < 30; i++) {
        try {
          const result = await contractReceiveAvail(
            walletClient,
            publicClient,
            proof,
          );
          if (result.status !== "success")
            throw new Error("Transaction failed");
          console.log(`✅ AVAIL received`);
          console.log(
            `🔗 View on Etherscan: ${getExplorerURLs(IChain.ETH, result.txHash, "Txn")}`,
          );
          lastTransactionHash = result.txHash as Hex;
          hasReceivedAvail = true;
          break;
        } catch (error: any) {
          if (i === 29) throw new Error("Failed to claim after 30 attempts");
          console.log(
            `❌ Claim attempt ${i + 1}/30 failed, retrying...`,
            error.message,
          );
          await new Promise((r) => setTimeout(r, 10 * 60 * 1000));
        }
      }

      if (hasReceivedAvail) {
        const wormholeTxnIds = await initiateWormholeBridge(
          publicClient,
          process.env.ETH_NETWORK!,
          process.env.BASE_NETWORK!,
        );
        console.log(
          "✅ bridged to wormhole successfully, flow done",
          wormholeTxnIds,
        );
        break;
      }

      console.log(
        `⏳ Waiting for bridge commitment on ethereum (${lastCommittedBlock}/})...`,
      );
      await new Promise((r) => setTimeout(r, 60 * 1000));
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
