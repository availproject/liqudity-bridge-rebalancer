import { initiateWormholeBridge } from "../utils/wormhole";
import {
  availAccount,
  baseClient,
  publicClient,
  walletClient,
} from "../utils/client";
import { Hex, PublicClient } from "viem";
import {
  contractReceiveAvail,
  executeMessage,
  getAccountStorageProofs,
  getExplorerURLs,
  getMerkleProof,
} from "../utils/helpers";
import {
  ExecuteMessageTypedData,
  HeadResponse,
  IChain,
  TxnReturnType,
} from "../utils/types";
import { entrypoint } from "./entrypoint";
import { AVAIL_TO_BASE } from "./avail_to_base";
import { initialize, SubmittableResult } from "avail-js-sdk";
import { BASE_TO_AVAIL } from "./base_to_avail";

import { ASSET_ID } from "./avail_to_base";
import { SlotMappingResponse } from "../legacy/avail_claim";
import { decodeAddress } from "@polkadot/keyring";
import { u8aToHex } from "@polkadot/util";

const BRIDGE_API_URL = process.env.BRIDGE_API_URL!;

async function main() {
  try {
    const api = await initialize(process.env.AVAIL_RPC);
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

    // const a = await initiateWormholeBridge(
    //   publicClient,
    //   process.env.ETH_NETWORK!,
    //   process.env.BASE_NETWORK!,
    //   BigInt(10000000000000),
    // );

    // const a = await initiateWormholeBridge(
    //   baseClient as PublicClient,
    //   process.env.BASE_NETWORK!,
    //   process.env.ETH_NETWORK!,
    //   BigInt(10000000000000),
    // );

    // const a = await AVAIL_TO_BASE(api, "1400000000000000000");
    const a = await BASE_TO_AVAIL(api, "1400000000000000000");
    console.log(a);
    // while (true) {
    //   console.log("starting to poll for proofs");

    //   const txSendBlockNumber: number = Number(9511691);

    //   const getHeadRsp = await fetch(BRIDGE_API_URL + "/eth/head");
    //   if (!getHeadRsp.ok) throw new Error("Failed to fetch chain head");
    //   const headRsp = (await getHeadRsp.json()) as HeadResponse;
    //   const slot: number = headRsp.slot;

    //   const slotMappingRsp = await fetch(
    //     BRIDGE_API_URL + "/beacon/slot/" + slot,
    //   );
    //   if (!slotMappingRsp.ok)
    //     throw new Error("Failed to fetch latest slot from beacon endpoint");
    //   const mappingResponse =
    //     (await slotMappingRsp.json()) as SlotMappingResponse;

    //   if (txSendBlockNumber < mappingResponse.blockNumber) {
    //     const proofs = await getAccountStorageProofs(
    //       mappingResponse.blockHash,
    //       Number(31923),
    //     );

    //     const availClaimData: ExecuteMessageTypedData = {
    //       accountProof: proofs.accountProof,
    //       storageProof: proofs.storageProof,
    //       slot,
    //       addrMessage: {
    //         message: {
    //           FungibleToken: {
    //             assetId: ASSET_ID,
    //             amount: "1400000000000000000",
    //           },
    //         },
    //         from: process.env.EVM_POOL_ADDRESS!.padEnd(66, "0"),
    //         to: u8aToHex(decodeAddress(process.env.AVAIL_POOL_ADDRESS)),
    //         originDomain: 2,
    //         destinationDomain: 1,
    //         id: Number(31923),
    //       },
    //     };

    //     let mintOnAvail!: TxnReturnType<SubmittableResult["status"]>;

    //     for (let i = 0; i < 3; i++) {
    //       try {
    //         mintOnAvail = await executeMessage(
    //           availAccount,
    //           api,
    //           availClaimData,
    //         );
    //         if (!mintOnAvail.status.isFinalized)
    //           throw new Error("Not finalized");
    //         console.log(
    //           "✅ Transaction included in block:",
    //           mintOnAvail.txHash,
    //         );
    //         break;
    //       } catch (error) {
    //         if (i === 2) throw error;
    //         await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    //       }
    //     }

    //     console.log("✅ Claim successful, exiting polling loop.");
    //     return {
    //       destinationExplorerLink: getExplorerURLs(
    //         IChain.AVAIL,
    //         mintOnAvail.txHash,
    //         "Txn",
    //       ),
    //     };
    //   }

    //   await new Promise((f) => setTimeout(f, 60 * 1000));
    // }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
