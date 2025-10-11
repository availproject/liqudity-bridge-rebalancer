import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { entrypoint } from "../scripts/entrypoint";

new Elysia()
  .use(
    cron({
      name: "rebalancer",
      pattern: "*/10 * * * * *",
      async run() {
        await entrypoint();
      },
      catch(e) {
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
      return "stop rebalancer script";
    },
  )
  .get(
    "/status",
    ({
      store: {
        cron: { rebalancer },
      },
    }) => {
      return "return the status of a current running cron";
    },
  )
  .listen(3000);
