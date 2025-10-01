import { sendMessage } from "../utils/helpers";
import { getKeyringFromSeed, initialize, TURING_ENDPOINT } from "avail-js-sdk";

async function main() {
  try {
    const keyring = getKeyringFromSeed(process.env.SURI!);
    const api = await initialize(TURING_ENDPOINT);
    //might need to lowercase check above
    const destinationAddress = "0x5D8A4918205F56580f3e578E8875B623BB23D3A2";
    const assetId =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    const res = await sendMessage(keyring, api, {
      message: {
        FungibleToken: {
          assetId,
          amount: BigInt(1000000000000000000),
        },
      },
      to: `${destinationAddress.padEnd(66, "0")}`,
      destinationDomain: 2,
    });

    console.log(res);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await main();
