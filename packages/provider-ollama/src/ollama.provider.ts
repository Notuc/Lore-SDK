// Implements ILoreProvider against a local Ollama instance. uses Node 20 built-in fetch.

import type { ILoreProvider } from "@lore/core";
import { LoreError } from "@lore/core";
import type { LoreRequest, LoreResponse } from "@lore/core";

const DEFAULT_MODEL       = "llama3.1";
const DEFAULT_MAX_TOKENS  = 1024;
const DEFAULT_TEMPERATURE = 0.7;

// Shape of a single Ollama /api/chat response chunk
type OllamaChunk = {
  message?: { content?: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

export class OllamaProvider implements ILoreProvider {
  readonly name = "ollama";
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    // Strip trailing slash so URL joins are always clean
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  // complete(); POST /api/chat — waits for the full response.

  async complete(req: LoreRequest): Promise<LoreResponse> {
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:    req.model       ?? DEFAULT_MODEL,
          options:  {
            num_predict:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
            temperature:  req.temperature ?? DEFAULT_TEMPERATURE,
          },
          stream:   false,
          messages: req.messages.map((m) => ({
            role:    m.role,
            content: m.content,
          })),
        }),
      });
    } catch {
      throw new LoreError(
        "PROVIDER_UNREACHABLE",
        "[Lore] Cannot reach Ollama at " + this.baseUrl +
        ". Is Ollama running? Start it with: ollama serve"
      );
    }

    if (!res.ok) {
      throw this.mapHttpError(res.status);
    }

    const data = await res.json() as OllamaChunk;

    return {
      text:   data.message?.content ?? "",
      model:  req.model ?? DEFAULT_MODEL,
      tokens: {
        input:  data.prompt_eval_count ?? 0,
        output: data.eval_count        ?? 0,
      },
    };
  }

  // stream(); POST /api/chat with stream:true — yields NDJSON chunks.

  async *stream(req: LoreRequest): AsyncGenerator<string> {
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:    req.model       ?? DEFAULT_MODEL,
          options:  {
            num_predict:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
            temperature:  req.temperature ?? DEFAULT_TEMPERATURE,
          },
          stream:   true,
          messages: req.messages.map((m) => ({
            role:    m.role,
            content: m.content,
          })),
        }),
      });
    } catch {
      throw new LoreError(
        "PROVIDER_UNREACHABLE",
        "[Lore] Cannot reach Ollama at " + this.baseUrl +
        ". Is Ollama running? Start it with: ollama serve"
      );
    }

    if (!res.ok) {
      throw this.mapHttpError(res.status);
    }

    if (!res.body) {
      throw new LoreError("UNKNOWN", "[Lore] Ollama stream response had no body.");
    }

    // Read NDJSON line by line and yield each text delta
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines — each line is a complete JSON chunk
      const lines = buffer.split("\n");

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const chunk = JSON.parse(trimmed) as OllamaChunk;
          const token = chunk.message?.content;
          if (token) yield token;
          if (chunk.done) return;
        } catch {
          // Malformed line — skip and continue
        }
      }
    }
  }

  // health(); GET /api/tags — instant check, no model inference needed.

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);

      if (!res.ok) return false;

      // Warn if Ollama is running but no models are installed
      const data = await res.json() as { models?: { name: string }[] };
      if (!data.models || data.models.length === 0) {
        console.warn(
          "[Lore] Ollama is running but no models are installed.\n" +
          "       Run: ollama pull llama3.1"
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  // mapHttpError(); Translates Ollama HTTP status codes into LoreErrors.

  private mapHttpError(status: number): LoreError {
    if (status === 404) {
      return new LoreError(
        "PROVIDER_UNREACHABLE",
        `[Lore] Ollama model not found. Run: ollama pull ${DEFAULT_MODEL}`
      );
    }
    return new LoreError(
      "UNKNOWN",
      `[Lore] Ollama returned HTTP ${status}`
    );
  }
}
