# Stud style

"Classic Roblox toy" look: square, chunky, studded, high contrast. It reads instantly as Roblox.

## Palette

| Role | Gradient (Rotation 90) | Notes |
|---|---|---|
| Lime (buy/play) | `#A6F04E` → `#5FC21F` | the call to action |
| Pink (Robux/premium) | `#FF6FB5` → `#E0307F` | |
| Blue | `#57B8FF` → `#1D78E0` | |
| Orange | `#FFB347` → `#F07A12` | |
| Red (close) | `#FF5A5A` → `#C81E1E` | |
| Window body | `#31333B` → `#292B32` | color only in the header |
| Stroke | `#000000` | 3–4 px, `LineJoinMode: "Miter"` |

## Shapes & sizes

- **Square corners** (no `UICorner`, or 2–4 px max). Black `UIStroke` 3–4 px with **Miter** joins.
- Header bar ~50 px tall in the accent color; close button = red square in the header's right corner.
- Text: `Montserrat` Heavy/Black or `BuilderSans` ExtraBold, white, black `Contextual` stroke 2.5 px.
- Buttons ~**190×54 px**; grid slots square ~**84 px**.

## Texture & effects

- **Stud texture** tiled over every colored piece ([resources](resources.md#stud-textures), e.g. id 90 or 1217), `TileSize` ≈ 24–32 px, `ImageTransparency` 0.7–0.85.
- A 1 px light inner line at the top of buttons (white, 0.6 transparency) suggests a bevel.

## Motion

Snappy, toy-like: press 0.94× in 0.05 s, release 1.0 in 0.1 s Back Out; windows slide up 20 px + fade in 0.2 s.

## Do / Don't

- ✅ Few colors, each with one meaning.
- ✅ Grids aligned to the stud spacing.
- ❌ Soft shadows and big radii (breaks the toy look).
- ❌ Studs on text plates — keep text areas flat.

Reference example: [../ejemplos/inventory.md](../ejemplos/inventory.md).
