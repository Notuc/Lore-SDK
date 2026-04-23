/**
 * Defines a single NPC character.
 */
export type NPCDefinition = {
  id:           string;
  name:         string;
  role:         string;
  personality:  string[];
  knowledge:    string[];
  backstory?:   string;
  voiceStyle?:  string;
  flags?:       NPCFlags;

  // world context 
  world?: {
    setting:      string;   // one sentence describing the world
    genre?:       string;   // "fantasy" | "sci-fi" | "western" | "horror" | "modern" | etc
    technology?:  string;   // what technology exists e.g. "swords and magic", "laser weapons", "revolvers"
    unknowns?:    string[]; // things that DON'T exist in this world e.g. ["computers", "cars", "magic"]
  };
};

export type NPCFlags = Record<string, boolean | string | number>;

export type GameContext = {
  playerMood?:      string;
  timeOfDay?:       string;
  location?:        string;
  playerGold?:      number;
  playerLevel?:     number;
  questActive?:     string;
  additionalFlags?: NPCFlags;
};

export type GameAction = {
  type:    string;
  payload: Record<string, unknown>;
};

export type DialogueReply = {
  text:    string;
  emotion: string;
  actions: GameAction[];
  memory:  NPCFlags;
  history: DialogueMessage[];
};

export type DialogueMessage = {
  role:      "player" | "npc";
  content:   string;
  timestamp: number;
};

export type SpeakOptions = {
  stream?:      boolean;
  model?:       string;
  maxTokens?:   number;
  temperature?: number;
};
