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

## Modern stud (3D blocks)

The look of many 2025–26 hits (tycoons, "steal a…" games), taught in the Figma tutorial *How to make Stud UI* by Hammoudi (UI Genesis).
Full worked example: [../ejemplos/stud-shop-hud.md](../ejemplos/stud-shop-hud.md).

Every colored piece is a **3D block**:

| Layer | Roblox |
|---|---|
| Lip (depth) | `Base` Frame, solid darker shade of the color, full height |
| Outline | `UIStroke` **Outer**, 4–5 px, black, Miter — wraps face + lip as one silhouette |
| Face | child Frame 5–6 px shorter, white + `UIGradient` light→mid (Rotation 90) |
| Rim | `UIStroke` **Inner** 3 px on the face, a very light tint of the color |
| Studs | tiled stud `ImageLabel` on the face, transparency ~0.78 |
| Text | `FredokaOne`-like bold font, white, black stroke 3–4 px **plus** a black copy 3–4 px lower (hard drop shadow) |

Recipe: [../rbxui/recipes.md#3d-stud-block](../rbxui/recipes.md#3d-stud-block). Colors per function (tutorial palette):

| Function | Face top → bottom | Rim | Lip |
|---|---|---|---|
| Header / Base / Index / Buy (green) | `#8BF25C` → `#3FBF2A` | `#B8FF8F` | `#1F7A16` |
| Exit / Sell (red) | `#FF6B6B` → `#D9262E` | `#FF9A9A` | `#7A0F14` |
| Shop / products (blue) | `#5FC8FF` → `#1E7BE8` | `#9BDCFF` | `#0F3E85` |
| Hero offer (orange) | `#FFC14D` → `#FF7A1A` | `#FFDB8F` | `#99400A` |
| Rebirth (pink/purple) | `#FF8BE0` → `#C23CF0` | `#FFB8EE` | `#5E1478` |
| Settings (gray-white) | `#FFFFFF` → `#AEB5C2` | `#FFFFFF` | `#5A6170` |

Window: black at ~0.45 transparency with a 5 px outer black stroke; header + square red exit button built as blocks; **identical padding on all sides** (measure it — the tutorial checks every gap with Alt).

## Do / Don't

- ✅ Few colors, each with one meaning.
- ✅ Grids aligned to the stud spacing.
- ❌ Soft shadows and big radii (breaks the toy look).
- ❌ Studs on text plates — keep text areas flat.

Reference example: [../ejemplos/inventory.md](../ejemplos/inventory.md).
