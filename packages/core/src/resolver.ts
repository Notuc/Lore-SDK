// resolver.ts
// Takes a LoreConfig and returns a ready ILoreProvider.

import type { LoreConfig, ProviderName } from "./config.js";
import type { ILoreProvider } from "./provider.interface.js";
import { LoreError } from "./types.js";

// resolveProvider() 

export async function resolveProvider(
  config: LoreConfig,
  factory: ProviderFactory = defaultProviderFactory
): Promise<ILoreProvider> {

  const primary = await factory(config.provider, config);
  const primaryAlive = await primary.health();

  if (primaryAlive) {
    console.log(`[Lore] Using provider: ${primary.name}`);
    return primary;
  }

  if (config.fallback) {
    console.warn(
      `[Lore] ${primary.name} is unreachable. ` +
      `Trying fallback: ${config.fallback}...`
    );

    const fallback = await factory(config.fallback, config);
    const fallbackAlive = await fallback.health();

    if (fallbackAlive) {
      console.log(`[Lore] Using fallback provider: ${fallback.name}`);
      return fallback;
    }

    throw new LoreError(
      "PROVIDER_UNREACHABLE",
      `[Lore] Both providers are unreachable.\n` +
      `  Primary  (${primary.name}): not responding\n` +
      `  Fallback (${fallback.name}): not responding\n` +
      `Check that Ollama is running or your Anthropic API key is valid.`
    );
  }

  throw new LoreError(
    "PROVIDER_UNREACHABLE",
    buildUnreachableMessage(config.provider, config)
  );
}

// ProviderFactory type 
// Now async — dynamic import() requires await

export type ProviderFactory = (
  name: ProviderName,
  config: LoreConfig
) => Promise<ILoreProvider>;

// defaultProviderFactory 
// Uses dynamic import() — compatible with NodeNext modules.

const defaultProviderFactory: ProviderFactory = async (name, config) => {
  if (name === "anthropic") {
    const { AnthropicProvider } = await import("@lore/provider-anthropic");
    const apiKey = config.cloud?.apiKey ?? "";
    return new AnthropicProvider(apiKey);
  }

  if (name === "ollama") {
    const { OllamaProvider } = await import("@lore/provider-ollama");
    const baseUrl = config.local?.baseUrl;
    return new OllamaProvider(baseUrl);
  }

  throw new LoreError("UNKNOWN", `[Lore] Unknown provider: "${name}"`);
};

// buildUnreachableMessage() 

function buildUnreachableMessage(name: ProviderName, config: LoreConfig): string {
  if (name === "ollama") {
    const url = config.local?.baseUrl ?? "http://localhost:11434";
    return (
      `[Lore] Cannot reach Ollama at ${url}.\n` +
      `  1. Install Ollama: https://ollama.com\n` +
      `  2. Start it:       ollama serve\n` +
      `  3. Pull a model:   ollama pull llama3.1\n` +
      `  Or switch to Anthropic: set "provider": "anthropic" in lore.config.json`
    );
  }

  return (
    `[Lore] Cannot reach Anthropic API.\n` +
    `  Check your API key in lore.config.json under "cloud.apiKey".`
  );
}
