# Cartoony style

Friendly, soft, bouncy. Rounded everything, bright but light colors, generous spacing.

## Palette

| Role | Color |
|---|---|
| Background panels | `#FFF8EC` (cream) with `#FFE3B8` inner header |
| Primary button | `#FF8FB1` → `#FF5D8F` (pink) or `#7ED957` → `#4CB944` (green) |
| Secondary button | `#8FD3FF` → `#4FA9F5` |
| Text dark | `#4A2F27` (warm brown instead of black) |
| Stroke | `#4A2F27` 2–3 px, or a darker shade of the fill |
| Accent / rewards | `#FFD447` |

## Shapes & sizes

- Corner radius **12–20 px**; pills (`CornerRadius [0.5,0]`) for buttons and tags.
- Stroke **2–3 px**, colored (darker version of the fill) rather than black.
- Buttons ~**180×56 px**, icon buttons ~**64 px**; padding 16–24 px inside windows.
- Fonts: `FredokaOne` (titles/buttons), `Nunito` or `BuilderSans` (body).
- Optional soft drop shadow: a copy of the panel 4 px lower, `#000000` at 0.75 transparency.

## Texture & effects

- Light textures only: polka dots, soft halftones ([resources](resources.md#halftones)) at high transparency.
- Stickers/icons with white outline.
- Stars/sparkles for rewards.

## Motion

| Element | Animation |
|---|---|
| Window open | `UIScale` 0.6→1, 0.35 s **Back Out** (bouncier) |
| Buttons | press 0.9×, release Elastic Out 0.3 s |
| Idle | gentle bob of the main CTA (Position Y ±3 px, 1.6 s Sine InOut, looped) |

## Do / Don't

- ✅ Warm darks instead of pure black; lots of white space.
- ✅ Illustrated icons with consistent outline width.
- ❌ Sharp corners mixed with round ones.
- ❌ Neon saturated gradients (that's the simulator style).

Reference example: [../ejemplos/daily-reward.md](../ejemplos/daily-reward.md).
