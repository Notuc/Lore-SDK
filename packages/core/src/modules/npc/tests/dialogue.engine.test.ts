import { describe, it, expect, vi, beforeEach } from "vitest";
import { DialogueEngine }  from "../dialogue.engine.js";
import { NPCMemoryStore }  from "../memory.js";
import type { ILoreProvider } from "../../../provider.interface.js";
import type { NPCDefinition } from "../npc.types.js";

//  Mock provider 
function makeMockProvider(responseText: string): ILoreProvider {
  return {
    name:     "mock",
    complete: vi.fn().mockResolvedValue({
      text:   responseText,
      model:  "mock-model",
      tokens: { input: 10, output: 20 },
    }),
    stream:  async function* () { yield responseText; },
    health:  vi.fn().mockResolvedValue(true),
  };
}

// Mock memory store 
function makeMockMemory(): NPCMemoryStore {
  const historyStore: Record<string, string> = {};
  const flagsStore:   Record<string, string> = {};

  return {
    getHistory:    vi.fn().mockImplementation(async (id: string) => {
      return historyStore[id] ? JSON.parse(historyStore[id]) : [];
    }),
    appendHistory: vi.fn().mockImplementation(async (id: string, msgs: unknown) => {
      const existing = historyStore[id] ? JSON.parse(historyStore[id]) : [];
      historyStore[id] = JSON.stringify([...existing, ...msgs as unknown[]]);
    }),
    getFlags:      vi.fn().mockImplementation(async (id: string) => {
      return flagsStore[id] ? JSON.parse(flagsStore[id]) : {};
    }),
    mergeFlags:    vi.fn().mockImplementation(async (id: string, updates: unknown) => {
      const existing = flagsStore[id] ? JSON.parse(flagsStore[id]) : {};
      flagsStore[id] = JSON.stringify({ ...existing, ...(updates as object) });
    }),
    setFlag:       vi.fn(),
    clearAll:      vi.fn(),
    clearHistory:  vi.fn(),
    close:         vi.fn(),
  } as unknown as NPCMemoryStore;
}

const elara: NPCDefinition = {
  id:          "elara",
  name:        "Elara",
  role:        "merchant",
  personality: ["shrewd", "warm"],
  knowledge:   ["trade routes"],
};

describe("DialogueEngine", () => {
  let provider: ILoreProvider;
  let memory:   NPCMemoryStore;
  let engine:   DialogueEngine;

  beforeEach(() => {
    provider = makeMockProvider("Welcome, traveler. What can I do for you?");
    memory   = makeMockMemory();
    engine   = new DialogueEngine(provider, memory);
  });

  it("returns a valid DialogueReply", async () => {
    const reply = await engine.speak(elara, "Hello");

    expect(reply.text).toBe("Welcome, traveler. What can I do for you?");
    expect(reply.emotion).toBe("friendly");
    expect(Array.isArray(reply.actions)).toBe(true);
    expect(Array.isArray(reply.history)).toBe(true);
  });

  it("appends messages to history after speak()", async () => {
    await engine.speak(elara, "Hello");

    expect(memory.appendHistory).toHaveBeenCalledWith(
      "elara",
      expect.arrayContaining([
        expect.objectContaining({ role: "player", content: "Hello" }),
        expect.objectContaining({ role: "npc" }),
      ])
    );
  });

  it("sets metPlayer flag after first conversation", async () => {
    await engine.speak(elara, "Hello");

    expect(memory.mergeFlags).toHaveBeenCalledWith(
      "elara",
      expect.objectContaining({ metPlayer: true })
    );
  });

  it("passes game context to the provider via system prompt", async () => {
    await engine.speak(elara, "Hello", { timeOfDay: "night", playerMood: "aggressive" });

    const callArgs = vi.mocked(provider.complete).mock.calls[0]?.[0];
    expect(callArgs?.system).toContain("night");
    expect(callArgs?.system).toContain("aggressive");
  });

  it("infers 'cautious' emotion from cautious language", async () => {
    provider = makeMockProvider("Be careful around here, danger lurks in the shadows.");
    engine   = new DialogueEngine(provider, memory);

    const reply = await engine.speak(elara, "Is it safe?");
    expect(reply.emotion).toBe("cautious");
  });

  it("history grows with each speak() call", async () => {
    await engine.speak(elara, "Hello");
    await engine.speak(elara, "What do you sell?");

    expect(memory.appendHistory).toHaveBeenCalledTimes(2);
  });
});
