// All shared data shapes that flow through Lore.
// Every provider, module, and SDK uses these.

export type LoreMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

//  What you send to a provider.
 export type LoreRequest = {
  messages: LoreMessage[];
  model?: string;       
  maxTokens?: number;    // default: 1024
  temperature?: number;  // 0.0 (deterministic) → 1.0 (creative), temperature controls how random or creative the model’s output
  system?: string;       // (OPTIONAL) system prompt override
};

// What you get back from a provider.

export type LoreResponse = {
  text: string;          // the full response text
  model: string;         // which model actually responded
  tokens: {
    input: number;       // tokens consumed by the request
    output: number;      // tokens in the response
  };
};

// A named error type so callers can handle Lore
 
export type LoreErrorCode =
  | "PROVIDER_UNREACHABLE"   // health() returned false
  | "AUTH_FAILED"            // bad or missing API key
  | "RATE_LIMITED"           // too many requests
  | "CONTEXT_TOO_LONG"       // prompt exceeded model's context window
  | "UNKNOWN";               // catch-all

export class LoreError extends Error {
  constructor(
    public readonly code: LoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LoreError";
  }
}
