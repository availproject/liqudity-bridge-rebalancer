import { initiateWormholeBridge } from "../utils/wormhole";
import { publicClient, walletClient } from "../utils/client";
import { PublicClient } from "viem";
import { entrypoint } from "./entrypoint";
import { sendNotificationChannel } from "../utils/notifier";
import { contractAvailSend } from "../utils/helpers";

async function main() {
  try {
    await entrypoint();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
