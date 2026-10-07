# The rbxui format

A **document** holds one or more **ScreenGuis**; each ScreenGui is one *scene* in the editor. Every node is a real Roblox Instance.

```json
{
  "format": "rbxui",
  "version": 1,
  "name": "MyGameUI",
  "screens": [
    {
      "ClassName": "ScreenGui",
      "Name": "ShopScreen",
      "design": { "width": 1280, "height": 720, "autoScale": true, "background": "#3A6EA5" },
      "props": { "ResetOnSpawn": false },
      "children": []
    }
  ]
}
```

A bare ScreenGui object, or an array of ScreenGuis, is also accepted.

## Node

```json
{ "ClassName": "Frame", "Name": "Window", "props": { }, "children": [ ], "attributes": { }, "interactions": [ ], "buttonFx": { } }
```

| Field | Notes |
|---|---|
| `ClassName` | Any real GUI class: `Frame`, `TextLabel`, `TextButton`, `TextBox`, `ImageLabel`, `ImageButton`, `ScrollingFrame`, `CanvasGroup`, `ViewportFrame`, `VideoFrame`… |
| `Name` | **Unique among siblings** (the validator warns on duplicates; scripts and interactions find objects by name) |
| `props` | Roblox property names → values (types below). Omit properties that keep the default |
| `children` | GUI objects **and** modifiers (`UICorner`, `UIStroke`, `UIGradient`, `UIPadding`, `UIListLayout`, `UIGridLayout`, `UIFlexItem`, `UIScale`, `UIAspectRatioConstraint`, `UISizeConstraint`, `UITextSizeConstraint`…) |
| `attributes` | Instance attributes (`SetAttribute`), strings/numbers/booleans |
| `interactions`, `buttonFx` | No-code behavior, see [interactions.md](interactions.md) |

## Value types

| Roblox type | rbxui JSON | Example |
|---|---|---|
| `Color3` | `"#RRGGBB"` | `"BackgroundColor3": "#2B2F3A"` |
| `UDim2` | `[xScale, xOffset, yScale, yOffset]` | `"Size": [0.5, 0, 0, 56]` |
| `UDim` | `[scale, offset]` | `"CornerRadius": [0, 8]`, `"Padding": [0, 6]` |
| `Vector2` | `[x, y]` | `"AnchorPoint": [0.5, 0.5]` |
| `Rect` | `[minX, minY, maxX, maxY]` | `"SliceCenter": [16, 16, 48, 48]` |
| `ColorSequence` | `"#hex"` or `[[t, "#hex"], …]` | `"Color": [[0, "#FFE76A"], [1, "#FFA51F"]]` |
| `NumberSequence` | number or `[[t, value], …]` (or `[t, v, envelope]`) | `"Transparency": [[0, 0], [1, 0.5]]` |
| `NumberRange` | number or `[min, max]` | |
| Enum | item name as a string | `"FillDirection": "Horizontal"` |
| `Font` (FontFace) | `{ "family", "weight", "style" }` | `{ "family": "FredokaOne", "weight": "Regular", "style": "Normal" }` |
| boolean / number / string | as is | `"Visible": false` |

`family` is a Roblox font family name (`rbxasset://fonts/families/<family>.json`); a full `rbxasset://…` or `rbxassetid://…` also works.
Unknown properties are reported as warnings when building in Studio (`propiedad desconocida`), not silently dropped.

## The design canvas and auto-scale (important)

`design.width × design.height` (default **1280 × 720**) is the canvas you design on. With `"autoScale": true` (default) the bundled
`RbxUINative` LocalScript adds a `UIScale` to each **top-level** child of the ScreenGui with factor `min(screenW / 1280, screenH / 720)`.

Consequences:
- Sizes may be written in **Offset pixels of the 1280×720 canvas**; they scale with the screen. ✔
- **Positions of top-level children must use Scale + AnchorPoint** (e.g. top-right corner `Position [1,-16,0,16]`, `AnchorPoint [1,0]`), because `UIScale` scales size, not position.
- Deeper children are inside a scaled parent, so their Offsets scale too.
- Set `"autoScale": false` to handle scaling yourself (pure Scale layouts / your own `UIScale`).

Other `design` keys: `device` (preview frame) and `background` (preview only, never exported: a color, `baseplate`, `sky`, …).

## Top bar

The editor shades the top **58 px** (Roblox top bar). The ScreenGui default `ScreenInsets = CoreUISafeInsets` already keeps UI below it in-game;
don't place important content in that band of the canvas.

## Validation

`POST /api/rbxui/import` (what `rbxui_put_scene` calls) checks: root is `ScreenGui`, every node has `ClassName`, sibling names are unique.
It does **not** check property names/values — render it and read the warnings from Studio builds.
