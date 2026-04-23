// Persists NPC conversation history and flags using LevelDB.

import { Level } from "level";
import type { DialogueMessage, NPCFlags } from "./npc.types.js";

const DB_PATH     = ".lore/memory";
const MAX_HISTORY = 20;

export class NPCMemoryStore {
  private db: Level<string, string>;

  constructor(
    dbPath:                 string = DB_PATH,
    private maxHistory:     number = MAX_HISTORY
  ) {
    this.db = new Level<string, string>(dbPath, { valueEncoding: "utf8" });
  }

  // History 

  async getHistory(npcId: string): Promise<DialogueMessage[]> {
    try {
      const raw = await this.db.get(this.historyKey(npcId));
      return JSON.parse(raw) as DialogueMessage[];
    } catch {
      return []; // key not found = no history yet
    }
  }

  async appendHistory(
    npcId:    string,
    messages: DialogueMessage[]
  ): Promise<void> {
    const existing = await this.getHistory(npcId);
    const updated  = [...existing, ...messages];

    // Trim to maxHistory — keep the most recent messages
    const trimmed = updated.slice(-this.maxHistory);

    await this.db.put(
      this.historyKey(npcId),
      JSON.stringify(trimmed)
    );
  }

  async clearHistory(npcId: string): Promise<void> {
    try {
      await this.db.del(this.historyKey(npcId));
    } catch {
      
    }
  }

  // Flags
  async getFlags(npcId: string): Promise<NPCFlags> {
    try {
      const raw = await this.db.get(this.flagsKey(npcId));
      return JSON.parse(raw) as NPCFlags;
    } catch {
      return {};
    }
  }

  async setFlag(
    npcId: string,
    key:   string,
    value: boolean | string | number
  ): Promise<void> {
    const flags = await this.getFlags(npcId);
    flags[key]  = value;
    await this.db.put(this.flagsKey(npcId), JSON.stringify(flags));
  }

  async mergeFlags(npcId: string, updates: NPCFlags): Promise<void> {
    const flags   = await this.getFlags(npcId);
    const merged  = { ...flags, ...updates };
    await this.db.put(this.flagsKey(npcId), JSON.stringify(merged));
  }

  // Full wipe 
  async clearAll(npcId: string): Promise<void> {
    await Promise.all([
      this.clearHistory(npcId),
      this.db.del(this.flagsKey(npcId)).catch(() => {}),
    ]);
  }

  //  Helpers

  private historyKey(npcId: string): string {
    return `npc:history:${npcId}`;
  }

  private flagsKey(npcId: string): string {
    return `npc:flags:${npcId}`;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
