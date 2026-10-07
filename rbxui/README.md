# Using rbxui (RbxUI Studio)

How an AI builds Roblox UI with RbxUI Studio. Install/run the tool first: [../tool/README.md](../tool/README.md).

| File | What |
|---|---|
| [format.md](format.md) | The `rbxui` JSON format: document, nodes, value types, design canvas, auto-scale |
| [mcp-tools.md](mcp-tools.md) | Every MCP tool, its arguments, and the design → render → fix loop |
| [recipes.md](recipes.md) | How to make each common piece (window, buttons, currency pill, tabs, grid, scroll, progress bar, textures, sunburst…) |
| [interactions.md](interactions.md) | Opening/closing windows and button effects without code |
| [images.md](images.md) | Image paths, ui-resources, logos, uploading to Roblox |
| [figma-import.md](figma-import.md) | Pasting designs from Figma and what they become |
| [without-mcp.md](without-mcp.md) | Using rbxui from any chat AI (copy/paste) |
| [mistakes.md](mistakes.md) | Common errors and how to fix them |

## The loop in one picture

```
rbxui_design_guide ─▶ write JSON ─▶ rbxui_put_scene ─▶ rbxui_render ─▶ look ─┐
        ▲                                                                   │ fix
        └───────────────────────────────────────────────────────────────────┘
                                   │ good
                                   ▼
                 rbxui_studio_install  (or rbxui_build → Luau)
```
