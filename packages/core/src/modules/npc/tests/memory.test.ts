// Tests for NPCMemoryStore — history and flag persistence.
// Uses a temp directory so no real .lore/ folder is created.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NPCMemoryStore } from "../memory.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let tmpDir:  string;
let memory:  NPCMemoryStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "lore-test-"));
  memory = new NPCMemoryStore(tmpDir);
});

afterEach(async () => {
  await memory.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("NPCMemoryStore — history", () => {
  it("returns empty array for unknown NPC", async () => {
    const history = await memory.getHistory("unknown-npc");
    expect(history).toEqual([]);
  });

  it("persists and retrieves history", async () => {
    await memory.appendHistory("elara", [
      { role: "player", content: "Hello",        timestamp: 1000 },
      { role: "npc",    content: "Hi traveler.", timestamp: 1001 },
    ]);

    const history = await memory.getHistory("elara");
    expect(history).toHaveLength(2);
    expect(history[0]?.content).toBe("Hello");
    expect(history[1]?.content).toBe("Hi traveler.");
  });

  it("appends to existing history", async () => {
    await memory.appendHistory("elara", [
      { role: "player", content: "First message", timestamp: 1000 },
    ]);
    await memory.appendHistory("elara", [
      { role: "npc", content: "First reply", timestamp: 1001 },
    ]);

    const history = await memory.getHistory("elara");
    expect(history).toHaveLength(2);
  });

  it("trims history to maxHistory limit", async () => {
    const smallMemory = new NPCMemoryStore(tmpDir + "-small", 4);

    // Add 6 messages — should trim to last 4
    for (let i = 0; i < 6; i++) {
      await smallMemory.appendHistory("elara", [
        { role: "player", content: `Message ${i}`, timestamp: i },
      ]);
    }

    const history = await smallMemory.getHistory("elara");
    expect(history).toHaveLength(4);
    expect(history[0]?.content).toBe("Message 2");
    expect(history[3]?.content).toBe("Message 5");

    await smallMemory.close();
  });

  it("clearHistory removes all messages for an NPC", async () => {
    await memory.appendHistory("elara", [
      { role: "player", content: "Hello", timestamp: 1000 },
    ]);
    await memory.clearHistory("elara");

    const history = await memory.getHistory("elara");
    expect(history).toEqual([]);
  });

  it("history is isolated per NPC", async () => {
    await memory.appendHistory("elara", [
      { role: "player", content: "Elara message", timestamp: 1000 },
    ]);
    await memory.appendHistory("krath", [
      { role: "player", content: "Krath message", timestamp: 1000 },
    ]);

    const elaraHistory = await memory.getHistory("elara");
    const krathHistory = await memory.getHistory("krath");

    expect(elaraHistory).toHaveLength(1);
    expect(krathHistory).toHaveLength(1);
    expect(elaraHistory[0]?.content).toBe("Elara message");
    expect(krathHistory[0]?.content).toBe("Krath message");
  });
});

describe("NPCMemoryStore — flags", () => {
  it("returns empty object for unknown NPC", async () => {
    const flags = await memory.getFlags("unknown-npc");
    expect(flags).toEqual({});
  });

  it("sets and retrieves a flag", async () => {
    await memory.setFlag("elara", "metPlayer", true);
    const flags = await memory.getFlags("elara");
    expect(flags["metPlayer"]).toBe(true);
  });

  it("merges multiple flags", async () => {
    await memory.mergeFlags("elara", {
      metPlayer: true,
      questGiven: false,
      reputation: 10,
    });

    const flags = await memory.getFlags("elara");
    expect(flags["metPlayer"]).toBe(true);
    expect(flags["questGiven"]).toBe(false);
    expect(flags["reputation"]).toBe(10);
  });

  it("mergeFlags does not overwrite unrelated flags", async () => {
    await memory.setFlag("elara", "metPlayer", true);
    await memory.mergeFlags("elara", { questGiven: true });

    const flags = await memory.getFlags("elara");
    expect(flags["metPlayer"]).toBe(true);
    expect(flags["questGiven"]).toBe(true);
  });

  it("flags are isolated per NPC", async () => {
    await memory.setFlag("elara", "metPlayer", true);
    await memory.setFlag("krath", "metPlayer", false);

    const elaraFlags = await memory.getFlags("elara");
    const krathFlags = await memory.getFlags("krath");

    expect(elaraFlags["metPlayer"]).toBe(true);
    expect(krathFlags["metPlayer"]).toBe(false);
  });
});

describe("NPCMemoryStore — clearAll", () => {
  it("clears both history and flags", async () => {
    await memory.appendHistory("elara", [
      { role: "player", content: "Hello", timestamp: 1000 },
    ]);
    await memory.setFlag("elara", "metPlayer", true);

    await memory.clearAll("elara");

    const history = await memory.getHistory("elara");
    const flags   = await memory.getFlags("elara");

    expect(history).toEqual([]);
    expect(flags).toEqual({});
  });

  it("clearAll for one NPC does not affect others", async () => {
    await memory.setFlag("elara", "metPlayer", true);
    await memory.setFlag("krath", "metPlayer", true);

    await memory.clearAll("elara");

    const krathFlags = await memory.getFlags("krath");
    expect(krathFlags["metPlayer"]).toBe(true);
  });
});
