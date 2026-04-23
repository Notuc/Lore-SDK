// ollama.provider.ts

import type { ILoreProvider } from "@lore/core";
import { LoreError } from "@lore/core";
import type { LoreRequest, LoreResponse } from "@lore/core";

const DEFAULT_MODEL       = "llama3.2";
const DEFAULT_MAX_TOKENS  = 1024;
const DEFAULT_TEMPERATURE = 0.9; // higher = more creative, better roleplay

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
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async complete(req: LoreRequest): Promise<LoreResponse> {
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:   req.model ?? DEFAULT_MODEL,
          options: {
            num_predict:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
            temperature:  req.temperature ?? DEFAULT_TEMPERATURE,
          },
          stream:   false,
          // Ollama expects system prompt as the FIRST message
          // in the messages array with role:"system".
          // Passing it as a top-level "system" field is
          // silently ignored by most Ollama models.
          messages: this.buildMessages(req),
        }),
      });
    } catch {
      throw new LoreError(
        "PROVIDER_UNREACHABLE",
        `[Lore] Cannot reach Ollama at ${this.baseUrl}. ` +
        `Is Ollama running? Start it with: ollama serve`
      );
    }

    if (!res.ok) throw this.mapHttpError(res.status);

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

  async *stream(req: LoreRequest): AsyncGenerator<string> {
    let res: Response;

    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:   req.model ?? DEFAULT_MODEL,
          options: {
            num_predict:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
            temperature:  req.temperature ?? DEFAULT_TEMPERATURE,
          },
          stream:   true,
          messages: this.buildMessages(req),
        }),
      });
    } catch {
      throw new LoreError(
        "PROVIDER_UNREACHABLE",
        `[Lore] Cannot reach Ollama at ${this.baseUrl}. ` +
        `Is Ollama running? Start it with: ollama serve`
      );
    }

    if (!res.ok) throw this.mapHttpError(res.status);

    if (!res.body) {
      throw new LoreError("UNKNOWN", "[Lore] Ollama stream had no body.");
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
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
          // malformed line — skip
        }
      }
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return false;

      const data = await res.json() as { models?: { name: string }[] };
      if (!data.models || data.models.length === 0) {
        console.warn(
          "[Lore] Ollama is running but no models are installed.\n" +
          "       Run: ollama pull llama3.2"
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  // buildMessages() 
  // Injects the system prompt as the first message in the
  // messages array. This is the correct way to pass system
  // prompts to Ollama — the top-level "system" field is
  // ignored by most models.

  private buildMessages(req: LoreRequest): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];

    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }

    for (const m of req.messages) {
      // Skip any system messages already in the array —
      // we've already handled system above
      if (m.role === "system") continue;
      messages.push({ role: m.role, content: m.content });
    }

    return messages;
  }

  private mapHttpError(status: number): LoreError {
    if (status === 404) {
      return new LoreError(
        "PROVIDER_UNREACHABLE",
        `[Lore] Ollama model not found. Run: ollama pull ${DEFAULT_MODEL}`
      );
    }
    return new LoreError("UNKNOWN", `[Lore] Ollama returned HTTP ${status}`);
  }
}
