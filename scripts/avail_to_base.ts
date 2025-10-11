import {
  checkTransactionStatus,
  contractReceiveAvail,
  getMerkleProof,
  sendMessage,
} from "../utils/helpers";
import {
  HeadResponse,
  SendMessageTypedData,
  TxnReturnType,
} from "../utils/types";
import jsonbigint from "json-bigint";
import { ApiPromise, KeyringPair, SubmittableResult } from "avail-js-sdk";
import { publicClient, walletClient } from "../utils/client";
import { initiateWormholeBridge } from "../utils/wormhole";
import { Hex } from "viem";

const JSONBigInt = jsonbigint({ useNativeBigInt: true });

const BRIDGE_API_URL = process.env.BRIDGE_API_URL!;
export const ASSET_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

let hasReceivedAvail = false;
let lastTransactionHash: Hex;

export async function AVAIL_TO_BASE(
  api: ApiPromise,
  account: KeyringPair,
  amount: string,
) {
  const data: SendMessageTypedData = {
    destinationDomain: 2,
    message: {
      FungibleToken: {
        amount: amount,
        assetId: ASSET_ID,
      },
    },
    to: process.env.ETH_HOT_WALLET_ADDY!,
  };

  let burnOnAvail!: TxnReturnType<SubmittableResult["status"]>;

  for (let i = 0; i < 3; i++) {
    try {
      burnOnAvail = await sendMessage(account, api, data);
      if (!burnOnAvail.status.isFinalized) throw new Error("Not finalized");
      console.log("✅ Transaction included in block:", burnOnAvail.txHash);
      break;
    } catch (error) {
      if (i === 2) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }

  const getBlockData = await checkTransactionStatus(
    api,
    burnOnAvail.txHash,
    "subscribeFinalizedHeads",
    6000000,
  );

  console.log("✅ Transaction included in block:", getBlockData.blockHash);
  console.log("✅ Transaction index:", getBlockData.txIndex);

  console.log("checking commitments on ethereum for claim");
  while (true) {
    try {
      const headRsp = await fetch(BRIDGE_API_URL + "/avl/head");
      if (!headRsp.ok) throw new Error("Failed to fetch chain head");

      const head = (await headRsp.json()) as HeadResponse;
      const lastCommittedBlock = head.data.end;

      if (!hasReceivedAvail && lastCommittedBlock >= getBlockData.blockNumber) {
        const proof = await getMerkleProof(
          getBlockData.blockHash,
          getBlockData.txIndex,
        );
        console.log("✅ Proof fetched successfully");

        for (let i = 0; i < 30; i++) {
          try {
            const result = await contractReceiveAvail(
              walletClient,
              publicClient,
              proof,
            );

            if (result.status !== "success")
              throw new Error("Transaction failed");

            const network = process.env.CONFIG === "Mainnet" ? "" : "sepolia.";
            console.log(`✅ AVAIL received`);
            console.log(
              `🔗 View on Etherscan: https://${network}etherscan.io/tx/${result.txHash}`,
            );

            lastTransactionHash = result.txHash as Hex;
            hasReceivedAvail = true;
            break;
          } catch (error) {
            if (i === 29) throw new Error("Failed to claim after 30 attempts");
            console.log(`❌ Claim attempt ${i + 1}/30 failed, retrying...`);
            await new Promise((r) => setTimeout(r, 10 * 60 * 1000));
          }
        }
      }

      if (hasReceivedAvail) {
        const wormholeTxnIds = await initiateWormholeBridge(
          publicClient,
          "Ethereum",
          "Base",
        );

        console.log(
          "✅ bridged to wormhole successfully, flow done",
          wormholeTxnIds,
        );
      }

      console.log(
        `⏳ Waiting for bridge commitment on ethereum (${lastCommittedBlock}/${getBlockData.blockNumber})...`,
      );
      await new Promise((r) => setTimeout(r, 60 * 1000));
    } catch (error) {
      console.error("❌ Error:", error);
      process.exit(1);
    }
  }
}
