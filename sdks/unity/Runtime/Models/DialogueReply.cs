// C# mirror of the TypeScript DialogueReply type.
// Returned by AIGANPCComponent.Speak().

using System;
using System.Collections.Generic;

namespace Lore
{
    [Serializable]
    public class DialogueReply
    {
        public string          text;
        public string          emotion;
        public List<GameAction> actions  = new();
        public Dictionary<string, object> memory = new();
        public List<DialogueMessage>      history = new();
    }

    [Serializable]
    public class GameAction
    {
        public string                    type;
        public Dictionary<string, object> payload = new();
    }

    [Serializable]
    public class DialogueMessage
    {
        public string role;      // "player" | "npc"
        public string content;
        public long   timestamp;
    }
}
