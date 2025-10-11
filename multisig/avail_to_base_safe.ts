import { ethers } from "ethers";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  encodeFunctionData,
  Hex,
} from "viem";
import { Wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";
import { getSigner } from "../utils/wormhole";
import "@wormhole-foundation/sdk-evm-ntt";
import { bridgeContractAbi } from "../utils/abi";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";

import jsonbigint from "json-bigint";
const JSONBigInt = jsonbigint({ useNativeBigInt: true });

const BRIDGE_ADDRESS = process.env.BRIDGE_PROXY_ETH!;
const BRIDGE_API_URL = process.env.BRIDGE_API_URL!;
const ETH_PROVIDER_URL = process.env.ETH_PROVIDER_URL!;
const WALLET_SIGNER_KEY_ETH = process.env.WALLET_SIGNER_KEY_ETH!;

const BLOCK_NUMBER = parseInt(process.env.BLOCK_NUMBER!);
const TX_INDEX = parseInt(process.env.TX_INDEX!);
const FINALIZED_BLOCK = process.env.FINALIZED_BLOCK!;

export const UPDATED_NTT_TOKENS = {
  Base: {
    token: process.env.AVAIL_TOKEN_BASE!,
    manager: process.env.MANAGER_ADDRESS_BASE!,
    transceiver: {
      wormhole: process.env.WORMHOLE_TRANSCEIVER_BASE!,
    },
  },
  Ethereum: {
    token: process.env.AVAIL_TOKEN_ETH!,
    manager: process.env.MANAGER_ADDRESS_ETH!,
    transceiver: {
      wormhole: process.env.WORMHOLE_TRANSCEIVER_ETH!,
    },
  },
};

interface ProofData {
  dataRootProof: Array<string>;
  leafProof: string;
  rangeHash: string;
  dataRootIndex: number;
  blobRoot: string;
  bridgeRoot: string;
  leaf: string;
  leafIndex: number;
  message: Message;
}

interface Message {
  destinationDomain: number;
  from: string;
  id: number;
  message: {
    fungibleToken: {
      amount: bigint;
      asset_id: Hex;
    };
  };
  originDomain: number;
  to: string;
}

interface HeadResponse {
  data: {
    end: number;
  };
}

interface TransactionData {
  safeTransactions: SafeTransactionDataPartial[];
  hexCalldata: {
    receiveAvail: string;
    transfer: string;
  };
}

function validateEnvVars() {
  const requiredEnvVars = [
    "BRIDGE_PROXY_ETH",
    "BRIDGE_API_URL",
    "ETH_PROVIDER_URL",
    "WALLET_SIGNER_KEY_ETH",
    "BLOCK_NUMBER",
    "TX_INDEX",
    "FINALIZED_BLOCK",
    "CONFIG",
    "SRC_CHAIN",
    "DST_CHAIN",
    "AVAIL_TOKEN_BASE",
    "MANAGER_ADDRESS_BASE",
    "WORMHOLE_TRANSCEIVER_BASE",
    "AVAIL_TOKEN_ETH",
    "MANAGER_ADDRESS_ETH",
    "WORMHOLE_TRANSCEIVER_ETH",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => console.error(`  - ${varName}`));
    process.exit(1);
  }

  if (isNaN(parseInt(process.env.BLOCK_NUMBER!))) {
    console.error("❌ BLOCK_NUMBER must be a valid number");
    process.exit(1);
  }

  if (isNaN(parseInt(process.env.TX_INDEX!))) {
    console.error("❌ TX_INDEX must be a valid number");
    process.exit(1);
  }

  console.log("✅ All required environment variables are set");
}

