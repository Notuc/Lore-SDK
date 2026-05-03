// Drag onto any NPC GameObject. Fill in the Inspector.
// Call Speak() from your dialogue trigger script.

using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Events;

namespace Lore
{
    public class AIGANPCComponent : MonoBehaviour
    {
        // Inspector — NPC Identity 
        [Header("NPC Identity")]
        public string   npcId;
        public string   npcName;
        public string   role;

        [Tooltip("Comma-separated personality traits. e.g. shrewd,warm,street-smart")]
        public string   personality;

        [Tooltip("Comma-separated knowledge domains. e.g. trade routes,city gossip")]
        public string   knowledge;

        [TextArea(2, 4)]
        public string   backstory;

        [Tooltip("formal | rough | mystical | technical | casual")]
        public string   voiceStyle;

        // Inspector — World Settings 
        [Header("World Settings")]
        [Tooltip("One sentence describing the world. e.g. a medieval fantasy kingdom")]
        public string   worldSetting;

        [Tooltip("What technology exists. e.g. swords and magic")]
        public string   worldTechnology;

        [Tooltip("Comma-separated concepts that don't exist. e.g. AI,computers,guns")]
        public string   worldUnknowns;

        // Inspector — Events 
        [Header("Events")]
        [Tooltip("Fires when the NPC replies. Passes the reply text.")]
        public UnityEvent<string>        OnReply;

        [Tooltip("Fires for each streaming token.")]
        public UnityEvent<string>        OnToken;

        [Tooltip("Fires when an error occurs.")]
        public UnityEvent<string>        OnError;

        [Tooltip("Fires when the NPC replies with the full DialogueReply object.")]
        public UnityEvent<DialogueReply> OnDialogueReply;

        // Internal 
        private NPCDefinition _definition;

        private void Awake()
        {
            _definition = BuildDefinition();
        }

        // Public API 

        /// <summary>
        /// Send a player message and get the full reply.
        /// Await this from your dialogue trigger script.
        /// </summary>
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

        /// <summary>
        /// Stream the NPC reply token by token.
        /// OnToken fires for each incoming token.
        /// OnDialogueReply fires with the final reply when done.
        /// </summary>
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
                    token  => OnToken?.Invoke(token),
                    reply  => OnDialogueReply?.Invoke(reply),
                    context
                );
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[Lore] StreamSpeak error: {e.Message}");
            }
        }

        /// <summary>
        /// Set a game state flag on this NPC.
        /// Affects future dialogue responses.
        /// </summary>
        public async Task SetFlag(string key, object value)
        {
            if (!EnsureManager()) return;
            await AIGAManager.Instance.Client.SetFlagAsync(npcId, key, value);
        }

        /// <summary>
        /// Wipe this NPC's memory. Use at new game session start.
        /// </summary>
        public async Task ClearMemory()
        {
            if (!EnsureManager()) return;
            await AIGAManager.Instance.Client.ClearMemoryAsync(npcId);
        }

        // Helpers 

        private NPCDefinition BuildDefinition()
        {
            return new NPCDefinition
            {
                id          = string.IsNullOrEmpty(npcId) ? npcName.ToLower().Replace(" ", "-") : npcId,
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

        private static string[] SplitCSV(string csv)
        {
            if (string.IsNullOrEmpty(csv)) return Array.Empty<string>();
            return csv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        }

        private static bool EnsureManager()
        {
            if (AIGAManager.Instance != null && AIGAManager.Instance.IsReady)
                return true;

            Debug.LogError(
                "[Lore] AIGAManager is not ready. " +
                "Make sure AIGAManager.prefab is in your scene and the sidecar is running."
            );
            return false;
        }
    }
}
