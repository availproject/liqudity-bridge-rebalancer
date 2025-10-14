import { initiateWormholeBridge } from "../utils/wormhole";
import { publicClient } from "../utils/client";
import { PublicClient } from "viem";

async function main() {
  try {
    const wo = await initiateWormholeBridge(
      publicClient as PublicClient,
      "Sepolia",
      "BaseSepolia",
    );
    console.log(wo, "wow");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
