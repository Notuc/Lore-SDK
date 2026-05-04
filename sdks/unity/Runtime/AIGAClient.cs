using System;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Lore
{
    public class AIGAClient
    {
        private readonly string _baseUrl;
        private readonly int    _timeoutSeconds;

        public AIGAClient(string baseUrl = "http://127.0.0.1:7433", int timeoutSeconds = 30)
        {
            _baseUrl        = baseUrl.TrimEnd('/');
            _timeoutSeconds = timeoutSeconds;
        }

        public async Task<bool> IsHealthyAsync()
        {
            try
            {
                using var req = UnityWebRequest.Get($"{_baseUrl}/health");
                req.timeout   = 5;
                await SendAsync(req);
                return req.responseCode == 200;
            }
            catch { return false; }
        }

        public async Task<DialogueReply> SpeakAsync(
            NPCDefinition npc,
            string        playerMessage,
            GameContext   context = null,
            SpeakOptions  options = null)
        {
            // serialize each field manually 
            // JsonUtility cannot serialize nested private classes
            // or null optional fields correctly.
            // Build the JSON string directly so we control the output.
            var json  = BuildSpeakJson(npc, playerMessage, context, options);
            var bytes = Encoding.UTF8.GetBytes(json);

            Debug.Log($"[Lore] Sending: {json}");

            using var req = new UnityWebRequest($"{_baseUrl}/npc/speak", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout         = _timeoutSeconds;

            await SendAsync(req);

            if (req.responseCode != 200)
                throw new LoreException(
                    $"HTTP/1.1 {req.responseCode} — {req.downloadHandler.text}");

            return JsonUtility.FromJson<DialogueReply>(req.downloadHandler.text);
        }

        public async Task StreamSpeakAsync(
            NPCDefinition         npc,
            string                playerMessage,
            Action<string>        onToken,
            Action<DialogueReply> onReply  = null,
            GameContext           context  = null,
            SpeakOptions         options  = null)
        {
            options        ??= new SpeakOptions();
            options.stream   = true;

            var json  = BuildSpeakJson(npc, playerMessage, context, options);
            var bytes = Encoding.UTF8.GetBytes(json);

            using var req = new UnityWebRequest($"{_baseUrl}/npc/speak", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Accept", "text/event-stream");
            req.timeout         = _timeoutSeconds;
            req.downloadHandler = new SSEDownloadHandler(onToken, onReply);

            await SendAsync(req);
        }

        public async Task SetFlagAsync(string npcId, string key, object value)
        {
            var body  = $"{{\"key\":\"{key}\",\"value\":{ToJsonValue(value)}}}";
            var bytes = Encoding.UTF8.GetBytes(body);

            using var req = new UnityWebRequest($"{_baseUrl}/npc/{npcId}/flag", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout         = _timeoutSeconds;

            await SendAsync(req);
        }

        public async Task ClearMemoryAsync(string npcId)
        {
            using var req = UnityWebRequest.Delete($"{_baseUrl}/npc/{npcId}/memory");
            req.timeout   = _timeoutSeconds;
            await SendAsync(req);
        }

        // JSON builder
        // Builds the speak request JSON manually so every field
        // is serialized correctly regardless of JsonUtility limits.

        private static string BuildSpeakJson(
            NPCDefinition npc,
            string        playerMessage,
            GameContext   context,
            SpeakOptions  options)
        {
            var sb = new StringBuilder();
            sb.Append("{");

            // npc
            sb.Append("\"npc\":");
            sb.Append(BuildNpcJson(npc));
            sb.Append(",");

            // playerMessage
            sb.Append($"\"playerMessage\":{JsonString(playerMessage)}");

            // context (optional)
            if (context != null)
            {
                sb.Append(",\"context\":");
                sb.Append(BuildContextJson(context));
            }

            // options (optional)
            if (options != null && (options.stream || !string.IsNullOrEmpty(options.model)))
            {
                sb.Append(",\"options\":");
                sb.Append(BuildOptionsJson(options));
            }

            sb.Append("}");
            return sb.ToString();
        }

        private static string BuildNpcJson(NPCDefinition npc)
        {
            var sb = new StringBuilder();
            sb.Append("{");
            sb.Append($"\"id\":{JsonString(npc.id)},");
            sb.Append($"\"name\":{JsonString(npc.name)},");
            sb.Append($"\"role\":{JsonString(npc.role)},");
            sb.Append($"\"personality\":{JsonStringArray(npc.personality)},");
            sb.Append($"\"knowledge\":{JsonStringArray(npc.knowledge)}");

            if (!string.IsNullOrEmpty(npc.backstory))
                sb.Append($",\"backstory\":{JsonString(npc.backstory)}");

            if (!string.IsNullOrEmpty(npc.voiceStyle))
                sb.Append($",\"voiceStyle\":{JsonString(npc.voiceStyle)}");

            if (npc.world != null)
            {
                sb.Append(",\"world\":");
                sb.Append(BuildWorldJson(npc.world));
            }

            sb.Append("}");
            return sb.ToString();
        }

        private static string BuildWorldJson(NPCWorld world)
        {
            var sb = new StringBuilder();
            sb.Append("{");
            sb.Append($"\"setting\":{JsonString(world.setting ?? "")}");

            if (!string.IsNullOrEmpty(world.genre))
                sb.Append($",\"genre\":{JsonString(world.genre)}");

            if (!string.IsNullOrEmpty(world.technology))
                sb.Append($",\"technology\":{JsonString(world.technology)}");

            if (world.unknowns != null && world.unknowns.Length > 0)
                sb.Append($",\"unknowns\":{JsonStringArray(world.unknowns)}");

            sb.Append("}");
            return sb.ToString();
        }

        private static string BuildContextJson(GameContext ctx)
        {
            var sb = new StringBuilder();
            sb.Append("{");
            var first = true;

            void Add(string key, string value)
            {
                if (string.IsNullOrEmpty(value)) return;
                if (!first) sb.Append(",");
                sb.Append($"\"{key}\":{JsonString(value)}");
                first = false;
            }

            void AddInt(string key, int value)
            {
                if (value < 0) return; // -1 = not set
                if (!first) sb.Append(",");
                sb.Append($"\"{key}\":{value}");
                first = false;
            }

            Add("playerMood",  ctx.playerMood);
            Add("timeOfDay",   ctx.timeOfDay);
            Add("location",    ctx.location);
            Add("questActive", ctx.questActive);
            AddInt("playerGold",  ctx.playerGold);
            AddInt("playerLevel", ctx.playerLevel);

            sb.Append("}");
            return sb.ToString();
        }

        private static string BuildOptionsJson(SpeakOptions opts)
        {
            var sb = new StringBuilder();
            sb.Append("{");
            sb.Append($"\"stream\":{opts.stream.ToString().ToLower()}");

            if (!string.IsNullOrEmpty(opts.model))
                sb.Append($",\"model\":{JsonString(opts.model)}");

            if (opts.maxTokens > 0)
                sb.Append($",\"maxTokens\":{opts.maxTokens}");

            if (opts.temperature > 0)
                sb.Append($",\"temperature\":{opts.temperature}");

            sb.Append("}");
            return sb.ToString();
        }

        // Helpers 

        private static string JsonString(string s)
        {
            if (s == null) return "null";
            return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        }

        private static string JsonStringArray(string[] arr)
        {
            if (arr == null || arr.Length == 0) return "[]";
            var sb = new StringBuilder("[");
            for (var i = 0; i < arr.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonString(arr[i]));
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string ToJsonValue(object value) => value switch
        {
            bool b   => b.ToString().ToLower(),
            string s => JsonString(s),
            _        => value?.ToString() ?? "null"
        };

        private static Task SendAsync(UnityWebRequest req)
        {
            var tcs = new TaskCompletionSource<bool>();
            req.SendWebRequest().completed += _ =>
            {
                if (req.result == UnityWebRequest.Result.ConnectionError)
                    tcs.SetException(new LoreException(req.error));
                else
                    tcs.SetResult(true);
            };
            return tcs.Task;
        }
    }

    // SSE handler
    public class SSEDownloadHandler : DownloadHandlerScript
    {
        private readonly Action<string>        _onToken;
        private readonly Action<DialogueReply> _onReply;
        private          string                _buffer = "";

        public SSEDownloadHandler(
            Action<string>        onToken,
            Action<DialogueReply> onReply) : base(new byte[1024])
        {
            _onToken = onToken;
            _onReply = onReply;
        }

        protected override bool ReceiveData(byte[] data, int dataLength)
        {
            _buffer += Encoding.UTF8.GetString(data, 0, dataLength);
            var lines = _buffer.Split('\n');
            _buffer = lines[lines.Length - 1];

            for (var i = 0; i < lines.Length - 1; i++)
            {
                var line = lines[i];
                if (line.StartsWith("event: reply")) continue;
                if (!line.StartsWith("data: ")) continue;

                var payload = line.Substring("data: ".Length).Trim();
                if (payload == "[DONE]") continue;

                if (payload.StartsWith("{") && _onReply != null)
                {
                    try
                    {
                        var reply = JsonUtility.FromJson<DialogueReply>(payload);
                        if (reply != null && !string.IsNullOrEmpty(reply.text))
                        {
                            _onReply(reply);
                            continue;
                        }
                    }
                    catch { }
                }

                _onToken?.Invoke(payload.Replace("\\n", "\n"));
            }
            return true;
        }
    }

    [Serializable]
    public class SpeakOptions
    {
        public bool   stream;
        public string model;
        public int    maxTokens;
        public float  temperature;
    }

    public class LoreException : Exception
    {
        public LoreException(string message) : base(message) { }
    }
}
