// server.ts
// Lore sidecar — local REST server on localhost:7433.
// Boots Fastify, resolves the AI provider from config,
// and registers all routes.

import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig, resolveProvider } from "@lore/core";
import { RequestQueue } from "./queue.js";
import { healthRoutes }   from "./routes/health.routes.js";
import { completeRoutes } from "./routes/complete.routes.js";
import { streamRoutes }   from "./routes/stream.routes.js";

const PORT = 7433;
const HOST = "127.0.0.1"; // localhost only — never expose publicly

async function start(): Promise<void> {
  const config = loadConfig();

  console.log("[Lore] Starting sidecar...");
  const provider = await resolveProvider(config);

  // Boot Fastify
  const fastify = Fastify({
    logger: false, // we handle our own logging
  });

  // Allow requests from Unity/Unreal/etc local HTTP clients
  await fastify.register(cors, {
    origin: ["http://localhost", "http://127.0.0.1"],
  });

  const queue = new RequestQueue(5);

  await fastify.register(healthRoutes,   { provider });
  await fastify.register(completeRoutes, { provider, queue });
  await fastify.register(streamRoutes,   { provider });

  // listening 
  await fastify.listen({ port: PORT, host: HOST });

  console.log(`[Lore] Sidecar running on ${HOST}:${PORT}`);
  console.log(`[Lore] Provider: ${provider.name}`);
  console.log(`[Lore] Ready. Waiting for requests from your game engine.`);

  // shutdown
    const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Lore] ${signal} received. Shutting down...`);
    await fastify.close();
    console.log("[Lore] Sidecar stopped.");
    process.exit(0);
  };

  process.on("SIGINT",  () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err: unknown) => {
  console.error("[Lore] Failed to start sidecar:", err);
  process.exit(1);
});
