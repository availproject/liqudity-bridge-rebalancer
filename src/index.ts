import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { entrypoint } from "../scripts/entrypoint";
import { getJobHistory, getLastJobStatus } from "../utils/db";

new Elysia()
  .use(
    cron({
      name: "rebalancer",
      pattern: "*/10 * * * * *",
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
  })
  .listen(3000);
