import { createServer } from "node:http";
import { Queue } from "bullmq";
import { Pool } from "pg";

const paymentQueue = new Queue("payment", {
  connection: {
    host: "redis",
    port: 6379,
  },
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 100,
  },
});

const pool = new Pool({
  user: "rinha",
  host: "postgres-backend",
  database: "rinha",
  password: "rinha",
  port: 5432,
  max: 20, // Aumentado para alta carga
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const server = createServer(async (req, res) => {
  req.setTimeout(5000);
  res.setTimeout(5000);

  if (req.method === "GET" && req.url === "/healthcheck") {
    res.statusCode = 200;
    return res.end();
  }
  if (req.method === "POST" && req.url === "/payments") {
    try {
      const body = await getBody(req);

      // Adicionar à fila com prioridade para alta carga
      await paymentQueue.add("p", body, {
        attempts: 15, // Reduzido para processar mais rápido
        backoff: {
          type: "exponential",
          delay: 150, // Reduzido delay inicial
        },
        priority: 0,
      });

      res.statusCode = 201;
      return res.end();
    } catch (err) {
      console.error("Payment processing error:", err);
      res.statusCode = 500;
      return res.end('{"error":"Internal server error"}');
    }
  }
  if (req.method === "GET" && req.url.startsWith("/payments-summary")) {
    const client = await pool.connect();
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

      const { rows } = await client.query(query, params);

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
    } finally {
      client.release();
    }
  }
  if (req.method === "DELETE" && req.url === "/payments") {
    const client = await pool.connect();
    try {
      await client.query("TRUNCATE TABLE processed_payments");
      res.statusCode = 204;
      return res.end();
    } catch (err) {
      console.error("Erro ao limpar pagamentos:", err);
      res.statusCode = 500;
      return res.end("Erro ao limpar pagamentos");
    } finally {
      client.release();
    }
  }
  res.statusCode = 404;
  return res.end();
});

server.listen(3000, () => {
  console.log("Listening on 3000");
});

// Configurações do servidor para alta carga
server.keepAliveTimeout = 30000; // 30s
server.headersTimeout = 31000; // 31s (deve ser maior que keepAliveTimeout)
server.timeout = 10000; // 10s para requisições individuais
server.maxHeadersCount = 20;

function getBody(request) {
  return new Promise((resolve, reject) => {
    const bodyParts = [];
    let body;
    let totalSize = 0;
    const maxSize = 1024 * 1024; // 1MB limit

    request
      .on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          reject(new Error("Request too large"));
          return;
        }
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        resolve(body);
      })
      .on("error", (err) => {
        reject(err);
      });

    // Timeout para evitar requisições que ficam penduradas
    setTimeout(() => {
      reject(new Error("Request timeout"));
    }, 5000);
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
