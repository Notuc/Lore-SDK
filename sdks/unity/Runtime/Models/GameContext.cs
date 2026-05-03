// Per-request game state passed to each speak() call.
// Build this from your game's current state before calling Speak().

using System;
using System.Collections.Generic;

namespace Lore
{
    [Serializable]
    public class GameContext
    {
        public string playerMood;
        public string timeOfDay;
        public string location;
        public int?   playerGold;
        public int?   playerLevel;
        public string questActive;
        public Dictionary<string, object> additionalFlags = new();
    }

    /// <summary>
    /// Fluent builder for GameContext.
    /// Makes it easy to construct context from game state.
    /// </summary>
    public class LoreContextBuilder
    {
        private readonly GameContext _ctx = new();

        public LoreContextBuilder WithPlayerMood(string mood)
        {
            _ctx.playerMood = mood;
            return this;
        }

        public LoreContextBuilder WithTimeOfDay(string time)
        {
            _ctx.timeOfDay = time;
            return this;
        }

        public LoreContextBuilder WithLocation(string location)
        {
            _ctx.location = location;
            return this;
        }

        public LoreContextBuilder WithPlayerGold(int gold)
        {
            _ctx.playerGold = gold;
            return this;
        }

        public LoreContextBuilder WithPlayerLevel(int level)
        {
            _ctx.playerLevel = level;
            return this;
        }

        public LoreContextBuilder WithQuest(string questId)
        {
            _ctx.questActive = questId;
            return this;
        }

        public LoreContextBuilder WithFlag(string key, object value)
        {
            _ctx.additionalFlags[key] = value;
            return this;
        }

        public GameContext Build() => _ctx;
    }
}
