# Using rbxui without MCP

Any chat AI (ChatGPT, Gemini, Grok, Claude.ai…) can produce rbxui:

1. In the editor open **JSON rbxui → Prompt IA** (the editor UI is in Spanish) (or `GET http://localhost:5170/api/ai-prompt?examples=marked`) and paste that text into the chat — it contains the format spec and the user's reference examples.
2. Ask for the screen. The AI answers with one JSON block (`{"format":"rbxui",…}`).
3. Copy the JSON and press **Ctrl+V** in the editor (or *Importar JSON rbxui*). The scene opens; fix in the editor or ask the AI for changes.
4. Install: editor → **Construir en Roblox** → *Instalar en Studio* (plugin), or download the generated `.build.luau`.

Without the editor at all: the Luau builder (`tool/studio/rbxbuild.mjs`) turns a document into a ModuleScript that creates the Instances:

```bash
node tool/studio/rbxbuild.mjs path/to/doc.rbxui.json   # -> tool/out/native/<name>.build.luau
```

Run it in Studio's command bar via a temporary ModuleScript: `require(module)({})` builds the ScreenGuis in StarterGui
(local `assets/...` images must be uploaded first; the plugin does that automatically).
