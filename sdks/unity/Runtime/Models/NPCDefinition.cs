using System;
using UnityEngine;

namespace Lore
{
    [Serializable]
    public class NPCDefinition
    {
        public string   id;
        public string   name;
        public string   role;
        public string[] personality;
        public string[] knowledge;
        public string   backstory;
        public string   voiceStyle;
        public NPCWorld world;
        // Removed Dictionary<string,object> flags —
        // JsonUtility cannot serialize Dictionary.
        // Flags are managed server-side via SetFlag().
    }

    [Serializable]
    public class NPCWorld
    {
        public string   setting;
        public string   genre;
        public string   technology;
        public string[] unknowns;
    }
}
