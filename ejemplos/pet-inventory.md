# Pet inventory

![](renders/pet-inventory.png) · JSON: [pet-inventory.rbxui.json](pet-inventory.rbxui.json) · Style: [simulator](../estilos/simulator.md) (clean white) ·
Patterns from: [Pet Simulator 99](../juegos/pet-simulator-99.md)

**Purpose:** a collection-sim inventory where the window is calm and white, and the world-facing HUD has no boxes.

## What to notice

| Element | How it's built | Why |
|---|---|---|
| Title | `TitleIcon` (rotated −8°, bigger than the header) + `Inventory!` text sitting **on** the top edge (`AnchorPoint Y = 0.5` at `Position Y = 0`) | each window gets a sticker-like identity |
| Header controls | segmented filter pill, `Search` TextBox (pill, `UIStroke` with `ApplyStrokeMode = Border`), pink-red close | same row, same height (42–54 px) |
| Pattern | tiled hexagon texture at 0.9 transparency, tinted gray | texture without noise |
| Category rail | vertical `UIListLayout` inside a rounded gray rail, red count badges | categories stay visible while the grid scrolls |
| Grid | `UIGridLayout` of **tile-less** pets: icon + outlined value bottom-right, star = favorite, green dot = equipped | dense grids read better without boxes |
| HUD | currencies = icon + outlined number; quests right-aligned with progress in cyan; green `Rewards` | the HUD tells you what to do next |
| Main menu | bottom-center row of 70 px sticker buttons, red badge on the first | one home edge for menus |

## Notes

- `Your Team 16/20` uses `RichText` to color only the count.
- TextBoxes and TextButtons need `ApplyStrokeMode = Border` on their `UIStroke`, otherwise the stroke outlines the **text**.
