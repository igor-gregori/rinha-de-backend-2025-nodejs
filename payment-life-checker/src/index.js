import IORedis from "ioredis";

const redisClient = new IORedis({
  host: "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

let timeoutId;
const deplayInMs = 500;

function recursiveLifeChecker() {
  timeoutId = setTimeout(async () => {
    const res = await redisClient.ping();
    console.log(res);
    recursiveLifeChecker();
  }, deplayInMs);
}

recursiveLifeChecker();

console.log(`Recursive life checker running with ${deplayInMs}ms deplay is running`);

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Stopping recursive life checker...");
  clearTimeout(timeoutId);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGTERM received. Stopping recursive life checker...");
  clearTimeout(timeoutId);
  process.exit(0);
});
