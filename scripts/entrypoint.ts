import { initialize } from "avail-js-sdk";
import { getTokenBalance, validateEnvVars } from "../utils/helpers";
import { availAccount, baseClient } from "../utils/client";
import { BigNumber } from "bignumber.js";
import { BASE_TO_AVAIL } from "./base_to_avail";
import { isJobRunning, markJobStarted, markJobCompleted } from "../utils/db";
import { sendNotificationChannel } from "../utils/notifier";
import { PublicClient } from "viem";
import { AVAIL_TO_BASE } from "./avail_to_base";
import { BridgingResult } from "../utils/types";

export async function entrypoint() {
  validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);

  try {
    markJobStarted();

    const api = await initialize(process.env.AVAIL_RPC);
    const THRESHOLD = new BigNumber(100000000000000);
    const GAS_THRESHOLD = new BigNumber(process.env.GAS_THRESHOLD!);
    const AMOUNT_TO_BRIDGE = process.env.AMOUNT_TO_BRIDGE!;
    const AMOUNT_TO_BRIDGE_FORMATTED = new BigNumber(AMOUNT_TO_BRIDGE)
      .dividedBy(10 ** 18)
      .toFixed(4);

    const poolBalances = await getTokenBalance(
      api,
      baseClient as PublicClient,
      availAccount.address,
    );

    if (GAS_THRESHOLD.gt(poolBalances.gasOnEvm)) {
      throw new Error(
        "Gas threshold on EVM does not match, please top up the pool account",
      );
    }

    let bridgingResult!: BridgingResult | string;
    switch (true) {
      case THRESHOLD.gt(poolBalances.availPoolBalance):
        await sendNotificationChannel({
          title: "BASE TO AVAIL REBALANCING JOB STARTING",
          details: `*Job Started:* ${new Date().toLocaleString()}
    *Reason:* Funds are low on AVAIL

    *Current Balances:*
    - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
    - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens

    *Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from BASE to AVAIL`,
          type: "info",
        });
        bridgingResult = await BASE_TO_AVAIL(
          availAccount,
          api,
          AMOUNT_TO_BRIDGE,
        );
        break;

      case THRESHOLD.gt(poolBalances.evmPoolBalance):
        await sendNotificationChannel({
          title: "AVAIL TO BASE REBALANCING JOB STARTING",
          details: `*Job Started:* ${new Date().toLocaleString()}
    *Reason:* Funds are low on BASE

    *Current Balances:*
    - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
    - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens

    *Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from AVAIL to BASE`,
          type: "info",
        });
        bridgingResult = await AVAIL_TO_BASE(
          api,
          availAccount,
          AMOUNT_TO_BRIDGE,
        );
        break;

      default:
        bridgingResult = "Balances are sufficient. No bridging required.";
    }

    await sendNotificationChannel({
      title: "Job Completed Successfully",
      details: `*Job Finished:* ${new Date().toLocaleString()}
    *Result:* ${
      typeof bridgingResult === "string"
        ? bridgingResult
        : `Bridging completed successfully

    *Explorer Links:*
    - Initiate Transaction: ${bridgingResult.initiateExplorerLink}
    - Destination Transaction: ${bridgingResult.destinationExplorerLink}`
    }`,
      type: "success",
    });
  } catch (error: any) {
    console.error("Error in job", error);
    markJobCompleted(error.message);

    await sendNotificationChannel({
      title: "Job Failed ❌",
      details: `The rebalancer job failed with error: ${error.message}`,
      type: "error",
    });

    throw error;
  } finally {
    if (isJobRunning()) {
      markJobCompleted();
    }
    process.exit(1);
  }
}

/*
impl choices-
1. we're using bigNumber.js all around, since there is no ui involved (no parsed values needed), all operations should be strictly using bignumber math.
2. try catch blocks, should only exist at the highest parent component, all pretification of logs / display should be handled here (main.ts), throw proper errors everywhere with string (about where it failed) else
3.
*/
