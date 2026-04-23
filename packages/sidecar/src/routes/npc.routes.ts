// Sidecar routes for the NPC dialogue module.

import type { FastifyInstance } from "fastify";
import { DialogueEngine }  from "@lore/core";
import { NPCMemoryStore }  from "@lore/core";
import { LoreError }       from "@lore/core";
import type {
  NPCDefinition,
  GameContext,
  SpeakOptions,
} from "@lore/core";
import type { ILoreProvider } from "@lore/core";

type SpeakBody = {
  npc:           NPCDefinition;
  playerMessage: string;
  context?:      GameContext;
  options?:      SpeakOptions;
};

type FlagBody = {
  key:   string;
  value: boolean | string | number;
};

export async function npcRoutes(
  fastify: FastifyInstance,
  opts:    { provider: ILoreProvider; memory: NPCMemoryStore }
): Promise<void> {

  const engine = new DialogueEngine(opts.provider, opts.memory);

  // POST /npc/speak 
  // Main dialogue endpoint. Takes an NPC definition, player
  // message, and optional context. Returns a DialogueReply.

  fastify.post<{ Body: SpeakBody }>("/npc/speak", {
    schema: {
      body: {
        type:     "object",
        required: ["npc", "playerMessage"],
        properties: {
          npc: {
            type:     "object",
            required: ["id", "name", "role", "personality", "knowledge"],
          },
          playerMessage: { type: "string" },
          context:       { type: "object" },
          options:       { type: "object" },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { npc, playerMessage, context, options } = req.body;

      // Stream if requested
      if (options?.stream) {
        void reply.raw.writeHead(200, {
          "Content-Type":      "text/event-stream",
          "Cache-Control":     "no-cache",
          "Connection":        "keep-alive",
          "X-Accel-Buffering": "no",
        });

        const gen = engine.streamSpeak(npc, playerMessage, context, options);

        let result = await gen.next();
        while (!result.done) {
          const safe = (result.value as string).replace(/\n/g, "\\n");
          reply.raw.write(`data: ${safe}\n\n`);
          result = await gen.next();
        }

        // Send final reply as a JSON SSE event
        reply.raw.write(
          `event: reply\ndata: ${JSON.stringify(result.value)}\n\n`
        );
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
        return;
      }

      const dialogueReply = await engine.speak(
        npc, playerMessage, context, options
      );
      return reply.status(200).send(dialogueReply);

    } catch (err) {
      if (err instanceof LoreError) {
        return reply.status(500).send({
          error:   err.code,
          message: err.message,
        });
      }
      return reply.status(500).send({
        error:   "UNKNOWN",
        message: String(err),
      });
    }
  });

  //  POST /npc/:id/flag 
  // Update a single flag on an NPC.
  // Used when game events should affect future dialogue.

  fastify.post<{ Params: { id: string }; Body: FlagBody }>(
    "/npc/:id/flag",
    async (req, reply) => {
      const { id }         = req.params;
      const { key, value } = req.body;

      await opts.memory.setFlag(id, key, value);
      return reply.status(200).send({ ok: true, npcId: id, key, value });
    }
  );

  // GET /npc/:id/history 
  // Returns full conversation history for an NPC.
  // Useful for debugging and game UIs that show chat logs.

  fastify.get<{ Params: { id: string } }>(
    "/npc/:id/history",
    async (req, reply) => {
      const history = await opts.memory.getHistory(req.params.id);
      return reply.status(200).send({ npcId: req.params.id, history });
    }
  );

  // DELETE /npc/:id/memory
  // Wipes all history and flags for an NPC.
  // Use at the start of a new game session.

  fastify.delete<{ Params: { id: string } }>(
    "/npc/:id/memory",
    async (req, reply) => {
      await opts.memory.clearAll(req.params.id);
      return reply.status(200).send({ ok: true, npcId: req.params.id });
    }
  );
}
