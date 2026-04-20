import Anthropic from "@anthropic-ai/sdk";
import type { ILoreProvider } from "@lore/core";
import { LoreError } from "@lore/core";
import type { LoreRequest, LoreResponse } from "@lore/core";

const DEFAULT_MODEL     = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

export class AnthropicProvider implements ILoreProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === "") {
      throw new LoreError(
        "AUTH_FAILED",
        "[Lore] Anthropic API key is missing. Add it to lore.config.json under cloud.apiKey"
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: LoreRequest): Promise<LoreResponse> {
    try {
      const response = await this.client.messages.create({
        model:       req.model       ?? DEFAULT_MODEL,
        max_tokens:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
        system:      req.system,
        messages: req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role:    m.role as "user" | "assistant",
            content: m.content,
          })),
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block)  => (block as Anthropic.TextBlock).text)
        .join("");

      return {
        text,
        model:  response.model,
        tokens: {
          input:  response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async *stream(req: LoreRequest): AsyncGenerator<string> {
    try {
      const stream = this.client.messages.stream({
        model:       req.model       ?? DEFAULT_MODEL,
        max_tokens:  req.maxTokens   ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
        system:      req.system,
        messages: req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role:    m.role as "user" | "assistant",
            content: m.content,
          })),
      });

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          yield chunk.delta.text;
        }
      }
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model:      DEFAULT_MODEL,
        max_tokens: 1,
        messages:   [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private mapError(err: unknown): LoreError {
    if (err instanceof LoreError) return err;

    // Check status code directly — works for both the real SDK
    // and the mock in tests without relying on instanceof.
    const status = (err as { status?: number }).status;

    if (status === 401) {
      return new LoreError(
        "AUTH_FAILED",
        "[Lore] Anthropic authentication failed. Check your API key in lore.config.json"
      );
    }
    if (status === 429) {
      return new LoreError(
        "RATE_LIMITED",
        "[Lore] Anthropic rate limit reached. Too many concurrent requests."
      );
    }
    if (status === 400) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("context")) {
        return new LoreError(
          "CONTEXT_TOO_LONG",
          "[Lore] Prompt exceeded the model context window. Reduce NPC history length."
        );
      }
    }

    return new LoreError(
      "UNKNOWN",
      `[Lore] Anthropic provider error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}



