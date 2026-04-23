import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt.js";
import type { NPCDefinition } from "../npc.types.js";

const ELARA: NPCDefinition = {
  id:          "elara",
  name:        "Elara",
  role:        "merchant",
  personality: ["shrewd", "warm", "street-smart"],
  knowledge:   ["trade routes", "city gossip", "rare goods"],
  backstory:   "A traveler who trusts no one fully but never turns away a customer.",
  world: {
    setting:    "a medieval fantasy kingdom",
    technology: "swords, magic, and alchemy",
    unknowns:   ["computers", "AI", "guns", "electricity"],
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
    unknowns:   ["magic", "swords", "horses"],
  },
};

describe("buildSystemPrompt — identity", () => {
  it("includes NPC name", () => {
    expect(buildSystemPrompt(ELARA)).toContain("Elara");
  });

  it("includes NPC role", () => {
    expect(buildSystemPrompt(ELARA)).toContain("merchant");
  });

  it("includes personality traits", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("shrewd");
    expect(prompt).toContain("warm");
  });

  it("includes backstory when provided", () => {
    expect(buildSystemPrompt(ELARA)).toContain("trusts no one fully");
  });

  it("includes knowledge domains", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("trade routes");
    expect(prompt).toContain("city gossip");
  });
});

describe("buildSystemPrompt — world context", () => {
  it("includes fantasy world setting for Elara", () => {
    expect(buildSystemPrompt(ELARA)).toContain("medieval fantasy kingdom");
  });

  it("includes sci-fi world setting for Zara", () => {
    expect(buildSystemPrompt(ZARA)).toContain("space station");
    expect(buildSystemPrompt(ZARA)).toContain("2387");
  });

  it("includes technology for Elara's world", () => {
    expect(buildSystemPrompt(ELARA)).toContain("alchemy");
  });

  it("includes technology for Zara's world", () => {
    expect(buildSystemPrompt(ZARA)).toContain("neural implants");
  });

  it("includes unknowns list in anti-AI block", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("computers");
    expect(prompt).toContain("AI");
  });

  it("uses default world when no world is provided", () => {
    const npcNoWorld: NPCDefinition = {
      id:          "bare",
      name:        "Bare",
      role:        "guard",
      personality: ["stern"],
      knowledge:   ["patrol routes"],
    };
    const prompt = buildSystemPrompt(npcNoWorld);
    expect(prompt).toContain("fictional game world");
  });
});

describe("buildSystemPrompt — anti-AI block", () => {
  it("contains never say you are an AI instruction", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("NOT an AI");
  });

  it("contains the rule repeated in rules section", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("Never say you are an AI");
  });

  it("contains few-shot wrong response examples", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("NEVER DO THIS");
    expect(prompt).toContain("AI language model");
  });
});

describe("buildSystemPrompt — game context injection", () => {
  it("includes timeOfDay when provided", () => {
    const prompt = buildSystemPrompt(ELARA, { timeOfDay: "midnight" });
    expect(prompt).toContain("midnight");
  });

  it("includes location when provided", () => {
    const prompt = buildSystemPrompt(ELARA, { location: "the docks" });
    expect(prompt).toContain("the docks");
  });

  it("includes playerMood when provided", () => {
    const prompt = buildSystemPrompt(ELARA, { playerMood: "aggressive" });
    expect(prompt).toContain("aggressive");
  });

  it("includes active flags", () => {
    const prompt = buildSystemPrompt(ELARA, {}, { metPlayer: true, questGiven: false });
    expect(prompt).toContain("metPlayer");
  });

  it("omits context section when nothing is provided", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).not.toContain("CURRENT SITUATION");
  });
});

describe("buildSystemPrompt — output format", () => {
  it("instructs plain spoken words only", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("plain spoken words");
  });

  it("instructs no markdown formatting", () => {
    const prompt = buildSystemPrompt(ELARA);
    expect(prompt).toContain("No lists, no asterisks");
  });
});
