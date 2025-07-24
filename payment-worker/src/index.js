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
  max: 100,
  min: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

// Circuit breaker simples para evitar tentativas desnecessárias
let circuitBreaker = {
  default: { failures: 0, lastFailure: 0, isOpen: false },
  fallback: { failures: 0, lastFailure: 0, isOpen: false },
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30s

function isCircuitOpen(processor) {
  const breaker = circuitBreaker[processor];
  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      breaker.failures = 0;
      breaker.isOpen = false;
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure(processor) {
  const breaker = circuitBreaker[processor];
  breaker.failures++;
  breaker.lastFailure = Date.now();
  breaker.isOpen = breaker.failures >= CIRCUIT_BREAKER_THRESHOLD;
}

function recordSuccess(processor) {
  const breaker = circuitBreaker[processor];
  breaker.failures = Math.max(0, breaker.failures - 1);
  breaker.isOpen = false;
}

async function sendPayment(url, payment) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${url}/payments`, {
      method: "POST",
      body: JSON.stringify({
        correlationId: payment.correlationId,
        amount: payment.amount,
        requestedAt: new Date().toISOString(),
      }),
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
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
      const payment = JSON.parse(job.data);
      const processorsStatusResponse = await redisClient.get("processors-status");
      const processorsStatus = JSON.parse(processorsStatusResponse) || { default: {}, fallback: {} };

      let processedBy = "";
      let response;

      const defaultIsFailing = !processorsStatus.default || processorsStatus.default.failing;
      const fallbackIsFailing = !processorsStatus.fallback || processorsStatus.fallback.failing;

      const defaultResponseTime = processorsStatus.default?.minimumResponseTime || 99999;
      const fallbackResponseTime = processorsStatus.fallback?.minimumResponseTime || 99999;

      const shouldUseDefault =
        !defaultIsFailing &&
        !isCircuitOpen("default") &&
        (fallbackIsFailing || isCircuitOpen("fallback") || defaultResponseTime <= fallbackResponseTime * 1.2);

      if (shouldUseDefault) {
        response = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_DEFAULT, payment);
        if (response.ok) {
          processedBy = "default";
          recordSuccess("default");
        } else {
          recordFailure("default");
        }
      }

      if (!processedBy && !fallbackIsFailing && !isCircuitOpen("fallback")) {
        response = await sendPayment(process.env.PAYMENT_PROCESSOR_URL_FALLBACK, payment);
        if (response.ok) {
          processedBy = "fallback";
          recordSuccess("fallback");
        } else {
          recordFailure("fallback");
        }
      }

      if (!processedBy) {
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
    concurrency: 100,
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
