import { describe, it, expect, vi } from "vitest";
import { resolveProvider } from "../resolver.js";
import { LoreError } from "../types.js";
import type { ILoreProvider } from "../provider.interface.js";
import type { LoreConfig, ProviderFactory } from "../resolver.js";

function makeMockProvider(name: string, healthy: boolean): ILoreProvider {
  return {
    name,
    complete: vi.fn(),
    stream:   vi.fn() as unknown as ILoreProvider["stream"],
    health:   vi.fn().mockResolvedValue(healthy),
  };
}

const BASE_CONFIG: LoreConfig = {
  provider: "ollama",
  local:    { baseUrl: "http://localhost:11434" },
};

//Tests

describe("resolveProvider", () => {

  // Test: should return primary provider if it is healthy
  it("returns the primary provider when healthy", async () => {
    const primary = makeMockProvider("ollama", true);
    const factory: ProviderFactory = vi.fn().mockResolvedValue(primary);

    const result = await resolveProvider(BASE_CONFIG, factory);
    expect(result.name).toBe("ollama");
    expect(factory).toHaveBeenCalledWith("ollama", BASE_CONFIG);
  });

  // Test: should fallback to secondary provider if primary is unhealthy
  it("returns the fallback when primary is unhealthy", async () => {
    const primary  = makeMockProvider("ollama",    false);
    const fallback = makeMockProvider("anthropic", true);

    const factory: ProviderFactory = vi.fn()
      .mockResolvedValueOnce(primary)
      .mockResolvedValueOnce(fallback);

    const config: LoreConfig = {
      ...BASE_CONFIG,
      fallback: "anthropic",
      cloud:    { apiKey: "sk-ant-test" },
    };

    const result = await resolveProvider(config, factory);
    expect(result.name).toBe("anthropic");
  });

  // Test: should throw if primary is down and no fallback is defined
  it("throws PROVIDER_UNREACHABLE when primary is down with no fallback", async () => {
    const primary = makeMockProvider("ollama", false);
    const factory: ProviderFactory = vi.fn().mockResolvedValue(primary);

    const err = await resolveProvider(BASE_CONFIG, factory).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("PROVIDER_UNREACHABLE");
  });

  // Test: should throw if both primary and fallback providers are unhealthy
  it("throws PROVIDER_UNREACHABLE when both providers are down", async () => {
    const primary  = makeMockProvider("ollama",    false);
    const fallback = makeMockProvider("anthropic", false);

    const factory: ProviderFactory = vi.fn()
      .mockResolvedValueOnce(primary)
      .mockResolvedValueOnce(fallback);

    const config: LoreConfig = {
      ...BASE_CONFIG,
      fallback: "anthropic",
      cloud:    { apiKey: "sk-ant-test" },
    };

    const err = await resolveProvider(config, factory).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("PROVIDER_UNREACHABLE");
    expect((err as LoreError).message).toContain("Both providers");
  });

  // Test: ensure factory is only called once if primary is healthy
  it("only calls factory once when primary is healthy", async () => {
    const primary = makeMockProvider("ollama", true);
    const factory: ProviderFactory = vi.fn().mockResolvedValue(primary);

    await resolveProvider(BASE_CONFIG, factory);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
