import type { FastifyInstance, FastifyReply } from "fastify";
import type { ILoreProvider, LoreMessage } from "@lore/core";
import { LoreError } from "@lore/core";
import type { RequestQueue } from "../queue.js";

type CompleteBody = {
  messages:     LoreMessage[];
  model?:       string;
  maxTokens?:   number;
  temperature?: number;
  system?:      string;
};

export async function completeRoutes(
  fastify: FastifyInstance,
  opts: { provider: ILoreProvider; queue: RequestQueue }
): Promise<void> {
  fastify.post<{ Body: CompleteBody }>("/complete", {
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
    try {
      const response = await opts.queue.add(() =>
        opts.provider.complete(req.body)
      );
      return reply.status(200).send(response);
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

function handleError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof LoreError) {
    const status =
      err.code === "AUTH_FAILED"          ? 401
      : err.code === "RATE_LIMITED"       ? 429
      : err.code === "PROVIDER_UNREACHABLE" ? 503
      : err.code === "CONTEXT_TOO_LONG"   ? 400
      : 500;

    return reply.status(status).send({
      error:   err.code,
      message: err.message,
    });
  }

  return reply.status(500).send({
    error:   "UNKNOWN",
    message: String(err),
  });
}
