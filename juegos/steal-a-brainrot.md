# Steal a Brainrot

**Genre:** tycoon / steal · **Style family:** [stud](../estilos/stud.md) (2025 trend) ·
**Why:** 25 M+ concurrent players in September 2025; still top-10 in June 2026 (~151K).

The lesson: **the screen HUD is almost empty because the information lives in the world** (BillboardGuis over every character).

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬                                                     │
│[📖 Index ]        Diamond  Svinina Bombardino             │
│[🔄 Rebirth]       Common   $15/s  $1.2K   ← BillboardGui   │
│[🏪 Shop  ]        (Offline Cash: $6K)  Collect $6.2K       │
│                                                Locked: 17s │
│ $4.58K                                                    │
│ Friend Boost: +0%           [1] hotbar                     │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Menu | Left column of 3 square dark buttons, icon on top, small label below (`Index`, `Rebirth`, `Shop`). |
| Money | Bottom-left, big **neon green** `$4.58K` with dark outline, and a small gray `Friend Boost: +0%` under it. |
| World text | Name in white, rarity word in its color (Common green, Rare blue, Gold, Diamond cyan, Secret…), income `$15/s` in gold, price. |
| Timers | `Locked: 17s` in red over the base door — a world timer, not a HUD timer. |
| Font | Bold rounded display with outline (⚠️ unconfirmed, closest `FredokaOne`). |

## The 2025 "stud trend" (community kits)

Dozens of community UI kits copy the look that Steal a Brainrot and Grow a Garden made popular (seen on DevForum):
dark charcoal windows, a **purple or green header with a stud texture**, square product tiles, green Robux buy buttons,
a left column of **square colored buttons with stud texture** (`INDEX` green, `REBIRTH` red, `SHOP` purple),
and the green money counter bottom-left with "Friend Boost". This is the look the [stud style](../estilos/stud.md) of this repo covers.

## Signature components

1. **Billboard price tags** above every unit: name · rarity · income per second · price. Readable from far away with outline.
2. **Collect pads** with `Collect $6.2K` floating text and `(Offline Cash: $6K)` — the reward is shown where you walk.
3. **Three-button left rail** — Index, Rebirth, Shop. That's the whole menu.

## Steal this

- Move per-object info to `BillboardGui`s (`AlwaysOnTop`, `MaxDistance`, `Size` in Scale so it shrinks with distance).
- Keep the screen HUD to: money, 3 menu buttons, notifications.
- Show the social multiplier (`Friend Boost`) right under the money: it sells invites for free.

## Build it in rbxui

rbxui documents are `ScreenGui`s; build the BillboardGui contents as a Frame in the editor, then reparent it under a
`BillboardGui` in Studio. The left rail is the same component as the [stud shop + HUD](../ejemplos/stud-shop-hud.md) side menu.

## Sources

Gameplay screenshots via Hablamos de Gamers and Deltia's Gaming guides; the shop/redesign images seen on Twitter, Payhip,
ArtStation and DeviantArt were **fan redesigns** and are only used for the trend note above.
