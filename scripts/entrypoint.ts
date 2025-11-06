import { disconnect, initialize } from "avail-js-sdk";
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
    const THRESHOLD = new BigNumber(process.env.THRESHOLD!);
    const GAS_THRESHOLD = new BigNumber(process.env.GAS_THRESHOLD!);
    const AMOUNT_TO_BRIDGE = process.env.AMOUNT_TO_BRIDGE!;
    const AMOUNT_TO_BRIDGE_FORMATTED = new BigNumber(AMOUNT_TO_BRIDGE)
      .dividedBy(10 ** 18)!
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
      case THRESHOLD.gt(poolBalances.evmPoolBalance):
        await sendNotificationChannel({
          title: `[${process.env.CONFIG}] Avail to Base rebalancing starting`,
          details: `*Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from AVAIL to BASE
  *Reason:* Funds are low on BASE
  *Current Balances:*
  - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
  - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens`,
          type: "info",
        });
        bridgingResult = await AVAIL_TO_BASE(api, AMOUNT_TO_BRIDGE);
        break;
      case THRESHOLD.gt(poolBalances.availPoolBalance):
        await sendNotificationChannel({
          title: `[${process.env.CONFIG}] Base To Avail rebalancing starting`,
          details: `*Action:* Bridging ${AMOUNT_TO_BRIDGE_FORMATTED} tokens from BASE to AVAIL
  *Reason:* Funds are low on AVAIL
  *Current Balances:*
  - AVAIL: ${poolBalances.humanFormatted.availPoolBalance} tokens
  - BASE: ${poolBalances.humanFormatted.evmPoolBalance} tokens`,
          type: "info",
        });
        bridgingResult = await BASE_TO_AVAIL(api, AMOUNT_TO_BRIDGE);
        break;
      default:
        bridgingResult = "Balances are sufficient. No bridging required.";
    }

    if (typeof bridgingResult === "string") {
      await sendNotificationChannel({
        title: `[${process.env.CONFIG}] Rebalancing Completed Successfully`,
        details: `*Result:* ${bridgingResult}`,
        type: "success",
      });
    } else {
      await sendNotificationChannel({
        title: `[${process.env.CONFIG}] Rebalancing Completed Successfully`,
        details: `*Result:* Bridging completed successfully`,
        initiateLink: bridgingResult.initiateExplorerLink,
        destinationLink: bridgingResult.destinationExplorerLink,
        type: "success",
      });
    }
  } catch (error: any) {
    console.error("Error in job", error);
    markJobCompleted(error.message);
    await sendNotificationChannel({
      title: `[${process.env.CONFIG}] Rebalancing Failed`,
      details: `*Error:* ${error.message}`,
      type: "error",
    });
    throw error;
  } finally {
    if (isJobRunning()) {
      markJobCompleted();
    }
    disconnect();
  }
}
