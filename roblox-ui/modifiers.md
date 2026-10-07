# Appearance modifiers: UICorner, UIStroke, UIGradient

Insert them as children of the object they decorate.
Source: [Appearance modifiers](https://create.roblox.com/docs/ui/appearance-modifiers) · [UIStroke](https://create.roblox.com/docs/reference/engine/classes/UIStroke) · [UIGradient](https://create.roblox.com/docs/reference/engine/classes/UIGradient)

## UICorner

`CornerRadius` is a `UDim`: `[0, 8]` = 8 px; `[0.5, 0]` = pill/circle (half of the shorter side).
Pick **one radius per game** (e.g. 8 px panels, 6 px buttons, 999/0.5 for pills). `UIScale` scales it too.

## UIStroke

| Property | Notes |
|---|---|
| `Thickness` | Pixels by default, or relative to the parent depending on `StrokeSizingMode` |
| `Color`, `Transparency` | Stroke color/opacity |
| `ApplyStrokeMode` | `Contextual` (on a text object: outlines the **glyphs**) · `Border` (outlines the box) |
| `BorderStrokePosition` | Where a border stroke sits: `Inner`, `Center` or `Outer` |
| `StrokeSizingMode` | `FixedSize` (pixels) or `ScaledSize` (relative to the parent) |
| `LineJoinMode` | `Round`, `Bevel`, `Miter` — use `Miter` for square "stud" corners |

Text outline: a `UIStroke` child of a `TextLabel` with `ApplyStrokeMode: "Contextual"` (thickness 2–4 px) is the #1 trick for readable game text on busy backgrounds.
A `UIGradient` *inside* a `UIStroke` colors the stroke.

## UIGradient

| Property | Notes |
|---|---|
| `Color` | `ColorSequence` → rbxui `[[0,"#FFE066"],[1,"#FF9F1C"]]` |
| `Transparency` | `NumberSequence` → `[[0,0],[1,0.6]]` |
| `Rotation` | Degrees, **clockwise**, starting left→right. `90` = top→bottom |
| `Offset` | `Vector2` scalar shift from the center (×AbsoluteSize). Animate it for shine sweeps |

**The gradient multiplies the object's color.** Set `BackgroundColor3` (or `ImageColor3`, `TextColor3`) to white `#FFFFFF` and put the real colors in the gradient; otherwise the colors get darker/tinted.

```json
{ "ClassName": "Frame", "Name": "BuyButton", "props": { "BackgroundColor3": "#FFFFFF", "Size": [0, 180, 0, 56] },
  "children": [
    { "ClassName": "UICorner",   "Name": "Corner",   "props": { "CornerRadius": [0, 8] } },
    { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#7CF05A"], [1, "#2DB84B"]], "Rotation": 90 } },
    { "ClassName": "UIStroke",   "Name": "Stroke",   "props": { "Thickness": 3, "Color": "#0E3B1A", "ApplyStrokeMode": "Border" } }
  ] }
```

A vertical light→dark gradient (top lighter) reads as "raised/clickable". Reverse it for pressed states.

## Pitfalls

- Stacking several `UIGradient`s on one object is not a documented pattern (⚠️ unverified which one wins). Use one per object; layer extra effects as child frames/images.
- On a `TextButton`, a `Contextual` stroke outlines the **text** and a `Border` stroke outlines the **box**. Need both? Use a box `UIStroke` (`Border`) on the button and put the label in a child `TextLabel` with its own `Contextual` stroke.
- `Outer`/`Center` strokes draw outside the box: leave room in tight grids, or use `Inner`.
