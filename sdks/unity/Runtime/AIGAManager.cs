// Singleton that manages the Lore sidecar process.
// Drop AIGAManager.prefab into your scene — one per project.

using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Lore
{
    public class AIGAManager : MonoBehaviour
    {
        // Singleton 
        public static AIGAManager Instance { get; private set; }

        // Inspector fields 
        [Header("Sidecar")]
        [Tooltip("Port the sidecar runs on. Default: 7433")]
        public int    port           = 7433;

        [Tooltip("Auto-start the sidecar binary on play. Disable if running manually.")]
        public bool   autoStartSidecar = true;

        [Header("Provider")]
        [Tooltip("Which AI provider to use. Must match lore.config.json")]
        public string provider       = "ollama";

        [Tooltip("Model name. e.g. llama3.2 or claude-haiku-4-5")]
        public string model          = "llama3.2";

        [Header("Debug")]
        public bool   showDebugLogs  = false;

        // Internal 
        private Process     _sidecarProcess;
        private AIGAClient  _client;
        private bool        _ready;

        public AIGAClient Client => _client;
        public bool       IsReady => _ready;

        // Lifecycle
        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _client = new AIGAClient($"http://127.0.0.1:{port}");
        }

        private async void Start()
        {
            if (autoStartSidecar)
                await LaunchSidecarAsync();
            else
                await WaitForSidecarAsync();
        }

        private void OnApplicationQuit()
        {
            if (_sidecarProcess != null && !_sidecarProcess.HasExited)
            {
                Log("Shutting down Lore sidecar...");
                _sidecarProcess.Kill();
                _sidecarProcess.Dispose();
            }
        }

        // Sidecar management 

        private async Task LaunchSidecarAsync()
        {
            var binaryPath = FindSidecarBinary();

            if (binaryPath == null)
            {
                LogWarning(
                    "[Lore] Sidecar binary not found in StreamingAssets/Lore/.\n" +
                    "Download from https://github.com/lore-sdk/lore/releases\n" +
                    "or set autoStartSidecar=false and run manually."
                );
                // Try connecting to an already-running sidecar
                await WaitForSidecarAsync();
                return;
            }

            Log($"Launching sidecar: {binaryPath}");

            _sidecarProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName               = binaryPath,
                    UseShellExecute        = false,
                    RedirectStandardOutput = showDebugLogs,
                    RedirectStandardError  = showDebugLogs,
                    CreateNoWindow         = true,
                }
            };

            if (showDebugLogs)
            {
                _sidecarProcess.OutputDataReceived += (_, e) => { if (e.Data != null) Log(e.Data); };
                _sidecarProcess.ErrorDataReceived  += (_, e) => { if (e.Data != null) LogWarning(e.Data); };
            }

            _sidecarProcess.Start();
            if (showDebugLogs) _sidecarProcess.BeginOutputReadLine();

            await WaitForSidecarAsync();
        }

        private async Task WaitForSidecarAsync()
        {
            Log("Waiting for Lore sidecar...");

            for (var i = 0; i < 20; i++) // wait up to 10 seconds
            {
                if (await _client.IsHealthyAsync())
                {
                    _ready = true;
                    Log($"Lore sidecar ready on port {port}. Provider: {provider}");
                    return;
                }
                await Task.Delay(500);
            }

            LogWarning(
                $"[Lore] Could not connect to sidecar on port {port}.\n" +
                "Make sure the sidecar is running and the port matches."
            );
        }

        private static string FindSidecarBinary()
        {
            var streamingPath = Application.streamingAssetsPath;
            var loreDir       = Path.Combine(streamingPath, "Lore");

            // Platform-specific binary names
            string[] candidates =
            {
#if UNITY_EDITOR_WIN || UNITY_STANDALONE_WIN
                Path.Combine(loreDir, "lore-sidecar-win.exe"),
#elif UNITY_EDITOR_OSX || UNITY_STANDALONE_OSX
                Path.Combine(loreDir, "lore-sidecar-mac"),
#else
                Path.Combine(loreDir, "lore-sidecar-linux"),
#endif
            };

            foreach (var path in candidates)
                if (File.Exists(path)) return path;

            return null;
        }

        // Logging 
        private void Log(string msg)
        {
            if (showDebugLogs) Debug.Log($"[Lore] {msg}");
        }

        private static void LogWarning(string msg) => Debug.LogWarning(msg);
    }
}
