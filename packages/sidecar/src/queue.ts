// Simple async concurrency queue.
// Limits simultaneous provider calls so Ollama/Anthropic
// don't get hammered when multiple NPCs speak at once.

type Task<T> = () => Promise<T>;

export class RequestQueue {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly concurrency = 5) {}

  async add<T>(task: Task<T>): Promise<T> {
    // Wait for a slot if at capacity
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;

    try {
      return await task();
    } finally {
      this.running--;
      // Wake the next waiting task
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.running;
  }
}
