import { ethers } from "ethers";
import { createPublicClient, encodeAbiParameters, http } from "viem";
import {
  TransactionId,
  Wormhole,
  signSendWait,
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";
import { getSigner } from "../utils/signer";
import "@wormhole-foundation/sdk-evm-ntt";
import { bridgeContractAbi } from "../utils/abi";
import { formatUnits, parseUnits } from "viem";

import jsonbigint from "json-bigint"; 
const JSONBigInt = jsonbigint({ useNativeBigInt: true });


const BRIDGE_ADDRESS = process.env.NEXT_PUBLIC_BRIDGE_PROXY_ETH!;
const BRIDGE_API_URL = process.env.BRIDGE_API_URL!;
const ETH_PROVIDER_URL = process.env.ETH_PROVIDER_URL!;
const WALLET_SIGNER_KEY_ETH = process.env.WALLET_SIGNER_KEY_ETH!;

const BLOCK_NUMBER = parseInt(process.env.BLOCK_NUMBER!);
const TX_INDEX = parseInt(process.env.TX_INDEX!);
const FINALIZED_BLOCK = process.env.FINALIZED_BLOCK!;

export const UPDATED_NTT_TOKENS = {
  Base: {
    token: process.env.NEXT_PUBLIC_AVAIL_TOKEN_BASE!,
    manager: process.env.NEXT_PUBLIC_MANAGER_ADDRESS_BASE!,
    transceiver: { wormhole: process.env.NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_BASE! },
  },
  Ethereum: {
    token: process.env.NEXT_PUBLIC_AVAIL_TOKEN_ETH!,
    manager: process.env.NEXT_PUBLIC_MANAGER_ADDRESS_ETH!,
    transceiver: { wormhole: process.env.NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_ETH! },
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
      asset_id: `0x${string}`;
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

let hasReceivedAvail = false;
let lastReceiveBlock = 0;
let lastTransactionHash: string | null = null;
const provider = new ethers.providers.JsonRpcProvider(ETH_PROVIDER_URL);

function validateEnvVars() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_BRIDGE_PROXY_ETH',
    'BRIDGE_API_URL',
    'ETH_PROVIDER_URL',
    'WALLET_SIGNER_KEY_ETH',
    'BLOCK_NUMBER',
    'TX_INDEX',
    'FINALIZED_BLOCK',
    'CONFIG',
    'SRC_CHAIN',
    'DST_CHAIN',
    'NEXT_PUBLIC_AVAIL_TOKEN_BASE',
    'NEXT_PUBLIC_MANAGER_ADDRESS_BASE',
    'NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_BASE',
    'NEXT_PUBLIC_AVAIL_TOKEN_ETH',
    'NEXT_PUBLIC_MANAGER_ADDRESS_ETH',
    'NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_ETH'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);
  }

  if (isNaN(parseInt(process.env.BLOCK_NUMBER!))) {
    console.error('❌ BLOCK_NUMBER must be a valid number');
    process.exit(1);
  }

  if (isNaN(parseInt(process.env.TX_INDEX!))) {
    console.error('❌ TX_INDEX must be a valid number');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
}

async function attemptReceiveAvail(proof: ProofData, contractInstance: ethers.Contract): Promise<{ success: boolean; error?: any }> {
  const MAX_RECEIVE_ATTEMPTS = 3;
  const RETRY_DELAY = 1 * 60 * 1000; // 5 minutes in milliseconds
  let attempts = 0;

  while (attempts < MAX_RECEIVE_ATTEMPTS) {
    try {
      console.log(`🔄 Attempting to receive AVAIL (Attempt ${attempts + 1}/${MAX_RECEIVE_ATTEMPTS})...`);
      const receipt = await contractInstance.receiveAVAIL(
        [
          "0x02", // token transfer type
          proof.message.from,
          proof.message.to,
          proof.message.originDomain,
          proof.message.destinationDomain,
          encodeAbiParameters(
            [
              {
                name: "assetId",
                type: "bytes32",
              },
              {
                name: "amount",
                type: "uint256",
              },
            ],
            [
              proof.message.message.fungibleToken.asset_id,
              BigInt(proof.message.message.fungibleToken.amount),
            ]
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
      );

      const received = await receipt.wait();
      const network = process.env.CONFIG === "Mainnet" ? "" : "sepolia.";
      console.log(`✅ AVAIL received in block: ${received.blockNumber}`);
      console.log(`🔗 View on Etherscan: https://${network}etherscan.io/tx/${received.transactionHash}`);
      lastReceiveBlock = received.blockNumber;
      lastTransactionHash = received.transactionHash;
      return { success: true };
    } catch (error) {
      attempts++;
      console.log(`❌ Failed to receive AVAIL (Attempt ${attempts}/${MAX_RECEIVE_ATTEMPTS}):`, error);
      if (attempts < MAX_RECEIVE_ATTEMPTS) {
        console.log(`⏳ Waiting ${RETRY_DELAY/1000/60} minutes before next attempt...`);
        await new Promise((f) => setTimeout(f, RETRY_DELAY));
      }
    }
  }
  return { success: false, error: "Maximum receive AVAIL attempts reached" };
}

async function main() {
  
  validateEnvVars();
  console.log("⏳ Running script for", process.env.CONFIG);
  while (true) {
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

      if (!hasReceivedAvail && lastCommittedBlock >= txBlockNumber) {
        console.log("🔍 Fetching the proof...");
        const proofResponse = await fetch(
          BRIDGE_API_URL + "/eth/proof/" + FINALIZED_BLOCK + "?index=" + TX_INDEX
        );
        if (proofResponse.status != 200) {
          console.log("❌ Failed to fetch proof");
          console.log(await proofResponse.text());
          process.exit(0);
        }
        const proofText = await proofResponse.text();
        const proof: ProofData = JSONBigInt.parse(proofText);
        console.log("✅ Proof fetched successfully" );

        const signer = new ethers.Wallet(WALLET_SIGNER_KEY_ETH, provider);
        const contractInstance = new ethers.Contract(
          BRIDGE_ADDRESS,
          bridgeContractAbi,
          signer
        );

        const result = await attemptReceiveAvail(proof, contractInstance);
        if (result.success) {
          hasReceivedAvail = true;
        } else {
          console.log("❌ Maximum receive AVAIL attempts reached. Exiting...");
          process.exit(1);
        }
      }

      if (hasReceivedAvail) {
        console.log("🔍 Checking if above transaction is finalized...");
        const publicClient = createPublicClient({
          transport: http(ETH_PROVIDER_URL),
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: lastTransactionHash as `0x${string}`,
          confirmations: 2,
        });

        if (receipt.status === 'success') {
          console.log("✅ Transaction finalized successfully");
        } else {
          console.log("❌ Transaction failed to finalize");
          process.exit(1);
        }

        const wh = new Wormhole(process.env.CONFIG! as "Mainnet" | "Testnet" | "Devnet", [evm.Platform]);
        const src = wh.getChain(process.env.SRC_CHAIN! as "Ethereum" | "Base");
        const dst = wh.getChain(process.env.DST_CHAIN! as "Ethereum" | "Base");

        const srcSigner = await getSigner(src);
        const dstSigner = await getSigner(dst);

        const srcNtt = await src.getProtocol("Ntt", {
            ntt: UPDATED_NTT_TOKENS[src.chain],
          });

        const balance = await publicClient.readContract({
            address: UPDATED_NTT_TOKENS[src.chain]!.token as `0x${string}`,
            abi: [{
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            }],
            functionName: "balanceOf",
            args: [srcSigner.address.address.toString() as `0x${string}`],
          });

          const formattedBalance = formatUnits(balance, await srcNtt.getTokenDecimals());
          console.log(`💰 Current AVAIL balance: ${formattedBalance}`);
  
          if (balance === 0n) {
            console.log("❌ No AVAIL tokens to bridge");
            process.exit(1);
          }

        const ethBalance = await publicClient.getBalance({
          address: srcSigner.address.address.toString() as `0x${string}`,
        });

        const minEthRequired = parseUnits("0.001", 18); // 0.01 ETH minimum
        if (ethBalance < minEthRequired) {
          console.log(`❌ Insufficient ETH for gas. Required: 0.001 ETH, Current: ${formatUnits(ethBalance, 18)} ETH`);
          process.exit(1);
        }
        try {
          console.log("🔄 Initiating bridge to Base...");
          const xfer = () =>
            srcNtt.transfer(srcSigner.address.address, balance, dstSigner.address, {
              queue: false,
              automatic: true,
              gasDropoff: 0n,
            });

          const txids: TransactionId[] = await signSendWait(
            src,
            xfer(),
            srcSigner.signer
          );
          
          console.log("✅ Bridge transaction initiated");
          console.log(`🔗 View on wormholescan: https://wormholescan.io/#/tx/${txids[1].txid ?? txids[0].txid}?network=Mainnet`);
          process.exit(0);
        } catch (error) {
          console.log("❌ Bridge transaction failed:", error);
          process.exit(1);
        }
      }

      console.log(
        `⏳ Waiting for bridge inclusion commitment (${lastCommittedBlock}/${txBlockNumber})...`
      );
      await new Promise((f) => setTimeout(f, 60 * 1000));
    } catch (error) {
      console.log("❌ Error in main loop:", error);
      await new Promise((f) => setTimeout(f, 60 * 1000));
    }
  }
}

main().catch(console.error);
