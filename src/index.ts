import { Elysia, t } from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { getJobHistory, getLastJobStatus } from "../utils/db";
import { entrypoint } from "../scripts/entrypoint";
import { initiateWormholeBridge } from "../utils/wormhole";

const API_KEY =
  process.env.ADMIN_KEY ??
  (() => {
    console.error("Missing ADMIN_KEY env");
    process.exit(1);
  })();

const app = new Elysia()
  .guard({
    headers: t.Object({ "x-api-key": t.String() }),
  })
  .onBeforeHandle(({ headers, set }) => {
    if (headers["x-api-key"] !== API_KEY) {
      set.status = 401;
      return "Unauthorized";
    }
  })
  .use(
    cron({
      name: "rebalancer",
      pattern: Patterns.EVERY_10_SECONDS,
      protect: true,
      async run() {
        await entrypoint();
      },
      catch(e) {
        //this is mostly used for debugging right now, ideally entrypoint takes care of
        console.error(e);
      },
    }),
  )
  .get(
    "/stop",
    ({
      store: {
        cron: { rebalancer },
      },
    }) => {
      rebalancer.stop();
      return "stopped rebalancer script";
    },
  )
  .get(
    "/pause",
    ({
      store: {
        cron: { rebalancer },
      },
    }) => {
      rebalancer.pause();
      return "paused rebalancer script";
    },
  )
  .get(
    "/resume",
    ({
      store: {
        cron: { rebalancer },
      },
    }) => {
      rebalancer.resume();
      return "resumed rebalancer script";
    },
  )
  .get("/status", () => {
    const lastJob = getLastJobStatus();

    if (!lastJob) {
      return {
        status: "no_jobs",
        message: "No jobs have been run yet",
      };
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
  });
// .get("/legacy/eth-claim", ({ query }) => {}, {
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
// .get(
//   "legacy/wormhole-initiate",
//   ({ query }) => {
//     const initiateWormholeTxn = initiateWormholeBridge();
//   },
//   {
//     query: t.Object({
//       sourceChain: t.String(),
//       destinationChain: t.String(),
//       amount: t.String(),
//     }),
//   },
// );

app.listen(3000);
