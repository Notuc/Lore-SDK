import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoreError } from "@lore/core";
import { AnthropicProvider } from "../anthropic.provider.js";

// Shared mock fns — defined outside so beforeEach can reset them
const mockCreate = vi.fn();
const mockStream = vi.fn();

// Mock the Anthropic SDK 
// vi.mock is hoisted above ALL imports at runtime.
// APIError MUST be defined inside this factory — anything
// outside is not yet initialised when the factory runs.
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "APIError";
    }
  }

  class MockAnthropic {
    static APIError = APIError;
    messages = { create: mockCreate, stream: mockStream };
  }

  return { default: MockAnthropic };
});

// Error class for tests — mirrors the one inside the mock 
// mapError() checks err.status directly (not instanceof),
// so this plain class triggers the correct error code.
class MockAPIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

// Fake SSE stream 
function makeFakeStream() {
  const chunks = [
    { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "traveler." } },
    { type: "message_stop" },
  ];
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}

// Tests 
describe("AnthropicProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello traveler." }],
      model: "claude-haiku-4-5",
      usage: { input_tokens: 12, output_tokens: 4 },
    });

    mockStream.mockReturnValue(makeFakeStream());
  });

  it("throws LoreError if API key is empty", () => {
    expect(() => new AnthropicProvider("")).toThrow(LoreError);
  });

  it("has name 'anthropic'", () => {
    expect(new AnthropicProvider("sk-fake").name).toBe("anthropic");
  });

  it("complete() returns a valid LoreResponse", async () => {
    const res = await new AnthropicProvider("sk-fake").complete({
      messages: [{ role: "user", content: "Who are you?" }],
    });
    expect(res.text).toBe("Hello traveler.");
    expect(res.model).toBe("claude-haiku-4-5");
    expect(res.tokens.input).toBe(12);
    expect(res.tokens.output).toBe(4);
  });

  it("complete() filters system role out of messages array", async () => {
    await new AnthropicProvider("sk-fake").complete({
      messages: [
        { role: "system", content: "You are a merchant." },
        { role: "user",   content: "What do you sell?" },
      ],
    });
    const sent = (mockCreate.mock.calls[0]?.[0] as { messages: { role: string }[] }).messages;
    expect(sent.map((m) => m.role)).not.toContain("system");
  });

  it("stream() yields individual tokens", async () => {
    const tokens: string[] = [];
    for await (const t of new AnthropicProvider("sk-fake").stream({
      messages: [{ role: "user", content: "Say hello." }],
    })) {
      tokens.push(t);
    }
    expect(tokens).toEqual(["Hello ", "traveler."]);
  });

  it("health() returns true when API responds", async () => {
    expect(await new AnthropicProvider("sk-fake").health()).toBe(true);
  });

  it("health() returns false when API throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Network error"));
    expect(await new AnthropicProvider("sk-fake").health()).toBe(false);
  });

  it("complete() maps 401 to AUTH_FAILED", async () => {
    mockCreate.mockRejectedValue(new MockAPIError(401, "Unauthorized"));
    const err = await new AnthropicProvider("sk-fake")
      .complete({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("AUTH_FAILED");
  });

  it("complete() maps 429 to RATE_LIMITED", async () => {
    mockCreate.mockRejectedValue(new MockAPIError(429, "Too many requests"));
    const err = await new AnthropicProvider("sk-fake")
      .complete({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("RATE_LIMITED");
  });
});
