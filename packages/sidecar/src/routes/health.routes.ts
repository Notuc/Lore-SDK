// health.routes.ts
// GET /health — returns sidecar and provider status.
// Called by engine SDKs on startup to verify the sidecar
// is running and which provider is active.

import type { FastifyInstance } from "fastify";
import type { ILoreProvider } from "@lore/core";

export async function healthRoutes(
  fastify: FastifyInstance,
  opts: { provider: ILoreProvider }
): Promise<void> {
  fastify.get("/health", async (_req, reply) => {
    const alive = await opts.provider.health();

    return reply.status(alive ? 200 : 503).send({
      status:   alive ? "ok" : "degraded",
      provider: opts.provider.name,
      version:  "0.1.0",
    });
  });
}
