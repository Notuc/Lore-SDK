// ─────────────────────────────────────────────────────────────
// stream.routes.ts
// POST /stream — streams tokens via Server-Sent Events.
// Used for NPC dialogue so text appears word by word
// in the game UI rather than waiting for the full response.
//
// SSE format:
//   data: <token>\n\n        — each token as it arrives
//   data: [DONE]\n\n         — signals end of stream
//   data: [ERROR] <msg>\n\n  — if something goes wrong
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import type { ILoreProvider, LoreMessage } from "@lore/core";
import { LoreError } from "@lore/core";

type StreamBody = {
  messages:     LoreMessage[];
  model?:       string;
  maxTokens?:   number;
  temperature?: number;
  system?:      string;
};

export async function streamRoutes(
  fastify: FastifyInstance,
  opts: { provider: ILoreProvider }
): Promise<void> {
  fastify.post<{ Body: StreamBody }>("/stream", {
    schema: {
      body: {
        type:     "object",
        required: ["messages"],
        properties: {
          messages: {
            type:  "array",
            items: {
              type:       "object",
              required:   ["role", "content"],
              properties: {
                role:    { type: "string", enum: ["user", "assistant", "system"] },
                content: { type: "string" },
              },
            },
          },
          model:       { type: "string" },
          maxTokens:   { type: "number" },
          temperature: { type: "number" },
          system:      { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    // Set SSE headers
    void reply.raw.writeHead(200, {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering if proxied
    });

    try {
      for await (const token of opts.provider.stream(req.body)) {
        // Escape newlines in the token so SSE framing stays intact
        const safe = token.replace(/\n/g, "\\n");
        reply.raw.write(`data: ${safe}\n\n`);
      }

      reply.raw.write("data: [DONE]\n\n");
    } catch (err) {
      const message = err instanceof LoreError
        ? `[ERROR] ${err.code}: ${err.message}`
        : `[ERROR] UNKNOWN: ${String(err)}`;

      reply.raw.write(`data: ${message}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
}
