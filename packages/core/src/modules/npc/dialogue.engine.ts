// dialogue.engine.ts

import type { ILoreProvider } from "../../provider.interface.js";
import type { LoreMessage }   from "../../types.js";
import type {
  NPCDefinition,
  GameContext,
  DialogueReply,
  DialogueMessage,
  NPCFlags,
  SpeakOptions,
  GameAction,
} from "./npc.types.js";
import { buildSystemPrompt } from "./prompt.js";
import { NPCMemoryStore }    from "./memory.js";

const EMOTION_MAP: Record<string, string[]> = {
  friendly:  ["welcome", "good to see", "friend", "glad", "happy", "pleased"],
  cautious:  ["careful", "danger", "warning", "watch out", "beware", "suspicious"],
  angry:     ["furious", "outrage", "how dare", "insolent", "enough"],
  sad:       ["sorry", "unfortunate", "lost", "miss", "regret"],
  excited:   ["incredible", "amazing", "wonderful", "fantastic", "extraordinary"],
  neutral:   [],
};

export class DialogueEngine {
  private memory: NPCMemoryStore;

  constructor(
    private readonly provider: ILoreProvider,
    memory?: NPCMemoryStore
  ) {
    this.memory = memory ?? new NPCMemoryStore();
  }

  async speak(
    npc:           NPCDefinition,
    playerMessage: string,
    context:       GameContext  = {},
    options:       SpeakOptions = {}
  ): Promise<DialogueReply> {

    const [history, flags] = await Promise.all([
      this.memory.getHistory(npc.id),
      this.memory.getFlags(npc.id),
    ]);

    const activeFlags: NPCFlags = { ...(npc.flags ?? {}), ...flags };
    const systemPrompt = buildSystemPrompt(npc, context, activeFlags);

    const messages: LoreMessage[] = [
      ...history.map((m): LoreMessage => ({
        role:    m.role === "player" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: playerMessage },
    ];

    const response = await this.provider.complete({
      messages,
      system:      systemPrompt,
      model:       options.model,
      maxTokens:   options.maxTokens,
      temperature: options.temperature ?? 0.8,
    });

    const replyText     = response.text.trim();
    const emotion       = this.inferEmotion(replyText);
    const actions       = this.extractActions(replyText, activeFlags);
    const memoryUpdates: NPCFlags = { metPlayer: true };

    const newMessages: DialogueMessage[] = [
      { role: "player", content: playerMessage, timestamp: Date.now() },
      { role: "npc",    content: replyText,     timestamp: Date.now() },
    ];

    await Promise.all([
      this.memory.appendHistory(npc.id, newMessages),
      this.memory.mergeFlags(npc.id, memoryUpdates),
    ]);

    return {
      text:    replyText,
      emotion,
      actions,
      memory:  memoryUpdates,
      history: [...history, ...newMessages],
    };
  }

  async *streamSpeak(
    npc:           NPCDefinition,
    playerMessage: string,
    context:       GameContext  = {},
    options:       SpeakOptions = {}
  ): AsyncGenerator<string, DialogueReply> {

    const [history, flags] = await Promise.all([
      this.memory.getHistory(npc.id),
      this.memory.getFlags(npc.id),
    ]);

    const activeFlags: NPCFlags = { ...(npc.flags ?? {}), ...flags };
    const systemPrompt = buildSystemPrompt(npc, context, activeFlags);

    const messages: LoreMessage[] = [
      ...history.map((m): LoreMessage => ({
        role:    m.role === "player" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: playerMessage },
    ];

    let fullText = "";
    for await (const token of this.provider.stream({
      messages,
      system:      systemPrompt,
      model:       options.model,
      maxTokens:   options.maxTokens,
      temperature: options.temperature ?? 0.8,
    })) {
      fullText += token;
      yield token;
    }

    const replyText     = fullText.trim();
    const emotion       = this.inferEmotion(replyText);
    const actions       = this.extractActions(replyText, activeFlags);
    const memoryUpdates: NPCFlags = { metPlayer: true };

    const newMessages: DialogueMessage[] = [
      { role: "player", content: playerMessage, timestamp: Date.now() },
      { role: "npc",    content: replyText,     timestamp: Date.now() },
    ];

    await Promise.all([
      this.memory.appendHistory(npc.id, newMessages),
      this.memory.mergeFlags(npc.id, memoryUpdates),
    ]);

    return {
      text:    replyText,
      emotion,
      actions,
      memory:  memoryUpdates,
      history: [...history, ...newMessages],
    };
  }

  private inferEmotion(text: string): string {
    const lower = text.toLowerCase();
    for (const [emotion, keywords] of Object.entries(EMOTION_MAP)) {
      if (emotion === "neutral") continue;
      if (keywords.some((kw) => lower.includes(kw))) return emotion;
    }
    return "neutral";
  }

  private extractActions(_text: string, _flags: NPCFlags): GameAction[] {
    return [];
  }
}
