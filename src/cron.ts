import { Elysia, t } from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { entrypoint } from "../scripts/entrypoint";
import { Unkey } from "@unkey/api";

const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY,
});

const cronjob = new Elysia()
  .guard({
    headers: t.Object({ "x-api-key": t.String() }),
  })
  .onBeforeHandle(async ({ headers, set }) => {
    const result = await unkey.keys.verifyKey({
      key: headers["x-api-key"],
    });

    if (!result.data.valid) {
      set.status = 401;
      return `Api Key Verification Failed ${result.data.code}`;
    }
  })
  .use(
    cron({
      name: "rebalancer",
      pattern: Patterns.EVERY_HOUR,
      protect: true,
      async run() {
        await entrypoint();
      },
      catch(e) {
        console.error(e);
      },
    }),
  )
  .get("/", () => {
    return "cron health check ok";
  })
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
  .get(
    "/trigger-run",
    ({
      store: {
        cron: { rebalancer },
      },
    }) => {
      if (rebalancer.isRunning())
        return {
          status: "already_running",
          message: "Job is already executing.",
        };
      void rebalancer.trigger();
      return { status: "started", message: "Job has been initiated." };
    },
  );

cronjob.listen(3000);
