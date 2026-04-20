// Validates that ILoreProvider has the correct shape
// by implementing it with a mock and confirming  TypeScript accepts it without errors.

import { describe, it, expect } from "vitest";
import type { ILoreProvider } from ".././provider.interface.js";
import type { LoreRequest, LoreResponse } from ".././types.js";

//  Mock provider 

// If TypeScript accepts this class, the interface shape is correct.
// If TypeScript rejects it, something is wrong with the interface.

class MockProvider implements ILoreProvider {
  readonly name = "mock";

  async complete(_req: LoreRequest): Promise<LoreResponse> {
    return {
      text: "Hello from mock provider",
      model: "mock-model-1",
      tokens: { input: 10, output: 6 },
    };
  }

  async *stream(_req: LoreRequest): AsyncGenerator<string> {
    const words = ["Hello", " from", " mock", " stream"];
    for (const word of words) {
      yield word;
    }
  }

  async health(): Promise<boolean> {
    return true;
  }
}

//  Tests 

describe("ILoreProvider", () => {
  const provider: ILoreProvider = new MockProvider();

  it("has the correct name", () => {
    expect(provider.name).toBe("mock");
  });

  it("complete() returns a LoreResponse shape", async () => {
    const req: LoreRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const res = await provider.complete(req);

    expect(res).toHaveProperty("text");
    expect(res).toHaveProperty("model");
    expect(res.tokens).toHaveProperty("input");
    expect(res.tokens).toHaveProperty("output");
    expect(typeof res.text).toBe("string");
  });

  it("stream() yields individual string tokens", async () => {
    const req: LoreRequest = {
      messages: [{ role: "user", content: "hello" }],
    };

    const tokens: string[] = [];
    for await (const token of provider.stream(req)) {
      tokens.push(token);
    }

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => typeof t === "string")).toBe(true);
    expect(tokens.join("")).toBe("Hello from mock stream");
  });

  it("health() returns a boolean", async () => {
    const result = await provider.health();
    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });
});
