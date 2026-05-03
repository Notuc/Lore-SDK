# Lore SDK — Unity

AI-powered NPC dialogue for Unity games.

## Install

Window → Package Manager → + → Add package from git URL:
```
https://github.com/Notuc/Lore-SDK.git?path=sdks/unity
```

## Setup

1. Drag `Packages/Lore SDK/Prefabs/AIGAManager.prefab` into your scene
2. Download the sidecar binary from [releases](https://github.com/lore-sdk/lore/releases)
3. Place it in `Assets/StreamingAssets/Lore/`
4. Add `AIGANPCComponent` to your NPC GameObject
5. Fill in the Inspector fields

## Usage

```csharp
using Lore;

public class DialogueTrigger : MonoBehaviour
{
    private AIGANPCComponent _npc;

    void Start() => _npc = GetComponent<AIGANPCComponent>();

    // Simple speak
    public async void OnPlayerInteract(string playerText)
    {
        var reply = await _npc.Speak(playerText);
        dialogueUI.text = reply.text;
        animator.Play(reply.emotion);
    }

    // With context
    public async void OnPlayerInteractWithContext(string playerText)
    {
        var context = new LoreContextBuilder()
            .WithTimeOfDay("evening")
            .WithLocation("marketplace")
            .WithPlayerGold(playerGold)
            .WithFlag("questActive", currentQuestId)
            .Build();

        var reply = await _npc.Speak(playerText, context);
        dialogueUI.text = reply.text;
    }

    // Streaming — text appears word by word
    public async void OnPlayerInteractStreaming(string playerText)
    {
        dialogueUI.text = "";
        _npc.OnToken.AddListener(token => dialogueUI.text += token);
        await _npc.StreamSpeak(playerText);
    }
}
```

## Inspector fields

| Field | Description |
|---|---|
| NPC ID | Unique identifier. Used for memory. |
| Name | Display name |
| Role | e.g. merchant, guard, mage |
| Personality | Comma-separated traits |
| Knowledge | Comma-separated topics |
| Backstory | Optional lore paragraph |
| Voice Style | formal, rough, mystical, casual |
| World Setting | One sentence describing the world |
| World Technology | What tech exists in the world |
| World Unknowns | Comma-separated things that don't exist |
