import { initialize } from "avail-js-sdk";
import { getTokenBalance, validateEnvVars } from "../utils/helpers";
import { availAccount, baseClient } from "../utils/client";
import { BigNumber } from "bignumber.js";
import { BASE_TO_AVAIL } from "./base_to_avail";
import { isJobRunning, markJobStarted, markJobCompleted } from "../utils/db";
import { sendNotificationChannel } from "../utils/notifier";
import { PublicClient } from "viem";
import { AVAIL_TO_BASE } from "./avail_to_base";

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

    switch (true) {
      case THRESHOLD.gt(poolBalances.evmPoolBalance):
        await sendNotificationChannel({
          title: "AVAIL TO BASE REBALANCING JOB STARTING",
          details: `*Job Started:* ${new Date().toLocaleDateString()}
    *Reason:* Funds are low on BASE

    *Current Balances:*
    - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
    - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens

    *Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from AVAIL to BASE`,
          type: "info",
        });
        await AVAIL_TO_BASE(api, availAccount, AMOUNT_TO_BRIDGE);
        break;

      case THRESHOLD.gt(poolBalances.availPoolBalance):
        await sendNotificationChannel({
          title: "BASE TO AVAIL REBALANCING JOB STARTING",
          details: `*Job Started:* ${new Date().toLocaleDateString()}
    *Reason:* Funds are low on AVAIL

    *Current Balances:*
    - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
    - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens

    *Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from BASE to AVAIL`,
          type: "info",
        });
        await BASE_TO_AVAIL(availAccount, api, AMOUNT_TO_BRIDGE);
        break;

      default:
        console.log("Balances are sufficient. No bridging required.");
    }

    //ideally wait for those wormhole txns as well and return this object {initiateTxn, claimTxn, TimeTaken}
    await sendNotificationChannel({
      title: "Job Completed Successfully ",
      details: `The rebalancer job finished at ${new Date().toISOString()}. `,
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
  }
}

/*
impl choices-
1. we're using bigNumber.js all around, since there is no ui involved (no parsed values needed), all operations should be strictly using bignumber math.
2. try catch blocks, should only exist at the highest parent component, all pretification of logs / display should be handled here (main.ts), throw proper errors everywhere with string (about where it failed) else
3.
*/
