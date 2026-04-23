// End-to-end tests for the full NPC dialogue flow.
// Verifies speak() → memory → prompt → provider → reply.
// All mocked — no real provider or database calls.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DialogueEngine }  from "../dialogue.engine.js";
import { NPCMemoryStore }  from "../memory.js";
import type { ILoreProvider, LoreRequest } from "../../../provider.interface.js";
import type { NPCDefinition } from "../npc.types.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Test NPC definitions ─

const ELARA: NPCDefinition = {
  id:          "elara",
  name:        "Elara",
  role:        "merchant",
  personality: ["shrewd", "warm", "street-smart"],
  knowledge:   ["trade routes", "city gossip", "rare goods"],
  backstory:   "A seasoned trader who trusts no one fully.",
  world: {
    setting:    "a medieval fantasy kingdom",
    technology: "swords, magic, alchemy",
    unknowns:   ["computers", "AI", "guns"],
  },
};

const ZARA: NPCDefinition = {
  id:          "zara-7",
  name:        "Zara-7",
  role:        "arms dealer",
  personality: ["calculating", "ruthless"],
  knowledge:   ["black market weapons", "corporate factions"],
  world: {
    setting:    "a space station in 2387",
    technology: "laser weapons, neural implants, FTL drives",
    unknowns:   ["magic", "swords"],
  },
};

// Mock provider factory 

function makeMockProvider(responseText: string): ILoreProvider {
  return {
    name:     "mock",
    complete: vi.fn().mockResolvedValue({
      text:   responseText,
      model:  "mock-model",
      tokens: { input: 20, output: 10 },
    }),
    stream:  async function* () { yield responseText; },
    health:  vi.fn().mockResolvedValue(true),
  };
}

// Test setup 

let tmpDir:  string;
let memory:  NPCMemoryStore;
let provider: ILoreProvider;
let engine:  DialogueEngine;

beforeEach(() => {
  tmpDir   = mkdtempSync(join(tmpdir(), "lore-integration-"));
  memory   = new NPCMemoryStore(tmpDir);
  provider = makeMockProvider("What do you need, traveler?");
  engine   = new DialogueEngine(provider, memory);
});

