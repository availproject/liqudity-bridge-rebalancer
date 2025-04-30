import { Keyring } from "@polkadot/api";
import { ISubmittableResult } from "@polkadot/types/types";
import { initialize } from "avail-js-sdk";

const AVAIL_RPC = "wss://mainnet-rpc.avail.so/ws";
const FROM = "0xa13347de937fB2Fc0D8CCa2a5fC95748f6F1fc64000000000000000000000000"; // SAFE PROXY ADDRESS as 32 bytes

/** config required for the script to run */
const SURI = process.env.SURI!
const BRIDGE_API_URL = process.env.BRIDGE_API_URL!
const TOKENS_TO_SEND = process.env.AVAIL_CLAIM_AMOUNT!
const MESSAGE_ID = process.env.MESSAGE_ID!

interface HeadResponse {
    slot: number;
}

interface SlotMappingResponse {
    blockNumber: number;
    blockHash: string;
}

interface ProofData {
    accountProof: Array<string>;
    storageProof: Array<string>;
}

async function main() {
    try {
        const availApi = await initialize(AVAIL_RPC);
        const account = new Keyring({ type: "sr25519" }).addFromUri(SURI);

        while (true) {
            let getHeadRsp = await fetch(BRIDGE_API_URL + "/eth/head");
            if (getHeadRsp.status != 200) {
                console.log("❌ Something went wrong fetching the head.");
                break;
            }
            let headRsp = await getHeadRsp.json() as HeadResponse;
            let txSendBlockNumber: number = Number(process.env.BLOCK_NUMBER);
            let slot: number = headRsp.slot;
            let slotMappingRsp = await fetch(BRIDGE_API_URL + "/beacon/slot/" + slot);
            let mappingResponse = await slotMappingRsp.json() as SlotMappingResponse;
            console.log(`📦 Block inclusion number ${txSendBlockNumber}, head block number ${mappingResponse.blockNumber}`);
            // check if we can claim
            // if the head on a pallet is updated with a block number >= block number when tx was sent
            if (mappingResponse.blockNumber >= txSendBlockNumber) {
                console.log("🔍 Fetching the blob proof...")
                const proofResponse = await fetch(BRIDGE_API_URL + "/avl/proof/" + mappingResponse.blockHash + "/" + MESSAGE_ID);
                if (proofResponse.status != 200) {
                    console.log("❌ Something went wrong fetching the proof.")
                    console.log(proofResponse)
                    break;
                }

                let proof = await proofResponse.json() as ProofData;
                console.log("✅ Proof fetched successfully!")

                try {
                    const txResult = await new Promise<ISubmittableResult>((resolve) => {
                        availApi.tx.vector.execute(
                            slot,
                            {
                                message: {
                                    FungibleToken: {
                                        assetId: "0x0000000000000000000000000000000000000000000000000000000000000000",
                                        amount: TOKENS_TO_SEND.toString() // THIS MIGHT BREAK FOR HUGE AMOUNTS, check bigInt
                                    }
                                },
                                from: FROM,
                                /** PROXY ADDRESS ON AVAIL */
                                to: "0x0846fbde1ccc62cd036472dd640de66e4cc1f0479d03e5a4ff3f09648db20af5",
                                originDomain: 2,
                                destinationDomain: 1,
                                id: MESSAGE_ID,
                            },
                            proof.accountProof,
                            proof.storageProof
                        ).signAndSend(account, { nonce: -1 }, (result: any) => {
                            if (result.isInBlock || result.isError) {
                                console.log(`⚽️ TX included in block: blockhash: ${result.status.asInBlock.toString()}, txHash: ${result.txHash.toString()}, txIndex: ${result.txIndex}`);
                                resolve(result);
                            }
                        });
                    });

                    const error = txResult.dispatchError;
                    if (txResult.isError) {
                        throw new Error(`Transaction failed with error: ${error}`);
                    } else if (error != undefined) {
                        if (error.isModule) {
                            const decoded = availApi.registry.findMetaError(error.asModule);
                            const { docs, name, section } = decoded;
                            throw new Error(`${section}.${name}: ${docs.join(" ")}`);
                        } else {
                            throw new Error(error.toString());
                        }
                    }

                    console.log(`✨ Transaction finalized successfully!`);
                    console.log(`🔗 Transaction Hash: ${txResult.txHash}`);
                    break;
                } catch (error) {
                    console.error("❌ Transaction failed:", error);
                    throw error;
                }
            }

            console.log(`⏳ Waiting for bridge inclusion commitment. This can take a while...`)
            // wait for 1 minute to check again
            await new Promise(f => setTimeout(f, 60 * 1000));
        }
    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }

    process.exit(0);
}

main().catch(console.error);