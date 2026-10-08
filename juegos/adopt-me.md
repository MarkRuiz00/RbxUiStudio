# Adopt Me!

**Genre:** roleplay / pets · **Style family:** [cartoony](../estilos/cartoony.md) ("paper cards") ·
**Why:** #2 by concurrent players in June 2026 (~324K) and one of the most visited experiences ever.

The lesson: **windows look like stacked paper cards**, every category is a big friendly pill, and bundles carry value tags.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬     (🍔)(🛁)(🍴)(🌙)(🚿) needs      [$ 156 ▶] event⏱  │
│[event card]                                         [🛒 SHOP]│
│                ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲                [👗 DRESS]│
│               │🎒 BACKPACK [🔍 Search] (X)│            [📖 JOURNAL]│
│               │[Favorites][+][▢][▢][▢]   │            [👥 FRIENDS]│
│               │[Pets    ] [▢][▢][▢][▢]   │                    │
│               ╲________________________╱                     │
│                         (🎒)                                  │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Window | Light tinted body (`#B4EFFF` light blue; mint and lavender variants exist) on top of a **second card rotated a few degrees** behind it. |
| Header | Angled tab (trapezoid) in a deeper tint with icon + title in caps (`BACKPACK`), a search pill inside the header. |
| Close | Red rounded square (`#D9293F`) with white X, hanging on the top-right corner. |
| Categories | Green pills (`#51C458`) with white icon + label; the selected one turns **orange** (`#F49426`). Pagination `‹ 1/2 ›` in green. |
| Tiles | White rounded squares; the first tile is a big green `+` (add / buy more). |
| HUD | Top-center round "needs" icons; top-right money on a white **torn-paper banner** with a green `$`; right column of square icon buttons with a colored label ribbon under each (`SHOP`, `DRESS UP`, `JOURNAL`, `FRIENDS`). |
| Main action | Bottom-center circular backpack button. |
| Font | Rounded friendly sans, white on color with soft shadow rather than heavy outline (⚠️ unconfirmed). |

## Signature components

1. **Bucks store** — 3×2 grid of white cards, big number + "Bucks", Robux price on a blue footer (`#3EBFEE`), and value tags
   on the bigger packs: `GOOD VALUE`, `GREAT VALUE`, `BEST DEAL!`.
2. **Weather/event board** (`NOW` / `UPCOMING`) with day counters — a calendar as a reason to come back.
3. **Event timer badge** near the money with a countdown.

## Steal this

- The rotated card behind the window — one extra Frame, huge personality.
- Selected state by **changing hue** (green → orange), not just brightness.
- Value tags on bundles to steer the purchase.

## Build it in rbxui

Back card: a sibling `Frame` with `Rotation = -3` and lower `ZIndex`. Angled header: an `ImageLabel` with a trapezoid
image or a `Frame` + `UIGradient` with transparency cut ([recipes.md](../rbxui/recipes.md)).

## Sources

Gameplay screenshots via TheGamer, Sportskeeda and Reddit (backpack, bucks shop, weather board, HUD).
