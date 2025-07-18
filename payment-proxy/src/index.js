import { createServer } from "node:http";
import { Queue } from "bullmq";

const paymentQueue = new Queue("payment", {
  connection: {
    host: "redis",
    port: 6379,
  },
});

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthcheck") {
    res.statusCode = 200;
    return res.end();
  }
  if (req.method === "POST" && req.url === "/payments") {
    const body = await getBody(req);
    await paymentQueue.add("myJobName", body);
    console.log("payment sent to queue");
    res.statusCode = 201;
    return res.end();
  }
  res.statusCode = 404;
  return res.end();
});

server.listen(3000, () => {
  console.log("Listening on 3000");
});

function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        resolve(body);
      });
  });
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing server...");
  await paymentQueue.close();
  server.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Closing server...");
  await paymentQueue.close();
  server.close();
  process.exit(0);
});
