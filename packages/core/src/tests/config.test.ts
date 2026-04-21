import { describe, it, expect, vi, afterEach } from "vitest";
import { loadConfig, DEFAULT_CONFIG } from "../config.js";
import { LoreError } from "../types.js";

// Mock fs so no real files are read during tests
vi.mock("fs", () => ({
  existsSync:  vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "fs";

const mockExists   = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFileSync);

// Reset all mocks after each test to avoid cross-test contamination
afterEach(() => vi.clearAllMocks());

// Test: when no config file exists, fallback to defaults
describe("loadConfig", () => {

  it("returns DEFAULT_CONFIG when no file is found", () => {
    mockExists.mockReturnValue(false);
    const config = loadConfig();
    expect(config.provider).toBe("ollama");
    expect(config).toMatchObject(DEFAULT_CONFIG);
  });

// Test: valid ollama config is parsed correctly
  it("parses a valid ollama config", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({
      provider: "ollama",
      model:    "llama3.1",
    }));

    const config = loadConfig("/fake/lore.config.json");
    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("llama3.1");
  });
 // Test: valid anthropic config is parsed correctly
  it("parses a valid anthropic config", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({
      provider: "anthropic",
      cloud:    { apiKey: "sk-ant-test" },
    }));

    const config = loadConfig("/fake/lore.config.json");
    expect(config.provider).toBe("anthropic");
    expect(config.cloud?.apiKey).toBe("sk-ant-test");
  });
  // Test: config is merged with defaults (ensures optional fields exist)
  it("merges with defaults so optional fields are always present", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({
      provider: "ollama",
    }));

    const config = loadConfig("/fake/lore.config.json");
    expect(config.memory?.maxHistory).toBe(20);
    expect(config.local?.baseUrl).toBe("http://localhost:11434");
  });
  // Test: missing provider field should throw an error
  it("throws LoreError when provider field is missing", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({ model: "llama3.1" }));

    expect(() => loadConfig("/fake/lore.config.json")).toThrow(LoreError);
    expect(() => loadConfig("/fake/lore.config.json")).toThrow("missing required field");
  });
  // Test: unknown provider should throw an error
  it("throws LoreError when provider is unknown", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({ provider: "gpt-fake" }));

    expect(() => loadConfig("/fake/lore.config.json")).toThrow(LoreError);
    expect(() => loadConfig("/fake/lore.config.json")).toThrow("Unknown provider");
  });
  // Test: anthropic provider without API key should throw auth error
  it("throws AUTH_FAILED when anthropic is used without an apiKey", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue(JSON.stringify({ provider: "anthropic" }));

    const err = (() => {
      try { loadConfig("/fake/lore.config.json"); }
      catch (e) { return e; }
    })();

    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("AUTH_FAILED");
  });
  // Test: invalid JSON should throw parsing error
  it("throws LoreError on invalid JSON", () => {
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue("{ not valid json }");

    expect(() => loadConfig("/fake/lore.config.json")).toThrow(LoreError);
    expect(() => loadConfig("/fake/lore.config.json")).toThrow("not valid JSON");
  });
});
