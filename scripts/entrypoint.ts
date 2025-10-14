import { initialize } from "avail-js-sdk";
import { getTokenBalance, validateEnvVars } from "../utils/helpers";
import { availAccount, publicClient } from "../utils/client";
import { BigNumber } from "bignumber.js";
import { BASE_TO_AVAIL } from "./base_to_avail";
import { isJobRunning, markJobStarted, markJobCompleted } from "../utils/db";
import { sendNotificationChannel } from "../utils/notifier";

export async function entrypoint() {
  validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);

  try {
    await sendNotificationChannel({
      title: "Job Started",
      details: `The rebalancer job has started at ${new Date().toISOString()}.`,
      type: "info",
    });
  } catch (notifyErr) {
    console.log("Failed to send start notification!", notifyErr);
    throw notifyErr;
  }

  try {
    markJobStarted();

    const api = await initialize(process.env.AVAIL_RPC);
    const THRESHOLD = new BigNumber(100000);
    const GAS_THRESHOLD = new BigNumber(10000);
    const AMOUNT_TO_BRIDGE = "10000000000000"; // atomic amount

    const poolBalances = await getTokenBalance(
      api,
      publicClient,
      availAccount.address,
    );

    if (GAS_THRESHOLD.gt(poolBalances.gasOnEvm)) {
      throw new Error(
        "Gas threshold on EVM does not match, please top up the pool account",
      );
    }

    switch (true) {
      case THRESHOLD.gt(poolBalances.evmPoolBalance):
        console.log("Funds to base needed");
        await BASE_TO_AVAIL(availAccount, api, AMOUNT_TO_BRIDGE);
        break;
      case THRESHOLD.gt(poolBalances.availPoolBalance):
        console.log("Funds to avail needed");
        await BASE_TO_AVAIL(availAccount, api, AMOUNT_TO_BRIDGE);
        break;
      default:
        console.log("Balances are sufficient. No bridging required.");
    }

    //ideally wait for those wormhole txns as well and return this object {initiateTxn, claimTxn, TimeTaken}
    await sendNotificationChannel({
      title: "Job Completed Successfully ",
      details:
        "The rebalancer job finished at ${new Date().toISOString()}. ${bridgingResult",
      type: "info",
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
