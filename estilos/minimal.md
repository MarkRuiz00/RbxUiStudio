# Minimal style

Calm, flat, information-first. The game world is the star; the UI gets out of the way.

## Palette

| Role | Dark theme | Light theme |
|---|---|---|
| Surface | `#16181D` @ 0.15 transparency | `#FFFFFF` @ 0.05 |
| Raised surface | `#23262D` | `#F2F3F5` |
| Stroke | `#FFFFFF` @ 0.88 transparency, 1 px | `#000000` @ 0.9, 1 px |
| Text primary | `#F2F3F5` | `#15171C` |
| Text secondary | `#9AA0AA` | `#5E6470` |
| Accent | one color, e.g. `#3B82F6` (blue) or `#22C55E` (green) |
| Danger | `#EF4444` |

## Shapes & sizes

- Radius **6–10 px**; strokes 1 px, low contrast.
- Font: `BuilderSans` (Medium for body, Bold for titles) or `Roboto`; sizes 14 / 16 / 20 / 28.
- Buttons ~**40–48 px** tall, text-only or icon+text; primary filled with the accent, secondary outlined.
- Settings rows: 48 px tall, label left, control right, 1 px dividers.

## Texture & effects

None, or a very subtle noise. Use transparency + `UIStroke` for depth instead of shadows.
Icons: one line-icon set, same stroke weight.

## Motion

Short and linear-ish: fades 0.15 s, slides 8–12 px with Quad Out 0.2 s. No bounces.

## Do / Don't

- ✅ Alignment and spacing do the work (8 px grid).
- ✅ Show only what matters now (progressive disclosure).
- ❌ Outlined white text on dark plates (that's simulator); here contrast comes from the surface.
- ❌ More than one accent color.

Reference examples: [../ejemplos/settings.md](../ejemplos/settings.md), [../ejemplos/loading-screen.md](../ejemplos/loading-screen.md).
