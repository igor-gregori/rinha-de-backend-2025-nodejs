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

let lastCheck = 0;
const CACHE_TTL = 4800; // Cache por 4.8s para evitar rate limiting

async function processorsLifeChecker() {
  const now = Date.now();

  // Cache inteligente - só faz nova requisição se passou o tempo mínimo
  if (now - lastCheck < CACHE_TTL) {
    return;
  }

  lastCheck = now;
  let updated = false;
  let newStatus = structuredClone(processorsStatus); // Deep copy

  console.log("Checking processors status...");

  try {
    const [defaultResponse, fallbackResponse] = await Promise.allSettled([
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`),
      fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`),
    ]);

    console.log("defaultResponse => ", defaultResponse);
    console.log("fallbackResponse => ", fallbackResponse);

    // Default Processor
    if (defaultResponse.status === "fulfilled" && defaultResponse.value.ok) {
      const defaultResponseBody = await defaultResponse.value.json();
      if (JSON.stringify(newStatus.default) !== JSON.stringify(defaultResponseBody)) {
        newStatus.default = defaultResponseBody;
        updated = true;
      }
    } else {
      if (!newStatus.default.failing) {
        newStatus.default.failing = true;
        updated = true;
      }
    }

    // Fallback Processor
    if (fallbackResponse.status === "fulfilled" && fallbackResponse.value.ok) {
      const fallbackResponseBody = await fallbackResponse.value.json();
      if (JSON.stringify(newStatus.fallback) !== JSON.stringify(fallbackResponseBody)) {
        newStatus.fallback = fallbackResponseBody;
        updated = true;
      }
    } else {
      if (!newStatus.fallback.failing) {
        newStatus.fallback.failing = true;
        updated = true;
      }
    }

    if (updated) {
      processorsStatus = newStatus;
      await redisClient.set("processors-status", JSON.stringify(processorsStatus));
      console.log("Updated processors status:", JSON.stringify(processorsStatus));
    } else {
      console.log("No updates needed. Current status:", JSON.stringify(processorsStatus));
    }
  } catch (err) {
    console.error("Unable to verify status of processors", err);
  }
}

processorsLifeChecker();

const intervalId = setInterval(processorsLifeChecker, 5050);

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
