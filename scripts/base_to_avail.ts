import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { ISubmittableResult } from "@polkadot/types/types";
import { ethers } from "ethers";
import { encodeAbiParameters } from 'viem';
import { BN } from "@polkadot/util";
import { bridgeContractAbi } from "../utils/abi";
import { initialize } from "avail-js-sdk";


const AVAIL_RPC = "wss://mainnet-rpc.avail.so/ws";
const SURI = process.env.SURI || "";
const BRIDGE_ADDRESS = "0x054fd961708d8e2b9c10a63f6157c74458889f0a"; // deployed bridge address
const BRIDGE_API_URL = "https://slowops-bridge-api.fra.avail.so"; // bridge api url
const ETH_PROVIDER_URL = "https://ethereum-rpc.publicnode.com"; // eth provider url
const TOKENS_TO_SEND = "0"
const FROM = "0x7651382c7c18E8F73ebf951EadC53C4a7413c0D4000000000000000000000000"; // address as 32 bytes
const TO = "0xc6501daee1ac18428d4ddb0f384ad0a5c4ff759fe494fc6246c5986308b4ec23";
const MESSAGE_ID = 1327;

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

interface Message {
    destinationDomain: number;
    from: string;
    id: number;
    message: any;
    originDomain: number;
    to: string;
}

async function main() {
    const availApi = await initialize(AVAIL_RPC);
    const account = new Keyring({ type: "sr25519" }).addFromUri(SURI);

    while (true) {
        let getHeadRsp = await fetch(BRIDGE_API_URL + "/eth/head");
        if (getHeadRsp.status != 200) {
            console.log("Something went wrong fetching the head.");
            break;
        }
        let headRsp = await getHeadRsp.json() as HeadResponse;
        let txSendBlockNumber: number = 21965836;
        let slot: number = headRsp.slot;
        // map slot number to block number
        let slotMappingRsp = await fetch(BRIDGE_API_URL + "/beacon/slot/" + slot);
        let mappingResponse = await slotMappingRsp.json() as SlotMappingResponse;
        console.log(`Block inclusion number ${txSendBlockNumber}, head block number ${mappingResponse.blockNumber}`);
        // check if we can claim
        // if the head on a pallet is updated with a block number >= block number when tx was sent
        if (mappingResponse.blockNumber >= txSendBlockNumber) {
            console.log("Fetching the blob proof.")
            const proofResponse = await fetch(BRIDGE_API_URL + "/avl/proof/" + mappingResponse.blockHash + "/" + MESSAGE_ID);
            if (proofResponse.status != 200) {
                console.log("Something went wrong fetching the proof.")
                console.log(proofResponse)
                break;
            }

            let proof = await proofResponse.json() as ProofData;
            console.log(proof);

            

            // call the deployed contract verification function with the inclusion proof and the message that was sent.
            const rsp = await new Promise<ISubmittableResult>((res) => {
                availApi.tx.vector.execute(
                    slot,
                    {
                        message: {
                            FungibleToken: {
                                // zero asset id is AVAIL
                                assetId: "0x0000000000000000000000000000000000000000000000000000000000000000",
                                amount: TOKENS_TO_SEND.toString()
                            }
                        },
                        from: FROM,
                        to: TO,
                        originDomain: 2, // eth domain
                        destinationDomain: 1, // avail domain
                        id: MESSAGE_ID,
                    },
                    proof.accountProof,
                    proof.storageProof
                ).signAndSend(account, { nonce: -1 }, (result: any) => {
                    console.log(`Tx status: ${result.status}`)
                    if (result.isError) {
                        console.log(`Tx failed!`);
                        res(result)
                    }
                    if (result.isInBlock) {
                        console.log("Transaction in block, waiting for block finalization...")
                    }
                    if (result.isFinalized) {
                        console.log(`Tx finalized.`)
                        res(result)
                    }
                });
            });
            console.log(`Transaction ${rsp.txHash}`)
            break;
        }

        console.log(`Waiting to bridge inclusion commitment. This can take a while...`)
        // wait for 1 minute to check again
        await new Promise(f => setTimeout(f, 60 * 1000));
    }

    process.exit(0);
}

main().catch(console.error);