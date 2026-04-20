/** The core contract every AI provider must implement.
* The sidecar, modules, and SDKs only talk to this interface not to a provider directly (ollama,openai, etc).
*/

import type { LoreRequest, LoreResponse } from "./types.js";

export interface ILoreProvider {
  // The provider's identifier.  
  readonly name: string;

  // Sends a request and wait for the full response.
  complete(req: LoreRequest): Promise<LoreResponse>;

  // Send a request and stream tokens back one at a time.
  stream(req: LoreRequest): AsyncGenerator<string>;

  // Check whether the provider is reachable.
  health(): Promise<boolean>;
}
