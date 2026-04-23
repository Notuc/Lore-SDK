import Fastify from "fastify";
import cors    from "@fastify/cors";
import { loadConfig, resolveProvider, NPCMemoryStore } from "@lore/core";
import { RequestQueue }   from "./queue.js";
import { healthRoutes }   from "./routes/health.routes.js";
import { completeRoutes } from "./routes/complete.routes.js";
import { streamRoutes }   from "./routes/stream.routes.js";
import { npcRoutes }      from "./routes/npc.routes.js";

const PORT = 7433;
const HOST = "127.0.0.1";

async function start(): Promise<void> {
  const config   = loadConfig();
  console.log("[Lore] Starting sidecar...");

  const provider = await resolveProvider(config);
  const memory   = new NPCMemoryStore();
  const fastify  = Fastify({ logger: false });
  const queue    = new RequestQueue(5);

  await fastify.register(cors, {
    origin: ["http://localhost", "http://127.0.0.1"],
  });

  await fastify.register(healthRoutes,   { provider });
  await fastify.register(completeRoutes, { provider, queue });
  await fastify.register(streamRoutes,   { provider });
  await fastify.register(npcRoutes,      { provider, memory });

  await fastify.listen({ port: PORT, host: HOST });

  console.log(`[Lore] Sidecar running on ${HOST}:${PORT}`);
  console.log(`[Lore] Provider: ${provider.name}`);
  console.log(`[Lore] Ready. Waiting for requests from your game engine.`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Lore] ${signal} received. Shutting down...`);
    await Promise.all([fastify.close(), memory.close()]);
    process.exit(0);
  };

  process.on("SIGINT",  () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err: unknown) => {
  console.error("[Lore] Failed to start sidecar:", err);
  process.exit(1);
});
