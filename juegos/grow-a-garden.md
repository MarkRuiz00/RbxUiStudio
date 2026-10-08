# Grow a Garden

**Genre:** farming simulator · **Style family:** [stud](../estilos/stud.md) (classic, square) ·
**Why:** 22.3 M concurrent players in August 2025 (Guinness record at the time); the sequel was top-3 in July 2026.

The lesson: a **deliberately simple, retro UI** can carry the biggest game on the platform if every screen answers one question fast.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬         [ SEEDS ][ GARDEN ][ SELL ]        leaderboard│
│                                                          │
│[🧺 Shop]          ┌ New seeds in 4:49 [RESTOCK][X] ┐      │
│                   │ ▢ Carrot Seed      X22 Stock    │      │
│                   │   10¢               Common      │      │
│                   │ ▢ Strawberry Seed  X4 Stock     │      │
│ 556,934¢          └─────────────────────────────────┘      │
│                 [1][2][3][4][5] default Roblox hotbar        │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Shapes | **No corner radius anywhere.** Rectangles with a thick dark outline and a 3D "lip" at the bottom. |
| Texture | Brown wood/brick plates with a stud row along the border; grass strip on top of the header. |
| Text | Chunky rounded display font, white with a thick dark outline (looks like `FredokaOne`/`LuckiestGuy`, ⚠️ unconfirmed). |
| Money | Bottom-left, italic white number with outline and the `¢` sign, **no box** behind it. |
| Hotbar / leaderboard | Roblox defaults — the game does not rebuild what Roblox already gives. |

Sampled palette (approximate):

| Role | Hex |
|---|---|
| SEEDS teleport (blue) | `#05ADF9` |
| GARDEN teleport (wood brown) | `#4A3424` |
| SELL teleport / close (red) | `#FD0101` |
| Window wood / border | `#513806` |
| Item row card | `#453422` |
| Icon well (lighter wood) | `#AB5D33` |
| Price text (neon green) | `#0CF70D` |
| RESTOCK button (yellow) | `#EDC733` |
| Buy with coins (green) | `#23ED27` |
| Buy with Robux (purple) | `#7921BF` |
| Gift (blue) | `#439AE7` |
| Rarity: Mythical / Divine | `#A05BD8` / `#E95718` |

## Signature components

1. **Teleport tabs top-center.** Three big words, each with its own color = destination. The whole navigation of the game.
2. **Restock header.** `New seeds in 4:49` + a yellow `RESTOCK` (Robux) button + red `X`. The timer turns a static shop into an event.
3. **Stock rows.** Icon well · name · `X22 Stock` · price in green · rarity tag bottom-right. Out of stock = red `NO STOCK`,
   the row stays (you still *see* what you're missing).
4. **Expandable row.** Clicking a row reveals three buttons in a row: price (green), Robux (purple, with glyph), Gift (blue icon).
5. **Limited Time Shop.** Pack cards with per-item odds (`45%`, `34.5%`, `0.5%`), three Robux tiers with a strikethrough
   "was" price on the biggest one, `NEW!` and `LIMITED TIME!` + countdown, and a **"Forever Pack" chain** (reward → ▶ → reward)
   where some steps are FREE and some cost Robux.

## Steal this

- Navigation as 3 colored words at the top instead of a menu.
- Show stock and restock time on anything scarce.
- Keep the "sold out" item visible.
- Put a Gift button next to every Robux button.

## Avoid

- Copying the flat-red/flat-blue look without the outline and lip — without them it reads as a prototype.
- Tiny `X0 Stock` text: in the real game it is small on phones; use ≥ 14 px at 1280×720 design size.

## Build it in rbxui

- Square blocks with lip + stroke: [recipes.md → 3D stud block](../rbxui/recipes.md) and [estilos/stud.md](../estilos/stud.md).
- Restock timer: a `TextLabel` driven by your script; the example [garden-shop](../ejemplos/garden-shop.md) shows the layout.
- Rows: `ScrollingFrame` + `UIListLayout` + `AutomaticCanvasSize = Y` ([layouts.md](../roblox-ui/layouts.md)).

## Sources

Gameplay screenshots seen via Insider Gaming, Deltia's Gaming, Hablamos de Gamers, LDPlayer, VideoGamer and Eurogamer guides
(seed shop, gear shop, limited-time shop). A Figma Community "Grow a Garden redesign" case study (bagjabit) was also seen —
that one is a fan redesign, not the shipped UI.
