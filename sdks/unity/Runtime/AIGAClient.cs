// HTTP client for talking to the Lore sidecar.
// Wraps UnityWebRequest — game loop never blocks.

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

        // Health check 
        public async Task<bool> IsHealthyAsync()
        {
            try
            {
                using var req = UnityWebRequest.Get($"{_baseUrl}/health");
                req.timeout   = 5;
                await SendAsync(req);
                return req.responseCode == 200;
            }
            catch
            {
                return false;
            }
        }

        //Speak (full response) 
        public async Task<DialogueReply> SpeakAsync(
            NPCDefinition npc,
            string        playerMessage,
            GameContext   context = null,
            SpeakOptions  options = null)
        {
            var body = new SpeakRequest
            {
                npc           = npc,
                playerMessage = playerMessage,
                context       = context,
                options       = options
            };

            var json     = JsonUtility.ToJson(body);
            var bytes    = Encoding.UTF8.GetBytes(json);

            using var req = new UnityWebRequest($"{_baseUrl}/npc/speak", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout         = _timeoutSeconds;

            await SendAsync(req);

            if (req.responseCode != 200)
                throw new LoreException($"Sidecar error {req.responseCode}: {req.downloadHandler.text}");

            return JsonUtility.FromJson<DialogueReply>(req.downloadHandler.text);
        }

        // Stream speak
        // Calls stream endpoint and invokes onToken for each token.
        // onReply is called with the full DialogueReply when done.
        public async Task StreamSpeakAsync(
            NPCDefinition    npc,
            string           playerMessage,
            Action<string>   onToken,
            Action<DialogueReply> onReply = null,
            GameContext      context = null,
            SpeakOptions     options = null)
        {
            // Set stream:true in options
            options        ??= new SpeakOptions();
            options.stream   = true;

            var body  = new SpeakRequest
            {
                npc           = npc,
                playerMessage = playerMessage,
                context       = context,
                options       = options
            };

            var json  = JsonUtility.ToJson(body);
            var bytes = Encoding.UTF8.GetBytes(json);

            using var req = new UnityWebRequest($"{_baseUrl}/npc/speak", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Accept", "text/event-stream");
            req.timeout         = _timeoutSeconds;

            // Use SSEDownloadHandler to process tokens as they arrive
            var sseHandler = new SSEDownloadHandler(onToken, onReply);
            req.downloadHandler = sseHandler;

            await SendAsync(req);
        }

        // Set NPC flag 
        public async Task SetFlagAsync(string npcId, string key, object value)
        {
            var body  = $"{{\"key\":\"{key}\",\"value\":{ToJson(value)}}}";
            var bytes = Encoding.UTF8.GetBytes(body);

            using var req = new UnityWebRequest($"{_baseUrl}/npc/{npcId}/flag", "POST");
            req.uploadHandler   = new UploadHandlerRaw(bytes);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout         = _timeoutSeconds;

            await SendAsync(req);
        }

        // Clear NPC memory ─
        public async Task ClearMemoryAsync(string npcId)
        {
            using var req = UnityWebRequest.Delete($"{_baseUrl}/npc/{npcId}/memory");
            req.timeout   = _timeoutSeconds;
            await SendAsync(req);
        }

        // Helpers 
        private static Task SendAsync(UnityWebRequest req)
        {
            var tcs = new TaskCompletionSource<bool>();
            var op  = req.SendWebRequest();

            op.completed += _ =>
            {
                if (req.result == UnityWebRequest.Result.ConnectionError ||
                    req.result == UnityWebRequest.Result.ProtocolError)
                    tcs.SetException(new LoreException(req.error));
                else
                    tcs.SetResult(true);
            };

            return tcs.Task;
        }

        private static string ToJson(object value)
        {
            return value switch
            {
                bool b   => b.ToString().ToLower(),
                string s => $"\"{s}\"",
                _        => value?.ToString() ?? "null"
            };
        }

        //  Request types 
        [Serializable]
        private class SpeakRequest
        {
            public NPCDefinition npc;
            public string        playerMessage;
            public GameContext   context;
            public SpeakOptions  options;
        }
    }

    // SSE handler 
    // Processes Server-Sent Events as they stream in.
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

            // Process complete SSE lines
            var lines = _buffer.Split('\n');
            _buffer   = lines[^1]; // keep incomplete last line

            foreach (var line in lines[..^1])
            {
                if (!line.StartsWith("data: ")) continue;

                var payload = line["data: ".Length..].Trim();

                if (payload == "[DONE]") continue;

                // Check if it's the final reply event
                if (line.StartsWith("event: reply"))
                {
                    var nextLine = ""; // handled by event: reply + data: pattern
                    if (_onReply != null)
                    {
                        try
                        {
                            var reply = JsonUtility.FromJson<DialogueReply>(payload);
                            _onReply(reply);
                        }
                        catch { /* (for now) ignore parse errors on final event */ }
                    }
                    continue;
                }

                // Regular token
                _onToken?.Invoke(payload.Replace("\\n", "\n"));
            }

            return true;
        }
    }

    //  Supporting types 
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