afterEach(async () => {
  await memory.close();
  rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// Tests 

describe("DialogueEngine — full speak() flow", () => {

  it("returns a complete DialogueReply", async () => {
    const reply = await engine.speak(ELARA, "Hello");

    expect(reply).toMatchObject({
      text:    expect.any(String),
      emotion: expect.any(String),
      actions: expect.any(Array),
      memory:  expect.any(Object),
      history: expect.any(Array),
    });
  });

  it("passes the system prompt to the provider", async () => {
    await engine.speak(ELARA, "What do you sell?");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toBeDefined();
    expect(callArg.system).toContain("Elara");
    expect(callArg.system).toContain("merchant");
  });

  it("includes NPC world setting in the system prompt", async () => {
    await engine.speak(ELARA, "What do you sell?");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("medieval fantasy kingdom");
  });

  it("includes sci-fi world setting for Zara", async () => {
    await engine.speak(ZARA, "What are you selling?");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("space station");
    expect(callArg.system).toContain("2387");
  });

  it("passes player message as the last user message", async () => {
    await engine.speak(ELARA, "Do you have rare goods?");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    const lastMsg = callArg.messages.at(-1);
    expect(lastMsg?.role).toBe("user");
    expect(lastMsg?.content).toBe("Do you have rare goods?");
  });

  it("sets metPlayer flag after first speak()", async () => {
    await engine.speak(ELARA, "Hello");

    const flags = await memory.getFlags("elara");
    expect(flags["metPlayer"]).toBe(true);
  });

  it("persists conversation to history after speak()", async () => {
    await engine.speak(ELARA, "Hello");

    const history = await memory.getHistory("elara");
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe("player");
    expect(history[0]?.content).toBe("Hello");
    expect(history[1]?.role).toBe("npc");
  });

  it("includes previous history in subsequent speak() calls", async () => {
    await engine.speak(ELARA, "Hello");
    await engine.speak(ELARA, "What do you sell?");

    const callArg = vi.mocked(provider.complete).mock.calls[1]?.[0] as LoreRequest;

    // Should have: 2 history messages + new player message = 3
    const userAndAssistantMessages = callArg.messages.filter(
      m => m.role === "user" || m.role === "assistant"
    );
    expect(userAndAssistantMessages.length).toBeGreaterThanOrEqual(3);
  });

  it("history grows with each speak() call", async () => {
    await engine.speak(ELARA, "Hello");
    await engine.speak(ELARA, "What do you sell?");
    await engine.speak(ELARA, "Any rare goods?");

    const history = await memory.getHistory("elara");
    expect(history).toHaveLength(6); // 2 messages per speak()
  });
});

describe("DialogueEngine — game context", () => {

  it("includes timeOfDay in system prompt when provided", async () => {
    await engine.speak(ELARA, "Hello", { timeOfDay: "midnight" });

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("midnight");
  });

  it("includes playerMood in system prompt when provided", async () => {
    await engine.speak(ELARA, "Give me your best price", { playerMood: "aggressive" });

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("aggressive");
  });

  it("includes location in system prompt when provided", async () => {
    await engine.speak(ELARA, "Hello", { location: "the docks" });

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("the docks");
  });

  it("includes active quest in system prompt when provided", async () => {
    await engine.speak(ELARA, "Hello", { questActive: "find-the-artifact" });

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("find-the-artifact");
  });
});

describe("DialogueEngine — flag awareness", () => {

  it("merges NPC definition flags with persisted flags", async () => {
    const npcWithFlags: NPCDefinition = {
      ...ELARA,
      flags: { owesDebt: true, debtAmount: 50 },
    };

    await engine.speak(npcWithFlags, "Hello");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("owesDebt");
  });

  it("persisted flags appear in subsequent speak() calls", async () => {
    // Set a flag directly
    await memory.setFlag("elara", "questGiven", true);

    await engine.speak(ELARA, "Any news?");

    const callArg = vi.mocked(provider.complete).mock.calls[0]?.[0] as LoreRequest;
    expect(callArg.system).toContain("questGiven");
  });
});

describe("DialogueEngine — emotion inference", () => {
  const cases = [
    { text: "Welcome friend, good to see you!",    expected: "friendly"  },
    { text: "Be careful, danger lurks nearby.",    expected: "cautious"  },
    { text: "How dare you speak to me that way!",  expected: "angry"     },
    { text: "I'm sorry for your loss.",            expected: "sad"       },
    { text: "That's incredible news!",             expected: "excited"   },
    { text: "The price is ten gold.",              expected: "neutral"   },
  ] as const;

  for (const { text, expected } of cases) {
    it(`infers '${expected}' from "${text.slice(0, 40)}..."`, async () => {
      provider = makeMockProvider(text);
      engine   = new DialogueEngine(provider, memory);

      const reply = await engine.speak(ELARA, "Hello");
      expect(reply.emotion).toBe(expected);
    });
  }
});

describe("DialogueEngine — NPC isolation", () => {

  it("two NPCs have independent history", async () => {
    await engine.speak(ELARA, "Hello Elara");
    await engine.speak(ZARA,  "Hello Zara");

    const elaraHistory = await memory.getHistory("elara");
    const zaraHistory  = await memory.getHistory("zara-7");

    expect(elaraHistory[0]?.content).toBe("Hello Elara");
    expect(zaraHistory[0]?.content).toBe("Hello Zara");
    expect(elaraHistory).toHaveLength(2);
    expect(zaraHistory).toHaveLength(2);
  });

  it("two NPCs have independent flags", async () => {
    await engine.speak(ELARA, "Hello");
    await engine.speak(ZARA,  "Hello");

    const elaraFlags = await memory.getFlags("elara");
    const zaraFlags  = await memory.getFlags("zara-7");

    expect(elaraFlags["metPlayer"]).toBe(true);
    expect(zaraFlags["metPlayer"]).toBe(true);

    // Set a flag on Elara only
    await memory.setFlag("elara", "questGiven", true);

    const zaraFlagsAfter = await memory.getFlags("zara-7");
    expect(zaraFlagsAfter["questGiven"]).toBeUndefined();
  });
});
