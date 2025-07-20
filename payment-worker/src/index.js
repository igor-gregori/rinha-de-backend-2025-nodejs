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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function sendPayment(url, payment) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${url}/payments`, {
      method: "POST",
      body: JSON.stringify({
        correlationId: payment.correlationId,
        amount: payment.amount,
        requestedAt: new Date().toISOString(),
      }),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: err.name === "AbortError" ? 408 : 500 };
  }
}

const worker = new Worker(
  "payment",
  async (job) => {
    const client = await pool.connect();
    try {
      const payment = typeof job.data === "string" ? JSON.parse(job.data) : job.data;
      const processorsStatusResponse = await redisClient.get("processors-status");
      const processorsStatus = JSON.parse(processorsStatusResponse);

      let processedBy = "";
      let response;

      if (processorsStatus.default && processorsStatus.default.failing === false) {
        response = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_DEFAULT, payment);
        if (response.ok) {
          processedBy = "default";
          console.info("🟢 Processed with default processor");
        } else {
          console.warn(`Default processor failed: ${response.status}`);
        }
      }

      if (!processedBy && processorsStatus.fallback && processorsStatus.fallback.failing === false) {
        response = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_FALLBACK, payment);
        if (response.ok) {
          processedBy = "fallback";
          console.info("🟡 Processed with fallback processor");
        } else {
          console.warn(`Fallback processor failed: ${response.status}`);
        }
      }

      if (!processedBy) {
        const err = new Error("Unable to process payment, need retry");
        err.code = "NEED-RETRY";
        throw err;
      }

      await client.query(
        `INSERT INTO processed_payments (correlation_id, amount, processed_by, processed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (correlation_id) DO NOTHING`,
        [payment.correlationId, payment.amount, processedBy]
      );
    } catch (err) {
      if (err.code === "NEED-RETRY") {
        console.warn("🔁 Requeuing payment...");
        throw err;
      }
      console.error("Unknown payment processing error:", err);
    } finally {
      client.release();
    }
  },
  {
    connection: redisClient,
    concurrency: 10,
  }
);

console.info("Worker started");

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
