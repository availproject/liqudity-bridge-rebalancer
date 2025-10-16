import { Hex } from "viem";

export type LogType = "error" | "warn" | "info" | "success";

export type SlackOk = { ok: true; ts: string };
export type SlackErr = {
  ok: false;
  error: string;
  needed?: string;
  provided?: string;
};

export const TYPE_META: Record<
  LogType,
  { prefix: string; emoji: string; buttonStyle: "primary" | "danger" }
> = {
  error: { prefix: "ERROR", emoji: "❌", buttonStyle: "danger" },
  warn: { prefix: "WARNING", emoji: "⚠️", buttonStyle: "danger" },
  info: { prefix: "INFO", emoji: "🎛️", buttonStyle: "primary" },
  success: { prefix: "SUCCESS", emoji: "✅", buttonStyle: "primary" },
};

export interface ProofData {
  dataRootProof: Array<string>;
  leafProof: string;
  rangeHash: string;
  dataRootIndex: number;
  blobRoot: string;
  bridgeRoot: string;
  leaf: string;
  leafIndex: number;
  message: AvailMessage;
}

export interface TransactionStatus {
  blockHash: Hex;
  txIndex: number;
  blockNumber: number;
}

export interface AccountAndStorageProof {
  accountProof: Hex[];
  storageProof: Hex[];
}

export interface ChainState {
  ethHead: {
    slot: 0;
    timestamp: 0;
    timestampDiff: 0;
    blockNumber: 0;
    blockHash: "";
  };
  avlHead: {
    end: 0;
    start: 0;
    endTimestamp: 0;
  };
}

export interface AvailMessage {
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

export interface HeadResponse {
  slot: number;
  data: {
    end: number;
  };
}

export interface SendMessageTypedData {
  destinationDomain: number;
  message: {
    FungibleToken: {
      //verify the extrinsic works with string
      amount: bigint | string;
      assetId: Hex;
    };
  };
  to: string;
}

export interface IResponse {
  success: boolean;
  error?: string;
}

export enum IChain {
  AVAIL = "AVAIL",
  ETH = "ETH",
  BASE = "BASE",
}

export type WithBalanceData<T, U = any> = T & {
  data: {
    free: U;
    frozen: U;
  };
};

export interface TxnReturnType<T = string> {
  status: T;
  txHash: string;
  event?: {
    type: "messageSent";
    logIndex?: number;
    from: Hex;
    to: Hex;
    messageId: bigint;
  };
}

export type MessageSentEventArgs = {
  from: Hex;
  to: Hex;
  messageId: bigint;
};

export interface ExecuteMessageTypedData {
  slot: number;
  addrMessage: {
    message: {
      ArbitraryMessage?: Hex;
      FungibleToken?: {
        assetId: Hex;
        amount: string;
      };
    };
    from: `${string}`;
    to: `${string}`;
    originDomain: number;
    destinationDomain: number;
    id: number;
  };
  accountProof: Hex[];
  storageProof: Hex[];
}

export interface ContractAvailSendTypedData {
  substrateAddressDestination: string;
  atomicAmount: string;
}

interface EthMessage {
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
  messageType: string;
}

export interface ContractReceiveAvailTypedData {
  blobRoot: string;
  blockHash: string;
  bridgeRoot: string;
  dataRoot: string;
  dataRootCommitment: string;
  dataRootIndex: number;
  dataRootProof: Hex[];
  leaf: string;
  leafIndex: number;
  leafProof: Hex[];
  message: EthMessage;
  rangeHash: string;
}
