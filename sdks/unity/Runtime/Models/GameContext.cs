// Per-request game state passed to each speak() call.
// Build this from your game's current state before calling Speak().

using System;
using UnityEngine;

namespace Lore
{
    [Serializable]
    public class GameContext
    {
        public string playerMood;
        public string timeOfDay;
        public string location;
        public int    playerGold   = -1; // -1 means not set
        public int    playerLevel  = -1; // -1 means not set
        public string questActive;
        // Removed Dictionary — JsonUtility can't serialize it.
        // Use SetFlag() for additional flags instead.
    }

    public class LoreContextBuilder
    {
        private readonly GameContext _ctx = new GameContext();

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

        public GameContext Build() => _ctx;
    }
}
