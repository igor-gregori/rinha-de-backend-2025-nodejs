import IORedis from "ioredis";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

let timeoutId;
const deplayInMs = 500;

let processorsStatus = {
  default: {},
  fallback: {},
};

// TODO: Maybe i can use setInterval and work with AbortSignal
function recursiveLifeChecker() {
  timeoutId = setTimeout(async () => {
    const [defaultResponse, fallbackResponse] = await Promise.all([
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`),
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`),
    ]);
    if (defaultResponse.ok) {
      const defaultResponseBody = await defaultResponse.json();
      processorsStatus.default = defaultResponseBody;
    } else {
      console.warn("Unable to verify status of default payment processor");
    }
    if (fallbackResponse.ok) {
      const fallbackResponseBody = await fallbackResponse.json();
      processorsStatus.fallback = fallbackResponseBody;
    } else {
      console.warn("Unable to verify status of fallback payment processor");
    }
    await redisClient.set("processors-status", JSON.stringify(processorsStatus));
    console.info("Status of payment processors updated");
    recursiveLifeChecker();
  }, deplayInMs);
}

recursiveLifeChecker();

console.info(`Recursive life checker running with ${deplayInMs}ms deplay is running`);

process.on("SIGTERM", async () => {
  console.info("SIGTERM received. Stopping recursive life checker...");
  clearTimeout(timeoutId);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.info("SIGTERM received. Stopping recursive life checker...");
  clearTimeout(timeoutId);
  process.exit(0);
});
