// Custom Unity Inspector for AIGANPCComponent.
// Shows organized sections and a live test button.

using UnityEngine;
using UnityEditor;
using System.Threading.Tasks;

namespace Lore.Editor
{
    [CustomEditor(typeof(AIGANPCComponent))]
    public class AIGANPCInspector : UnityEditor.Editor
    {
        private string _testMessage   = "Hello, what do you do here?";
        private string _lastResponse  = "";
        private bool   _isTesting;

        public override void OnInspectorGUI()
        {
            var npc = (AIGANPCComponent)target;

            // NPC Identity 
            SectionHeader("NPC Identity");
            npc.npcId       = EditorField("ID",          npc.npcId,       "e.g. elara or a UUID");
            npc.npcName     = EditorField("Name",        npc.npcName,     "e.g. Elara");
            npc.role        = EditorField("Role",        npc.role,        "e.g. merchant, guard, mage");
            npc.personality = EditorField("Personality", npc.personality, "shrewd, warm, street-smart");
            npc.knowledge   = EditorField("Knowledge",   npc.knowledge,   "trade routes, city gossip");

            EditorGUILayout.Space(4);
            EditorGUILayout.LabelField("Backstory", EditorStyles.miniBoldLabel);
            npc.backstory   = EditorGUILayout.TextArea(npc.backstory, GUILayout.MinHeight(60));

            npc.voiceStyle  = EditorField("Voice Style", npc.voiceStyle, "formal | rough | mystical | casual");

            EditorGUILayout.Space(8);

            // World Settings 
            SectionHeader("World Settings");
            npc.worldSetting    = EditorField("Setting",    npc.worldSetting,    "a medieval fantasy kingdom");
            npc.worldTechnology = EditorField("Technology", npc.worldTechnology, "swords, magic, alchemy");
            npc.worldUnknowns   = EditorField("Unknowns",   npc.worldUnknowns,   "AI, computers, guns");

            EditorGUILayout.Space(8);

            // Events 
            SectionHeader("Events");
            DrawPropertiesExcluding(serializedObject,
                "m_Script", "npcId", "npcName", "role",
                "personality", "knowledge", "backstory", "voiceStyle",
                "worldSetting", "worldTechnology", "worldUnknowns"
            );

            EditorGUILayout.Space(8);

            // Debug / Test 
            SectionHeader("Debug");

            if (!Application.isPlaying)
            {
                EditorGUILayout.HelpBox(
                    "Enter Play Mode to use the test speak button.",
                    MessageType.Info
                );
            }
            else
            {
                _testMessage = EditorGUILayout.TextField("Test message", _testMessage);

                GUI.enabled = !_isTesting;
                if (GUILayout.Button(_isTesting ? "Testing..." : "Test Speak"))
                    _ = RunTestSpeak(npc);
                GUI.enabled = true;

                if (!string.IsNullOrEmpty(_lastResponse))
                {
                    EditorGUILayout.LabelField("Last response:", EditorStyles.miniBoldLabel);
                    EditorGUILayout.HelpBox(_lastResponse, MessageType.None);
                }
            }

            serializedObject.ApplyModifiedProperties();
            if (GUI.changed) EditorUtility.SetDirty(target);
        }

        private async Task RunTestSpeak(AIGANPCComponent npc)
        {
            _isTesting    = true;
            _lastResponse = "Waiting...";
            Repaint();

            try
            {
                var reply     = await npc.Speak(_testMessage);
                _lastResponse = reply != null ? reply.text : "No response";
            }
            catch (System.Exception e)
            {
                _lastResponse = $"Error: {e.Message}";
            }
            finally
            {
                _isTesting = false;
                Repaint();
            }
        }

        //  Helpers 

        private static void SectionHeader(string title)
        {
            EditorGUILayout.Space(4);
            EditorGUILayout.LabelField(title, EditorStyles.boldLabel);
            var rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(2);
        }

        private static string EditorField(string label, string value, string placeholder = "")
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(90));
            var result = EditorGUILayout.TextField(string.IsNullOrEmpty(value) ? "" : value);
            if (string.IsNullOrEmpty(result) && !string.IsNullOrEmpty(placeholder))
            {
                var rect = GUILayoutUtility.GetLastRect();
                GUI.Label(rect, placeholder, new GUIStyle(EditorStyles.label)
                {
                    normal = { textColor = Color.gray },
                    fontStyle = FontStyle.Italic
                });
            }
            EditorGUILayout.EndHorizontal();
            return result;
        }
    }
}
