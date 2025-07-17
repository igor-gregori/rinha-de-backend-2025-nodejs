import { Worker } from "bullmq";
import IORedis from "ioredis";

import { setTimeout } from "timers/promises";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "payment",
  async (job) => {
    console.log("processando pagamento...");
    await setTimeout(100);
    console.log(job.data);
  },
  {
    connection: redisClient,
    concurrency: 20,
  }
);

worker.on("ready", () => {
  console.log("Worker ready");
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Closing worker...");
  await worker.close();
  process.exit(0);
});
