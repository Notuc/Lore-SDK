// C# mirror of the TypeScript NPCDefinition type.
// Fill these fields in the Inspector on AIGANPCComponent.

using System;
using System.Collections.Generic;

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
        public Dictionary<string, object> flags = new();
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
