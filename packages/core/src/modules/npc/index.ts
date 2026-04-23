export type {
  NPCDefinition,
  NPCFlags,
  GameContext,
  GameAction,
  DialogueReply,
  DialogueMessage,
  SpeakOptions,
} from "./npc.types.js";

export { buildSystemPrompt } from "./prompt.js";
export { NPCMemoryStore }    from "./memory.js";
export { DialogueEngine }    from "./dialogue.engine.js";
