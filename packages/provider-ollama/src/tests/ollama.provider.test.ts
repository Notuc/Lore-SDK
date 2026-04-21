// Tests for OllamaProvider using a mocked global fetch.
// No real Ollama instance needed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoreError } from "@lore/core";
import { OllamaProvider } from "../ollama.provider.js";


// Builds a fake Response for complete() calls
function mockCompleteResponse(text: string) {
  return new Response(
    JSON.stringify({
      message:           { content: text },
      done:              true,
      prompt_eval_count: 10,
      eval_count:        5,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// Builds a fake streaming Response for stream() calls.
// Ollama streams NDJSON — one JSON object per line.
function mockStreamResponse(tokens: string[]) {
  const lines = tokens.map((t, i) =>
    JSON.stringify({
      message: { content: t },
      done: i === tokens.length - 1,
    })
  ).join("\n") + "\n";

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(lines));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
  );
}

// Builds a fake health() response
function mockTagsResponse(models: string[] = ["llama3.1"]) {
  return new Response(
    JSON.stringify({ models: models.map((name) => ({ name })) }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// Tests 
describe("OllamaProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Constructor 

  it("has name 'ollama'", () => {
    expect(new OllamaProvider().name).toBe("ollama");
  });

  it("uses localhost:11434 as default baseUrl", async () => {
    fetchMock.mockResolvedValue(mockCompleteResponse("hi"));
    await new OllamaProvider().complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("localhost:11434");
  });

  it("accepts a custom baseUrl", async () => {
    fetchMock.mockResolvedValue(mockCompleteResponse("hi"));
    await new OllamaProvider("http://localhost:9999").complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("9999");
  });

  // complete()

  it("complete() returns a valid LoreResponse", async () => {
    fetchMock.mockResolvedValue(mockCompleteResponse("Hello traveler."));

    const res = await new OllamaProvider().complete({
      messages: [{ role: "user", content: "Who are you?" }],
    });

    expect(res.text).toBe("Hello traveler.");
    expect(res.tokens.input).toBe(10);
    expect(res.tokens.output).toBe(5);
  });

  it("complete() throws PROVIDER_UNREACHABLE when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const err = await new OllamaProvider()
      .complete({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("PROVIDER_UNREACHABLE");
  });

  it("complete() throws PROVIDER_UNREACHABLE on 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const err = await new OllamaProvider()
      .complete({ messages: [{ role: "user", content: "hi" }] })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("PROVIDER_UNREACHABLE");
  });

  // stream() 

  it("stream() yields individual tokens", async () => {
    fetchMock.mockResolvedValue(
      mockStreamResponse(["Hello ", "traveler."])
    );

    const tokens: string[] = [];
    for await (const token of new OllamaProvider().stream({
      messages: [{ role: "user", content: "Say hello." }],
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hello ", "traveler."]);
    expect(tokens.join("")).toBe("Hello traveler.");
  });

  it("stream() throws PROVIDER_UNREACHABLE when fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const gen = new OllamaProvider().stream({
      messages: [{ role: "user", content: "hi" }],
    });

    const err = await gen.next().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoreError);
    expect((err as LoreError).code).toBe("PROVIDER_UNREACHABLE");
  });

  // health() 

  it("health() returns true when Ollama is running", async () => {
    fetchMock.mockResolvedValue(mockTagsResponse(["llama3.1"]));
    expect(await new OllamaProvider().health()).toBe(true);
  });

  it("health() returns false when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await new OllamaProvider().health()).toBe(false);
  });

  it("health() returns false on non-200 response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    expect(await new OllamaProvider().health()).toBe(false);
  });

  it("health() warns when no models are installed", async () => {
    fetchMock.mockResolvedValue(mockTagsResponse([]));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await new OllamaProvider().health();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no models are installed")
    );
    warnSpy.mockRestore();
  });
});
