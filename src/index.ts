import { Elysia, status, t } from "elysia";
import { getJobHistory, getLastJobStatus } from "../utils/db";
import { Unkey } from "@unkey/api";
import { initiateWormholeBridge } from "../utils/wormhole";
import { baseClient, publicClient } from "../utils/client";
import { PublicClient } from "viem";

const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY,
});

const app = new Elysia()
  .onError(({ error }) => {
    return new Response(error.toString());
  })
  .guard({
    headers: t.Object({ "x-api-key": t.String() }),
  })
  .onBeforeHandle(async ({ headers, set }) => {
    const result = await unkey.keys.verifyKey({
      key: headers["x-api-key"],
    });

    if (!result.data.valid) {
      return status(401, `Api Key Verification Failed ${result.data.code}`);
    }
  })
  .get("/", () => "core apis health check ok")
  .get("/status", () => {
    const lastJob = getLastJobStatus();

    if (!lastJob) {
      return status(204, "no last jobs");
    }

    return {
      status: lastJob.status,
      started_at: lastJob.started_at,
      finished_at: lastJob.finished_at,
      error: lastJob.error,
      is_running: lastJob.status === "running",
    };
  })
  .get("/history", ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 10;
    const history = getJobHistory(limit);

    return {
      total: history.length,
      jobs: history,
    };
  })
  .get(
    "legacy/wormhole-initiate",
    async ({ query }) => {
      const client = new Set(["Base", "BaseSepolia"]).has(query.sourceChain)
        ? baseClient
        : publicClient;

      const hashes = await initiateWormholeBridge(
        client as PublicClient,
        query.sourceChain,
        query.destinationChain,
        BigInt(query.amount),
        false,
      );

      return hashes;
    },
    {
      query: t.Object({
        sourceChain: t.String(),
        destinationChain: t.String(),
        amount: t.String(),
      }),
    },
  );

app.listen(3001);

/**
 *
 *
 * extra routes for legacy claims - require some changes to the script
 *
 *   // .get("/legacy/eth-claim", ({ query }) => {}, {
 //   query: t.Object({
 //     blockNumber: t.Number(),
 //     txIndex: t.Number(),
 //     finalizedBlock: t.String({
 //       pattern: "^0x[a-fA-F0-9]{64}$",
 //       error: "finalizedBlock must be a 0x-prefixed 64-hex string",
 //     }),
 //   }),
 // })
 // .get("/legacy/avail-claim", ({ query }) => {}, {
 //   query: t.Object({
 //     blockNumber: t.Number(),
 //     messageId: t.Number(),
 //     amount: t.BigInt(),
 //   }),
 // })
 */
