import { Hex, PublicClient } from "viem";
import { baseClient, publicClient, walletClient } from "../utils/client";
import { initiateWormholeBridge } from "../utils/wormhole";
import {
  contractAvailSend,
  executeMessage,
  getAccountStorageProofs,
  getTokenBalance,
} from "../utils/helpers";
import { availTokenAbi } from "../utils/abi";
import { BigNumber } from "bignumber.js";
import {
  ContractAvailSendTypedData,
  ExecuteMessageTypedData,
  HeadResponse,
  TxnReturnType,
} from "../utils/types";
import { SlotMappingResponse } from "../legacy/avail_claim";
import { decodeAddress } from "@polkadot/keyring";
import { u8aToHex } from "@polkadot/util";
import { ApiPromise, KeyringPair, SubmittableResult } from "avail-js-sdk";
import { ASSET_ID } from "./avail_to_base";

const BRIDGE_API_URL = process.env.BRIDGE_API_URL!;

/**
 * 1. start with wormhole (move funds from base to eth)
 * 2. check funds reaching ethereum, 18-20 mins wait, then you actually start on ethereum
 * 3. on ethereum, start by sendavail, check finalisation and such
 * 4. wait 2 hours
 * 5. fetch avl/proof (Account / Storage proof) - you need amount from above
 * 6. vector.execute
 *
 */
export async function BASE_TO_AVAIL(
  account: KeyringPair,
  api: ApiPromise,
  amount: string,
) {
  await initiateWormholeBridge(baseClient as PublicClient, "Base", "Ethereum");

  await new Promise((resolve) => {
    setTimeout(resolve, 1000 * 60 * 20);
  });

  const evmPoolBalance = await publicClient.readContract({
    address: process.env.AVAIL_TOKEN_ETH as Hex,
    abi: availTokenAbi,
    functionName: "balanceOf",
    args: [process.env.ETH_POOL_ADDRESS as Hex],
  });

  if (
    new BigNumber(evmPoolBalance).isLessThanOrEqualTo(new BigNumber(amount))
  ) {
    throw new Error(
      "evm pool balance has no erc20 avail to be bridged, did the wormhole bridge work? ",
    );
  }

  const sendToAvailParams: ContractAvailSendTypedData = {
    substrateAddressDestination: process.env.AVAIL_POOL_ADDRESS!,
    atomicAmount: amount,
  };

  let availSendReturn!: TxnReturnType;
  for (let i = 0; i > 3; i++) {
    try {
      const sendToAvail = await contractAvailSend(
        walletClient,
        sendToAvailParams,
      );
      availSendReturn === sendToAvail;
      break;
    } catch (e: any) {
      if (i === 2)
        throw new Error(
          `max no of retries reached while calling contract sendAvail ${e.message}`,
        );
    }
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 1000 * 60 * 60);
  });

  while (true) {
    try {
      let txSendBlockNumber: number = Number(process.env.BLOCK_NUMBER);

      let getHeadRsp = await fetch(BRIDGE_API_URL + "/eth/head");
      if (!getHeadRsp.ok) throw new Error("Failed to fetch chain head");
      let headRsp = (await getHeadRsp.json()) as HeadResponse;
      let slot: number = headRsp.slot;

      let slotMappingRsp = await fetch(BRIDGE_API_URL + "/beacon/slot/" + slot);
      if (!slotMappingRsp.ok)
        throw new Error("Failed to fetch latest slot from beacon endpoint");
      let mappingResponse =
        (await slotMappingRsp.json()) as SlotMappingResponse;

      //we'll check now if the latest commitment is updated on ethereum
      if (txSendBlockNumber < mappingResponse.blockNumber) {
        const proofs = await getAccountStorageProofs(
          mappingResponse.blockHash,
          Number(availSendReturn.event?.messageId),
        );

        const availClaimData: ExecuteMessageTypedData = {
          accountProof: proofs.accountProof,
          storageProof: proofs.storageProof,
          slot,
          addrMessage: {
            message: {
              FungibleToken: {
                assetId: ASSET_ID,
                amount,
              },
            },
            from: process.env.ETH_POOL_ADDRESS!.padEnd(66, "0"),
            to: u8aToHex(decodeAddress(process.env.AVAIL_POOL_ADDRESS)),
            originDomain: 2,
            destinationDomain: 1,
            id: Number(availSendReturn.event?.messageId),
          },
        };

        let mintOnAvail!: TxnReturnType<SubmittableResult["status"]>;

        for (let i = 0; i < 3; i++) {
          try {
            mintOnAvail = await executeMessage(account, api, availClaimData);
            if (!mintOnAvail.status.isFinalized)
              throw new Error("Not finalized");
            console.log(
              "✅ Transaction included in block:",
              mintOnAvail.txHash,
            );
            break;
          } catch (error) {
            if (i === 2) throw error;
            await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
          }
        }

        //explorer link here and do get token balance to verify it all
      }

      await new Promise((f) => setTimeout(f, 60 * 1000));
    } catch (e) {}
  }
}
