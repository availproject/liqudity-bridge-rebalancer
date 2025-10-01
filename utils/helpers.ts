import {
  ApiPromise,
  Keyring,
  KeyringPair,
  SDK,
  SubmittableResult,
} from "avail-js-sdk";
import {
  IChain,
  SendMessageTypedData,
  WithBalanceData,
  TxnReturnType,
  ExecuteMessageTypedData,
  ContractAvailSendTypedData,
  ContractReceiveAvailTypedData,
} from "./types";
import { BigNumber } from "bignumber.js";
import { publicClient, walletClient } from "./client";
import { availTokenAbi, bridgeContractAbi } from "./abi";
import {
  encodeAbiParameters,
  Hex,
  keccak256,
  PublicClient,
  WalletClient,
} from "viem";

export function validateEnvVars() {
  const requiredEnvVars = [
    "NEXT_PUBLIC_BRIDGE_PROXY_ETH",
    "BRIDGE_API_URL",
    "ETH_PROVIDER_URL",
    "WALLET_SIGNER_KEY_ETH",
    "BLOCK_NUMBER",
    "TX_INDEX",
    "FINALIZED_BLOCK",
    "CONFIG",
    "SRC_CHAIN",
    "DST_CHAIN",
    "NEXT_PUBLIC_AVAIL_TOKEN_BASE",
    "NEXT_PUBLIC_MANAGER_ADDRESS_BASE",
    "NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_BASE",
    "NEXT_PUBLIC_AVAIL_TOKEN_ETH",
    "NEXT_PUBLIC_MANAGER_ADDRESS_ETH",
    "NEXT_PUBLIC_WORMHOLE_TRANSCEIVER_ETH",
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

export async function getTokenBalance(
  api: ApiPromise,
  chainClient: PublicClient = publicClient,
) {
  const balance = (await api.query.system.account(
    process.env.AVAIL_POOL_ADDRESS,
  )) as WithBalanceData<any>;

  const { free, frozen } = balance.data;

  const freeBalance = new BigNumber(free.toString());
  const frozenBalance = new BigNumber(frozen.toString());
  const spendableBalance = freeBalance.minus(frozenBalance);

  const evmPoolBalance = await chainClient.readContract({
    address: process.env.AVAIL_TOKEN_ADDRESS as Hex,
    abi: availTokenAbi,
    functionName: "balanceOf",
    args: [process.env.AVAIL_POOL_ADDRESS as Hex],
  });

  return {
    evmPoolBalance,
    spendableBalance,
  };
}

export async function sendMessage(
  account: KeyringPair,
  api: ApiPromise,
  data: SendMessageTypedData,
): Promise<TxnReturnType> {
  const txResult = await new Promise<SubmittableResult>((resolve) => {
    api.tx.vector
      .sendMessage(data.message, data.to, data.destinationDomain)
      .signAndSend(account, (result: SubmittableResult) => {
        console.log(`Tx status: ${result.status}`);
        if (result.isFinalized || result.isError) {
          resolve(result);
        }
      });
  });

  const error = txResult.dispatchError;
  if (txResult.isError) {
    throw new Error(`Transaction failed with error: ${error}`);
  } else if (error != undefined) {
    if (error.isModule) {
      const decoded = api.registry.findMetaError(error.asModule);
      const { docs, name, section } = decoded;
      throw new Error(`${section}.${name}: ${docs.join(" ")}`);
    } else {
      throw new Error(error.toString());
    }
  }

  return {
    status: txResult.status.toString(),
    txHash: txResult.txHash.toString(),
  };
}

export async function executeMessage(
  account: KeyringPair,
  api: ApiPromise,
  data: ExecuteMessageTypedData,
): Promise<TxnReturnType> {
  const txResult = await new Promise<SubmittableResult>((resolve) => {
    api.tx.vector
      .execute(
        data.slot,
        data.addrMessage,
        data.accountProof,
        data.storageProof,
      )
      .signAndSend(account, (result: SubmittableResult) => {
        console.log(`Tx status: ${result.status}`);
        if (result.isFinalized || result.isError) {
          resolve(result);
        }
      });
  });

  const error = txResult.dispatchError;
  if (txResult.isError) {
    throw new Error(`Transaction failed with error: ${error}`);
  } else if (error != undefined) {
    if (error.isModule) {
      const decoded = api.registry.findMetaError(error.asModule);
      const { docs, name, section } = decoded;
      throw new Error(`${section}.${name}: ${docs.join(" ")}`);
    } else {
      throw new Error(error.toString());
    }
  }

  return {
    status: txResult.status.toString(),
    txHash: txResult.txHash.toString(),
  };
}

export async function contractAvailSend(
  //funny error: but specifying type WalletClient then makes me add chain, account params, which ideally should be self processed
  writeClient: WalletClient = walletClient,
  data: ContractAvailSendTypedData,
  readClient: PublicClient = publicClient,
): Promise<TxnReturnType> {
  const pubkey = substrateAddressToPublicKey(data.substrateAddressDestination);
  const send = await writeClient.writeContract({
    address: process.env.BRIDGE_PROXY_ADDY as Hex,
    abi: bridgeContractAbi,
    functionName: "sendAvail",
    chain: walletClient.chain,
    account: walletClient.account,
    args: [pubkey, data.atomicAmount],
  });

  const receipt = await readClient.waitForTransactionReceipt({
    hash: send,
    confirmations: 5,
  });
  return {
    status: receipt.status,
    txHash: send,
  };
}

export async function contractReceiveAvail(
  writeClient: WalletClient = walletClient,
  readClient: PublicClient = publicClient,
  merkleProof: ContractReceiveAvailTypedData,
): Promise<TxnReturnType> {
  const recieve = await writeClient.writeContract({
    address: process.env.BRIDGE_PROXY_ADDY as Hex,
    abi: bridgeContractAbi,
    chain: walletClient.chain,
    account: walletClient.account,
    functionName: "ReceiveAvail",
    args: [
      [
        "0x02",
        merkleProof.message.from,
        merkleProof.message.to,
        merkleProof.message.originDomain,
        merkleProof.message.destinationDomain,
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
            merkleProof.message.message.fungibleToken.asset_id,
            BigInt(merkleProof.message.message.fungibleToken.amount),
          ],
        ),
        merkleProof.message.id,
      ],
      [
        merkleProof.dataRootProof,
        merkleProof.leafProof,
        merkleProof.rangeHash,
        merkleProof.dataRootIndex,
        merkleProof.blobRoot,
        merkleProof.bridgeRoot,
        merkleProof.leaf,
        merkleProof.leafIndex,
      ],
    ],
  });

  const receipt = await readClient.waitForTransactionReceipt({
    hash: recieve,
    confirmations: 5,
  });
  return {
    status: receipt.status,
    txHash: recieve,
  };
}

//LOW LEVEL UTILS
export const stringToByte32 = (str: Hex) => {
  return keccak256(str);
};

function uint8ArrayToByte32String(uint8Array: Uint8Array) {
  if (!(uint8Array instanceof Uint8Array)) {
    throw new Error("Input must be a Uint8Array");
  }
  let hexString = "";
  for (const byte of uint8Array as any) {
    hexString += byte.toString(16).padStart(2, "0");
  }
  if (hexString.length !== 64) {
    throw new Error("Input must be 32 bytes long");
  }
  return "0x" + hexString;
}

export const substrateAddressToPublicKey = (accountId: string) => {
  const keyring = new Keyring({ type: "sr25519" });

  const pair = keyring.addFromAddress(accountId);
  const publicKeyByte8Array = pair.publicKey;
  const publicKeyByte32String = uint8ArrayToByte32String(publicKeyByte8Array);

  return publicKeyByte32String;
};
