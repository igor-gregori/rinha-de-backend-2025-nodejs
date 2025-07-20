import { createServer } from "node:http";
import { Queue } from "bullmq";
import { Pool } from "pg";

const paymentQueue = new Queue("payment", {
  connection: {
    host: "redis",
    port: 6379,
  },
});

const pool = new Pool({
  user: "rinha",
  host: "postgres-backend",
  database: "rinha",
  password: "rinha",
  port: 5432,
  max: 10,
});

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthcheck") {
    res.statusCode = 200;
    return res.end();
  }
  if (req.method === "POST" && req.url === "/payments") {
    const body = await getBody(req);
    await paymentQueue.add("myJobName", body, {
      attempts: 10,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
    console.log("Payment sent to queue");
    res.statusCode = 201;
    return res.end();
  }
  if (req.method === "GET" && req.url.startsWith("/payments-summary")) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      let query = `
        SELECT processed_by,
               COUNT(*) AS totalRequests,
               COALESCE(SUM(amount), 0) AS totalAmount
        FROM processed_payments
      `;
      const params = [];
      if (from && to) {
        query += " WHERE processed_at BETWEEN $1 AND $2";
        params.push(from, to);
      } else if (from) {
        query += " WHERE processed_at >= $1";
        params.push(from);
      } else if (to) {
        query += " WHERE processed_at <= $1";
        params.push(to);
      }
      query += " GROUP BY processed_by";

      const { rows } = await pool.query(query, params);

      const summary = { default: { totalRequests: 0, totalAmount: 0 }, fallback: { totalRequests: 0, totalAmount: 0 } };
      for (const row of rows) {
        summary[row.processed_by] = {
          totalRequests: Number(row.totalrequests),
          totalAmount: Number(row.totalamount),
        };
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(summary));
    } catch (err) {
      console.error("Erro ao consultar pagamentos:", err);
      res.statusCode = 500;
      return res.end("Erro ao consultar pagamentos");
    }
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
