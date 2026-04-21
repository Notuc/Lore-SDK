// Reads and validates lore.config.json.
// Every other part of the library calls loadConfig() to get
// the current configuration — never reads the file directly.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { LoreError } from "./types.js";

// Config shape 

export type ProviderName = "anthropic" | "ollama";

export type LoreConfig = {
  provider:  ProviderName;
  model?:    string;
  fallback?: ProviderName;
  modules?:  string[];
  local?: {
    baseUrl?: string;     // default: http://localhost:11434
    port?:    number;     // sidecar port, default: 7433
  };
  cloud?: {
    apiKey?: string;
  };
  memory?: {
    persist?:    boolean; // default: true
    maxHistory?: number;  // max messages to keep per NPC, default: 20
  };
};

// Default config 
// Used when no lore.config.json is found.
// Defaults to Ollama so zero config is needed for local dev.

export const DEFAULT_CONFIG: LoreConfig = {
  provider: "ollama",
  local: {
    baseUrl: "http://localhost:11434",
    port:    7433,
  },
  memory: {
    persist:    true,
    maxHistory: 20,
  },
};

//  loadConfig() 

export function loadConfig(configPath?: string): LoreConfig {
  const filePath = configPath ?? findConfigFile();

  // No config file found — use defaults silently
  if (!filePath) {
    console.log(
      "[Lore] No lore.config.json found. Using defaults (Ollama on localhost:11434)."
    );
    return DEFAULT_CONFIG;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new LoreError(
      "UNKNOWN",
      `[Lore] Could not read config file at ${filePath}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LoreError(
      "UNKNOWN",
      `[Lore] lore.config.json is not valid JSON. Check for syntax errors.`
    );
  }

  return validateConfig(parsed, filePath);
}

// findConfigFile() 
// Walks up from the current working directory looking for
// lore.config.json — same pattern as tsconfig resolution.

function findConfigFile(): string | null {
  const candidates = [
    resolve(process.cwd(), "lore.config.json"),
    resolve(process.cwd(), "..", "lore.config.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

// validateConfig() 
// Checks required fields and gives clear error messages.
// Returns a merged config with defaults filled in.

function validateConfig(raw: unknown, filePath: string): LoreConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new LoreError(
      "UNKNOWN",
      `[Lore] lore.config.json must be a JSON object. Check ${filePath}`
    );
  }

  const cfg = raw as Record<string, unknown>;

  // provider is required
  if (!cfg["provider"]) {
    throw new LoreError(
      "UNKNOWN",
      `[Lore] lore.config.json is missing required field "provider". ` +
      `Set it to "ollama" or "anthropic".`
    );
  }

  const provider = cfg["provider"] as string;
  if (provider !== "ollama" && provider !== "anthropic") {
    throw new LoreError(
      "UNKNOWN",
      `[Lore] Unknown provider "${provider}". Valid options: "ollama", "anthropic".`
    );
  }

  // If anthropic is the provider or fallback, apiKey is required
  const cloud = cfg["cloud"] as Record<string, unknown> | undefined;
  const fallback = cfg["fallback"] as string | undefined;

  if (
    (provider === "anthropic" || fallback === "anthropic") &&
    !cloud?.["apiKey"]
  ) {
    throw new LoreError(
      "AUTH_FAILED",
      `[Lore] Anthropic requires an API key. ` +
      `Add "cloud": { "apiKey": "sk-ant-..." } to lore.config.json.`
    );
  }

  // Merge with defaults so optional fields are always present
  return {
    ...DEFAULT_CONFIG,
    ...(raw as LoreConfig),
    local:  { ...DEFAULT_CONFIG.local,  ...(cfg["local"]  as object | undefined) },
    memory: { ...DEFAULT_CONFIG.memory, ...(cfg["memory"] as object | undefined) },
  };
}
