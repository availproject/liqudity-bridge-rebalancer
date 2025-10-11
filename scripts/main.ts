import { initialize, TURING_ENDPOINT } from "avail-js-sdk";
import { Keyring } from "@polkadot/api";
import { getTokenBalance, validateEnvVars } from "../utils/helpers";
import { availAccount, publicClient } from "../utils/client";
import { AVAIL_TO_BASE } from "./avail_to_base";
import { BigNumber } from "bignumber.js";
import { BASE_TO_AVAIL } from "./base_to_avail";

async function main() {
  // validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);

  /*
 1. issues to spec out -
    a. previous script context to know that one side of the bridging is already running and should be - elysia cron could be helpful, pick it up by steps through a sqlite db
  */

  /*
  0. initial env checks + plus check if the last run in still in process then only run this again.
  0.5 fetch pool balances from onchain - check delta, if it's greater than a threshold, move forward with rebalancing
  1. start with initiate vector.sendMessage()
  2. track txn receipt using the new api
  3. every 10 minutes run while loop for proof fetching & try to claim
    a. if claimable, claim and then track till finalisation
  4. when money reaches ethereum, initate a approval + transfer txn through the wormhole sdk to the base
  5. fetch VAA, until the txn is reaches base
  6. spill to a db

try to get this deployed in the same container space with the same env access, this way the hot wallet key doesn't need to moved anywhere

  */

  //base this out of config
  const api = await initialize(TURING_ENDPOINT);
  const THRESHOLD = new BigNumber(100000);
  const GAS_THRESHOLD = new BigNumber(1000000);
  const AMOUNT_TO_BRIDGE = "10000000000000";

  //initial checks
  const poolBalances = await getTokenBalance(
    api,
    publicClient,
    availAccount.address,
  );
  //TODO: add env vars check here

  if (GAS_THRESHOLD > poolBalances.gasOnEvm) {
    throw new Error(
      "Gas threshold on evm does not match, please top up the pool account",
    );
  }

  switch (true) {
    case THRESHOLD > poolBalances.evmPoolBalance:
      console.log("uh oh we need to get some funds to base");
      await AVAIL_TO_BASE(api, availAccount, AMOUNT_TO_BRIDGE);

    case THRESHOLD > poolBalances.availPoolBalance:
      console.log("uh oh we need to get some funds to avail");
      await BASE_TO_AVAIL(availAccount, api, AMOUNT_TO_BRIDGE);
  }
}

main().catch(console.error);

/*
impl choices-
1. we're using bigNumber.js all around, since there is no ui involved (no parsed values needed), all operations should be strictly using bignumber math.
2. try catch blocks, should only exist at the highest parent component, all pretification of logs / display should be handled here (main.ts), throw proper errors everywhere with string (about where it failed) else
3.


*/
