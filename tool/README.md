# RbxUI Studio (the tool)

A Figma-like editor where **AIs and people design Roblox UI as real Instances**. Scenes are JSON trees of genuine Roblox classes
(`rbxui` format), previewed in the browser exactly as Roblox lays them out, and installed into Roblox Studio with one click.

- **Editor** (`http://localhost:5170/`): projects & folders, layers, canvas with snapping, properties (fill/gradient stack, stroke, corners, text, layouts), icons, logos, phone preview.
- **MCP server** (`studio/mcp.mjs`): lets Claude Code, Claude Desktop, Cursor or any MCP client design, render and install UIs.
- **Roblox Studio plugin** (`plugin/RbxUIConnect.plugin.luau`): installs scenes into `StarterGui`, uploads local images (no API key), pulls existing ScreenGuis back into the editor.
- **Figma import**: paste (Ctrl+V) frames copied from Figma → editable Instances (auto-layout → UIListLayout, textures → tinted shared images, masks, prototypes → interactions). Coverage: [docs/figma-cobertura.md](docs/figma-cobertura.md).
- **Runtime** (`runtime/RbxUINative.client.luau`): plays `interactions` (open/close/toggle windows with animations) and `buttonFx` (hover/press scale) in the game.

## Install

Requires **Node.js 20+** and Google Chrome (or Playwright's Chromium).

```bash
cd tool
npm install
npm run browser      # only if Google Chrome is not installed
npm start            # -> http://localhost:5170/
```

Windows: double-click `RbxUI Studio.bat`. Port: `PORT=5180 npm start`.

## Connect an AI (MCP)

In the editor: **MCP** button (plug icon) → *Connect* to Claude Code / Claude Desktop / Cursor. Or manually:

```bash
claude mcp add -s user rbxui -- node /absolute/path/to/tool/studio/mcp.mjs
```

```json
{ "mcpServers": { "rbxui": { "command": "node", "args": ["/absolute/path/to/tool/studio/mcp.mjs"] } } }
```

The MCP starts the editor server if it isn't running. Tools: see [../rbxui/mcp-tools.md](../rbxui/mcp-tools.md).

## Connect Roblox Studio

Editor → **Studio** button → *Install plugin* (copies it to `%LOCALAPPDATA%\Roblox\Plugins\`; on macOS copy `plugin/RbxUIConnect.plugin.luau`
to `~/Documents/Roblox/Plugins/` as `.lua`). Open a place, allow HTTP to `localhost` when Studio asks, and the widget turns green.

## Folders

| Path | Content | In git |
|---|---|---|
| `studio/` | server, editor, renderer, Figma importer, MCP | ✅ |
| `plugin/`, `runtime/` | Roblox Studio plugin and in-game LocalScript | ✅ |
| `site/` | product landing page (`/landing`) | ✅ |
| `ds/`, `export.mjs` | legacy HTML design-system → PNG pipeline | ✅ |
| `studio/brand/`, `assets/brand/` | RbxUI logo, mascots, Robux icons | ✅ |
| `screens/` | your scenes (`<Name>.scene.json`) | ❌ (local) |
| `examples/` | your "AI study notes" (reference UIs for the AI) | ❌ |
| `assets/figma/`, `assets/logos/`, `assets/ui-resources/` | imported/uploaded images | ❌ |
| `assets/studs/` | optional icon pack (not redistributable — bring your own) | ❌ |

## Images

`Image` accepts `rbxassetid://ID` or a local path relative to `tool/` (e.g. `assets/ui-resources/Textures/Stud/0090_Stud_texture.png`).
Local images are uploaded by the Studio plugin when you install a scene and remembered in `assets/rbx_assets.json`.
Textures, sunbursts and backgrounds: `node ../tools/ui-resources.mjs fetch <id>` (see [../estilos/resources.md](../estilos/resources.md)).

## Privacy & network

The server listens on your machine. Phone preview over Wi-Fi requires a per-install token (`.secrets/lan.json`); MCP/plugin
management endpoints only answer `localhost`. Don't expose the port to the internet.

## Known limits

- The preview doesn't draw 9-slice (`ScaleType: "Slice"`), `IgnoreGuiInset` or `SafeAreaCompatibility` — verify those in Studio.
- Only open/close/toggle interactions and button scale effects run without code; game logic (purchases, data) is your Luau.
- The validator checks structure (ScreenGui root, ClassName, unique sibling names), not every property value.

Internal notes (Spanish): [docs/INTERNALS.es.md](docs/INTERNALS.es.md).
