import { Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

const pool = new Pool({
  user: "rinha",
  host: "postgres-backend",
  database: "rinha",
  password: "rinha",
  port: 5432,
  max: 20, // Número máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const worker = new Worker(
  "payment",
  async (job) => {
    const client = await pool.connect();

    try {
      const payment = JSON.parse(job.data);

      const processorsStatusResponse = await redisClient.get("processors-status");
      const processorsStatus = JSON.parse(processorsStatusResponse);
      console.log("processorsStatus =>", processorsStatus);

      let processedBy = "";
      if (processorsStatus.default.failing === false) {
        const defaultResponse = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_DEFAULT, payment);
        if (defaultResponse.ok) {
          console.info("🟢 Processed with default processor");
        }
        processedBy = "default";
      } else if (processorsStatus.fallback.failing === false) {
        const fallbackResponse = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_FALLBACK, payment);
        if (fallbackResponse.ok) {
          console.info("🟡 Processed with fallback processor");
        }
        processedBy = "fallback";
      } else {
        const err = new Error("Unable to process payment, need retry");
        err.code = "NEED-RETRY";
        throw err;
      }

      await client.query(
        `INSERT INTO processed_payments (correlation_id, amount, processed_by, processed_at)
         VALUES ($1, $2, $3, NOW())`,
        [payment.correlationId, payment.amount, processedBy]
      );
    } catch (err) {
      if (err.code === "NEED-RETRY") {
        console.warn("🔁 Requeing payment...");
        throw err;
      }
      console.error("Unknow payment processing error:", err);
    } finally {
      client.release();
    }
  },
  {
    connection: redisClient,
    concurrency: 1,
  }
);

console.info("Worker started");

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
  console.log("SIGTERM received. Closing worker and db pool...");
  await worker.close();
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Closing worker and db pool...");
  await worker.close();
  await pool.end();
  process.exit(0);
});
