import { getKeyringFromSeed, initialize, TURING_ENDPOINT } from "avail-js-sdk";
import { getTokenBalance, validateEnvVars } from "../utils/helpers";
import { publicClient } from "../utils/client";
import { AVAIL_TO_BASE } from "./avail_to_base";

async function main() {
  validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);

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

  const api = await initialize(TURING_ENDPOINT);
  const THRESHOLD = new BigNumber(100000);
  const balances = await getTokenBalance(api, publicClient);
  const avail_account = getKeyringFromSeed(process.env.SURI!);

  switch (true) {
    case THRESHOLD > new BigNumber(balances.evmPoolBalance):
      console.log("uh oh we need to get some funds to base");

      await AVAIL_TO_BASE(api, avail_account);

    case THRESHOLD > balances.spendableBalance:
      console.log("uh oh we need to get some funds to avail");
  }
}

main().catch(console.error);
