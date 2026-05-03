using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Events;

namespace Lore
{
    [AddComponentMenu("Lore/AIGA NPC")]
    public class AIGANPCComponent : MonoBehaviour
    {
        [Header("NPC Identity")]
        public string npcId;
        public string npcName;
        public string role;

        [Tooltip("Comma-separated personality traits. e.g. shrewd,warm,street-smart")]
        public string personality;

        [Tooltip("Comma-separated knowledge domains. e.g. trade routes,city gossip")]
        public string knowledge;

        [TextArea(2, 4)]
        public string backstory;

        [Tooltip("formal | rough | mystical | technical | casual")]
        public string voiceStyle;

        [Header("World Settings")]
        [Tooltip("One sentence describing the world. e.g. a medieval fantasy kingdom")]
        public string worldSetting;

        [Tooltip("What technology exists. e.g. swords and magic")]
        public string worldTechnology;

        [Tooltip("Comma-separated concepts that don't exist. e.g. AI,computers,guns")]
        public string worldUnknowns;

        [Header("Events")]
        public UnityEvent<string>        OnReply;
        public UnityEvent<string>        OnToken;
        public UnityEvent<string>        OnError;
        public UnityEvent<DialogueReply> OnDialogueReply;

        private NPCDefinition _definition;

        private void Awake()
        {
            _definition = BuildDefinition();
        }

        public async Task<DialogueReply> Speak(
            string      playerMessage,
            GameContext context = null)
        {
            if (!EnsureManager()) return null;

            try
            {
                var reply = await AIGAManager.Instance.Client.SpeakAsync(
                    _definition, playerMessage, context
                );
                OnReply?.Invoke(reply.text);
                OnDialogueReply?.Invoke(reply);
                return reply;
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[Lore] Speak error: {e.Message}");
                return null;
            }
        }

        public async Task StreamSpeak(
            string      playerMessage,
            GameContext context = null)
        {
            if (!EnsureManager()) return;

            try
            {
                await AIGAManager.Instance.Client.StreamSpeakAsync(
                    _definition,
                    playerMessage,
                    token => OnToken?.Invoke(token),
                    reply => OnDialogueReply?.Invoke(reply),
                    context
                );
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[Lore] StreamSpeak error: {e.Message}");
            }
        }

        public async Task SetFlag(string key, object value)
        {
            if (!EnsureManager()) return;
            await AIGAManager.Instance.Client.SetFlagAsync(npcId, key, value);
        }

        public async Task ClearMemory()
        {
            if (!EnsureManager()) return;
            await AIGAManager.Instance.Client.ClearMemoryAsync(npcId);
        }

        private NPCDefinition BuildDefinition()
        {
            return new NPCDefinition
            {
                id          = string.IsNullOrEmpty(npcId)
                                ? npcName.ToLower().Replace(" ", "-")
                                : npcId,
                name        = npcName,
                role        = role,
                personality = SplitCSV(personality),
                knowledge   = SplitCSV(knowledge),
                backstory   = backstory,
                voiceStyle  = voiceStyle,
                world       = new NPCWorld
                {
                    setting    = worldSetting,
                    technology = worldTechnology,
                    unknowns   = SplitCSV(worldUnknowns),
                }
            };
        }

        // ── Fixed: TrimEntries not available in Unity's .NET ──
        private static string[] SplitCSV(string csv)
        {
            if (string.IsNullOrEmpty(csv))
                return Array.Empty<string>();

            var parts = csv.Split(',');
            var result = new System.Collections.Generic.List<string>();
            foreach (var part in parts)
            {
                var trimmed = part.Trim();
                if (!string.IsNullOrEmpty(trimmed))
                    result.Add(trimmed);
            }
            return result.ToArray();
        }

        private static bool EnsureManager()
        {
            if (AIGAManager.Instance != null && AIGAManager.Instance.IsReady)
                return true;

            Debug.LogError(
                "[Lore] AIGAManager is not ready. " +
                "Make sure AIGAManager.prefab is in your scene."
            );
            return false;
        }
    }
}
