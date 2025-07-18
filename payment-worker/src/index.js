import { Worker } from "bullmq";
import IORedis from "ioredis";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

// TODO: Find out how i handle with errors
// TODO: Find out how i handle with concurrency
const worker = new Worker(
  "payment",
  async (job) => {
    try {
      const payment = JSON.parse(job.data);

      const processorsStatusResponse = await redisClient.get("processors-status");
      const processorsStatus = JSON.parse(processorsStatusResponse);

      if (processorsStatus.default.failing === false) {
        await sendPayment(process.env.PAYMENT_PROCESSOR_URL_DEFAULT, payment);
        console.info("🟢 Payment processed with default processor");
      } else if (processorsStatus.fallback.failing === false) {
        await sendPayment(process.env.PAYMENT_PROCESSOR_URL_FALLBACK, payment);
        console.info("🟠 Payment processed with fallback processor");
      } else {
        console.warn("🔴 Payment not processed");
      }
    } catch (err) {
      console.error(err);
    }
  },
  {
    connection: redisClient,
    concurrency: 20,
  }
);

console.log("Worker started");

async function sendPayment(url, payment) {
  return fetch(`${url}/payments`, {
    method: "POST",
    body: JSON.stringify({
      correlationId: payment.correlationId,
      amount: payment.amount,
      requestedAt: new Date().toISOString(),
    }),
    headers: { "Content-Type": "application/json" },
  });
}

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
