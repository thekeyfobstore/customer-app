import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startSyncLoop } from "../openphone-sync";
import { startMessagePoller } from "../message-poller";
import { processMessageWebhook, registerWebhook, getExistingWebhook } from "../message-webhook";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Auto-register webhook with OpenPhone on server startup.
 * Uses the deployed domain as the webhook URL.
 */
async function autoRegisterWebhook() {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
    const apiKey = rows.length > 0 ? rows[0].value : null;
    if (!apiKey) {
      console.log("[Webhook] No API key configured, skipping auto-register");
      return;
    }

    // Use the deployed domain
    const webhookUrl = "https://custcrmapp-nxdjk2u8.manus.space/api/webhooks/openphone";

    const existingId = await getExistingWebhook(apiKey, webhookUrl);
    if (existingId) {
      console.log(`[Webhook] Already registered: ${existingId}`);
      return;
    }

    const result = await registerWebhook(apiKey, webhookUrl);
    if (result) {
      console.log(`[Webhook] Auto-registered: ${result.id} at ${result.url}`);
    } else {
      console.log("[Webhook] Auto-registration failed (will use polling fallback)");
    }
  } catch (err) {
    console.error("[Webhook] Auto-registration error:", err);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // OpenPhone message webhook endpoint
  app.post("/api/webhooks/openphone", async (req, res) => {
    try {
      console.log("[Webhook] Received OpenPhone event:", req.body?.type);
      await processMessageWebhook(req.body);
      res.json({ ok: true });
    } catch (err) {
      console.error("[Webhook] Error processing:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Endpoint to register the webhook with OpenPhone
  app.post("/api/webhooks/openphone/register", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database not available" });
        return;
      }
      const apiKeyResult = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
      const apiKey = apiKeyResult.length > 0 ? apiKeyResult[0].value : null;
      if (!apiKey) {
        res.status(400).json({ error: "OpenPhone API key not configured" });
        return;
      }

      const baseUrl = req.body?.baseUrl || `https://${req.headers.host}`;
      const webhookUrl = `${baseUrl}/api/webhooks/openphone`;

      // Check if already registered
      const existingId = await getExistingWebhook(apiKey, webhookUrl);
      if (existingId) {
        res.json({ ok: true, id: existingId, url: webhookUrl, status: "already_registered" });
        return;
      }

      const result = await registerWebhook(apiKey, webhookUrl);
      if (result) {
        res.json({ ok: true, ...result, status: "registered" });
      } else {
        res.status(500).json({ error: "Failed to register webhook" });
      }
    } catch (err) {
      console.error("[Webhook] Registration error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    // Start OpenPhone contact sync loop (every 2 minutes)
    startSyncLoop();
    // Start message poller (fallback for webhook — polls every 2 minutes)
    startMessagePoller();
    // Auto-register webhook with OpenPhone on startup
    autoRegisterWebhook();
  });
}

startServer().catch(console.error);
