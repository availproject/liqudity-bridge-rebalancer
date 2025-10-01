import axios from "axios";
import jsonbigint from "json-bigint";
import {
  AccountAndStorageProof,
  ChainState,
  ContractReceiveAvailTypedData,
} from "./types";
import { ApiPromise } from "avail-js-sdk";

const JSONBigInt = jsonbigint({ useNativeBigInt: true });

export const getMerkleProof = async (blockhash: string, index: number) => {
  const response = await axios.get(
    `${process.env.bridgeApiBaseUrl}/eth/proof/${blockhash}`,
    {
      params: { index },
      transformResponse: [(data) => data],
    },
  );
  const proof: ContractReceiveAvailTypedData = JSONBigInt.parse(response.data);

  return proof;
};

export async function fetchAvlHead(
  api: ApiPromise,
): Promise<ChainState["avlHead"]> {
  //check the response type once
  const response = await fetch(`${process.env.bridgeApiBaseUrl}/avl/head`);
  const avlHead: ChainState["avlHead"] = await response.json();
  return avlHead;
}

export async function fetchEthHead() {
  const response = await fetch(`${process.env.bridgeApiBaseUrl}/v1/eth/head`);
  const ethHead: ChainState["ethHead"] = await response.json();
  return ethHead;
}

export async function getAccountStorageProofs(
  blockhash: string,
  messageid: number,
) {
  const response = await fetch(
    `${process.env.bridgeApiBaseUrl}/v1/avl/proof/${blockhash}/${messageid}`,
  ).catch((e) => {
    return Response.error();
  });

  const result: AccountAndStorageProof = await response.json();
  return result;
}