async function generateSafeTransaction(
  proof: ProofData,
): Promise<TransactionData> {
  const safeTransactions: SafeTransactionDataPartial[] = [];

  console.log("🔍 Generating Safe transaction...");

  const publicClient = createPublicClient({
    transport: http(ETH_PROVIDER_URL),
  });

  const transaction = {
    to: BRIDGE_ADDRESS,
    value: "0",
    data: encodeFunctionData({
      abi: bridgeContractAbi,
      functionName: "receiveAVAIL",
      args: [
        [
          "0x02",
          proof.message.from,
          proof.message.to,
          proof.message.originDomain,
          proof.message.destinationDomain,
          encodeAbiParameters(
            [
              { name: "assetId", type: "bytes32" },
              { name: "amount", type: "uint256" },
            ],
            [
              proof.message.message.fungibleToken.asset_id,
              BigInt(proof.message.message.fungibleToken.amount),
            ],
          ),
          proof.message.id,
        ],
        [
          proof.dataRootProof,
          proof.leafProof,
          proof.rangeHash,
          proof.dataRootIndex,
          proof.blobRoot,
          proof.bridgeRoot,
          proof.leaf,
          proof.leafIndex,
        ],
      ],
    }),
  };

  safeTransactions.push(transaction);

  const wh = new Wormhole(
    process.env.CONFIG! as "Mainnet" | "Testnet" | "Devnet",
    [evm.Platform],
  );
  const src = wh.getChain(process.env.SRC_CHAIN! as "Ethereum" | "Base");
  const dst = wh.getChain(process.env.DST_CHAIN! as "Ethereum" | "Base");

  const srcSigner = await getSigner(src);
  const dstSigner = await getSigner(dst);

  const srcNtt = await src.getProtocol("Ntt", {
    ntt: UPDATED_NTT_TOKENS[src.chain],
  });

  const balance = await publicClient.readContract({
    address: UPDATED_NTT_TOKENS[src.chain]!.token as Hex,
    abi: [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [srcSigner.address.address.toString() as Hex],
  });

  const transferCalldata = await srcNtt.transfer(
    srcSigner.address.address,
    balance,
    dstSigner.address,
    {
      queue: false,
      automatic: true,
      gasDropoff: 0n,
    },
  );

  const txData = (await transferCalldata.next()).value;
  const transferCalldataHex = txData.data;

  safeTransactions.push({
    to: UPDATED_NTT_TOKENS[src.chain]!.token,
    data: transferCalldataHex,
    value: "0",
    operation: 0,
  });

  return {
    safeTransactions,
    hexCalldata: {
      receiveAvail: ethers.utils.hexlify(transaction.data),
      transfer: transferCalldataHex,
    },
  };
}

async function main() {
  validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);

  try {
    console.log("🔍 Fetching head...");
    let getHeadRsp = await fetch(BRIDGE_API_URL + "/avl/head");
    if (getHeadRsp.status != 200) {
      console.log("❌ Failed to fetch chain head");
      process.exit(0);
    }
    let headRsp = (await getHeadRsp.json()) as HeadResponse;
    let txBlockNumber: number = BLOCK_NUMBER;
    let lastCommittedBlock: number = headRsp.data.end;

    if (lastCommittedBlock >= txBlockNumber) {
      console.log("🔍 Fetching the proof...");
      const proofResponse = await fetch(
        BRIDGE_API_URL + "/eth/proof/" + FINALIZED_BLOCK + "?index=" + TX_INDEX,
      );
      if (proofResponse.status != 200) {
        console.log("❌ Failed to fetch proof");
        console.log(proofResponse);
        process.exit(0);
      }
      const proofText = await proofResponse.text();
      const proof: ProofData = JSONBigInt.parse(proofText);

      console.log("✅ Proof fetched successfully");

      const { safeTransactions, hexCalldata } =
        await generateSafeTransaction(proof);

      console.log("✅ Generated Safe transaction data:");
      console.log(JSON.stringify(safeTransactions, null, 2));

      console.log("\n📝 Hex-encoded calldata:");
      console.log("Receive AVAIL:", hexCalldata.receiveAvail);
      console.log("Transfer:", hexCalldata.transfer);

      console.log(
        "\n📝 Copy the Safe transaction data and execute it through the Safe UI",
      );
      process.exit(0);
    }

    console.log(
      `⏳ Waiting for bridge inclusion commitment (${lastCommittedBlock}/${txBlockNumber})...`,
    );
    await new Promise((f) => setTimeout(f, 60 * 1000));
  } catch (error) {
    console.log("❌ Error in main loop:", error);
    process.exit(1);
  }
}

main().catch(console.error);
