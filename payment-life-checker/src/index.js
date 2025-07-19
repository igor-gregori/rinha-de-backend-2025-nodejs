import IORedis from "ioredis";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

let processorsStatus = {
  default: {},
  fallback: {},
};

async function processorsLifeChecker() {
  try {
    const [defaultResponse, fallbackResponse] = await Promise.all([
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    let updated = false;
    let newStatus = { ...processorsStatus };

    if (defaultResponse.ok) {
      const defaultResponseBody = await defaultResponse.json();
      if (JSON.stringify(processorsStatus.default) !== JSON.stringify(defaultResponseBody)) {
        newStatus.default = defaultResponseBody;
        updated = true;
      }
    } else {
      console.warn("Unable to verify status of default payment processor");
    }

    if (fallbackResponse.ok) {
      const fallbackResponseBody = await fallbackResponse.json();
      if (JSON.stringify(processorsStatus.fallback) !== JSON.stringify(fallbackResponseBody)) {
        newStatus.fallback = fallbackResponseBody;
        updated = true;
      }
    } else {
      console.warn("Unable to verify status of fallback payment processor");
    }

    if (updated) {
      processorsStatus = newStatus;
      await redisClient.set("processors-status", JSON.stringify(processorsStatus));
      console.info("Status of payment processors updated");
    }
  } catch (err) {
    if (err.name === "TimeoutError") {
      console.info("Timeout to verify status of processors");
    } else {
      console.error("Unable to verify status of processors", err);
    }
  }
}

const intervalId = setInterval(processorsLifeChecker, 500);

console.info("Processors life checker running");

process.on("SIGTERM", async () => {
  console.info("SIGTERM received. Stopping recursive life checker...");
  clearInterval(intervalId);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.info("SIGTERM received. Stopping recursive life checker...");
  clearInterval(intervalId);
  process.exit(0);
});
