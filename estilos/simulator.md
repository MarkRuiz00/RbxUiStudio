# Simulator style

Loud, juicy, readable from a phone at arm's length. Every button looks like candy; numbers are huge.

## Palette

| Role | Gradient (top → bottom, `UIGradient` Rotation 90) | Stroke |
|---|---|---|
| Buy / confirm (green) | `#9BFF5C` → `#2DBA3C` | `#0F4A16` |
| Robux / premium (gold) | `#FFE76A` → `#FFA51F` | `#6B3A00` |
| Rebirth / special (purple) | `#D59BFF` → `#8A3CFF` | `#2E0F5C` |
| Info / pets (blue) | `#7FDBFF` → `#1F7CFF` | `#0A2B66` |
| Close / danger (red) | `#FF7A7A` → `#E8263B` | `#5C0A12` |
| Window body | `#2B2F3A` → `#1E212A` | `#0B0C10` |

Rainbow gradients (`#EE01E9 #0414FE #06F0EA #40FD1F #A5FF00 #F3FF01 #FAB71C #FE0C02`) are reserved for the rarest items / best offers.

## Shapes & sizes (1280×720 design canvas)

- Corner radius **6–8 px**; stroke **3 px** `Border` + text stroke **2.5–3 px** `Contextual`, both near-black.
- Side-menu buttons: **~70–80 px square** (≈ `[0.06,0,0.11,0]` + `UIAspectRatioConstraint 1`), icon fills 70 %, label overlaps the bottom edge.
- Primary window button: **~200×56 px**; currency pill: **~180×44 px** with icon overlapping the left edge.
- Window: ~**60 % width**, header 50–60 px with colored gradient, body dark.

## Texture & effects

- Diagonal shine stripes + tiled studs inside each colored piece, **Overlay** in Figma → in Roblox: white/black alpha textures tinted to the piece color (RbxUI does this on import). Use [stud textures](resources.md#stud-textures) at `ImageTransparency` 0.75–0.85.
- **Sunburst** behind rewards/eggs ([resources](resources.md#sunbursts)), slowly rotating.
- **Sparkles** on the corners of premium buttons.
- Fonts: `FredokaOne` / `LuckiestGuy` for numbers and buttons, white with dark stroke.

## Motion (TweenService)

| Element | Animation |
|---|---|
| Buttons | hover 1.06×, press 0.92× (0.08 s Quad Out), release Back Out |
| Window open | `UIScale` 0.8→1, 0.25 s Back Out |
| Currency gain | number count-up 0.8 s + icon punch 1.2×→1 |
| Sunburst | Rotation +360 every 8–12 s, Linear, looped |
| Best-offer button | shine sweep (`UIGradient.Offset` −1→1, 1.2 s, repeat every 3 s) |

## Do / Don't

- ✅ Big numbers with suffixes (`12.5K`, `3.4M`), icons next to every currency.
- ✅ A red "!" badge on buttons with something to claim.
- ❌ More than ~6 side buttons — group the rest in a "More" menu.
- ❌ Gradients on everything at full saturation **and** a busy world behind: keep window bodies dark/neutral.

Reference example: [../ejemplos/simulator-hud.md](../ejemplos/simulator-hud.md), [../ejemplos/shop.md](../ejemplos/shop.md).
