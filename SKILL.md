---
name: rbxui-studio
description: Design high-quality Roblox game UI (shops, inventories, HUDs, settings menus, loading screens, reward popups) and build it as real Roblox Instances with RbxUI Studio, a "Figma for AI" editor. Use whenever the user asks to make, redesign, review or fix a Roblox interface, a ScreenGui, a menu or a button style, wants "simulator / cartoony / stud style" UI, mentions rbxui, RbxUI Studio, UDim2, AnchorPoint, UIListLayout, UIGradient or 9-slice, wants a design pasted from Figma turned into Roblox UI, or asks for UI "like" a hit game (Grow a Garden, Pet Simulator 99, Adopt Me, Blox Fruits, Steal a Brainrot, RIVALS, DOORS, Brookhaven, Dress to Impress, Anime Vanguards, Fisch, 99 Nights, BedWars, Blade Ball, MM2).
---

# RbxUI Studio — Roblox UI skill

You design Roblox interfaces as **JSON trees of real Roblox Instances** (`rbxui` format), preview them, and install them in Studio.
Everything here was checked against the official Roblox docs (create.roblox.com/docs). Anything not confirmed there is marked **⚠️ unverified**.

## Golden rules

1. **Scale for layout, Offset for detail.** Containers and screen placement in `Scale`; borders, padding, icon gaps in `Offset`. → [roblox-ui/udim2.md](roblox-ui/udim2.md)
2. **AnchorPoint is 0, 0.5 or 1** and must match where the element is pinned (right edge → `AnchorPoint.X = 1`). → [roblox-ui/anchorpoint.md](roblox-ui/anchorpoint.md)
3. **Lock shapes with `UIAspectRatioConstraint`** so buttons and cards don't stretch on wide/tall screens. → [roblox-ui/aspect-ratio.md](roblox-ui/aspect-ratio.md)
4. **Let layouts place children** (`UIListLayout`, `UIGridLayout`, `UIPadding`); never hand-place 20 slots. → [roblox-ui/layouts.md](roblox-ui/layouts.md)
5. **Respect the safe area and top bar** (`ScreenInsets = CoreUISafeInsets`, the default). → [roblox-ui/safe-area.md](roblox-ui/safe-area.md)
6. **Text stays readable**: `TextScaled` + `UITextSizeConstraint`, never below 9 px. → [roblox-ui/text.md](roblox-ui/text.md)
7. **One style per game**: one palette, one corner radius, one stroke width, one font family. → [estilos/](estilos/README.md)
8. **Textures are reused, color is separate**: one grayscale/alpha texture asset tinted with `ImageColor3` / `UIGradient`. → [roblox-ui/images.md](roblox-ui/images.md)
9. **Follow genre conventions**: players already know where the top games put money, menus, close and the hotbar. → [juegos/](juegos/README.md)
10. **Look before you ship**: render, compare, run the [checklist](checklist.md).

## Workflow

1. **Understand** the screen: who uses it, on what device (phone first), what is the one main action.
2. **Pick a style** from [estilos/](estilos/README.md) (or the user's own examples via `rbxui_design_guide`), and read how the
   hit game of that genre lays it out in [juegos/](juegos/README.md). Asked for "like <game>"? Copy the **pattern**, never the art.
3. **Read** [rbxui/format.md](rbxui/format.md) once, then write the scene as one `rbxui` document.
4. **Save + preview** with the MCP: `rbxui_put_scene` → `rbxui_render` → look at the PNG → fix → repeat.
5. **Check** with [checklist.md](checklist.md) (phone size, safe area, contrast, 44 px touch targets).
6. **Ship**: `rbxui_studio_install` (Studio open + RbxUI Connect plugin) or `rbxui_build` → Luau.

No MCP? Write the JSON and let the user paste it into the editor (Ctrl+V) — see [rbxui/without-mcp.md](rbxui/without-mcp.md).

## Map of this repo

| Folder | What's inside |
|---|---|
| [roblox-ui/](roblox-ui/README.md) | Engine fundamentals: UDim2, AnchorPoint, constraints, layouts, modifiers, 9-slice, images, safe area, ZIndex, text, responsive |
| [estilos/](estilos/README.md) | Style guides of top games (simulator, cartoony, stud, minimal) + curated textures/sunbursts from ui-resources.com |
| [rbxui/](rbxui/README.md) | How to do each thing in rbxui (format, MCP tools, interactions, images, Figma import) + common mistakes |
| [juegos/](juegos/README.md) | Teardowns of 20 top Roblox games' UIs (screen maps, sampled palettes, signature components) + 16 shared conventions |
| [ejemplos/](ejemplos/README.md) | 15 complete, tested UIs in rbxui format with design notes and renders (6 inspired by hit games) |
| [checklist.md](checklist.md) | Final verification list |
| [tool/](tool/README.md) | RbxUI Studio itself (editor, MCP server, Studio plugin) |
