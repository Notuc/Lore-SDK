// @lore/core — full public API

// Base types and interface
export type { LoreMessage, LoreRequest, LoreResponse, LoreErrorCode } from "./types.js";
export { LoreError }       from "./types.js";
export type { ILoreProvider } from "./provider.interface.js";

// Config and resolver
export type { LoreConfig, ProviderName } from "./config.js";
export { loadConfig, DEFAULT_CONFIG }    from "./config.js";
export type { ProviderFactory }          from "./resolver.js";
export { resolveProvider }               from "./resolver.js";

// NPC module
export type {
  NPCDefinition,
  NPCFlags,
  GameContext,
  GameAction,
  DialogueReply,
  DialogueMessage,
  SpeakOptions,
} from "./modules/npc/index.js";
export { buildSystemPrompt } from "./modules/npc/index.js";
export { NPCMemoryStore }    from "./modules/npc/index.js";
export { DialogueEngine }    from "./modules/npc/index.js";
