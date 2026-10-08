# 99 Nights in the Forest

**Genre:** survival co-op · **Style family:** dark minimal with a handwritten accent ·
**Why:** ~285K concurrent in June 2026 (#4).

The lesson: **a crafting screen organized by tier**, with locked tiers visible but dimmed and one huge CRAFT button.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬                 Day 27                     🗺        │
│                                                  ☾ 0:10   │
│                 level 4 progress: 34/100           (N E S W)│
│▬▬ 🍖 hunger         [▬▬▬▬▬▬░░░░]                            │
│                                                          │
│      [Giant Sack][Chainsaw][Revolver][Rifle][MedKit]…        │
└──────────────────────────────────────────────────────────┘
```

## Crafting window

```
┌ 🔩 2   🪵 0   💎 0 ──────────────────────────────── (X) ┐
│ [Map 3][Farm Plot 10][Bench 2 ★]   │      🛠 (art)       │
│ NEEDS CRAFTING BENCH 2 🛠            │  Crafting Bench 4   │
│ [Sun Dial][Compass][Old Bed]… dim  │ unlocks TIER 4 …    │
│ NEEDS CRAFTING BENCH 3 🛠            │   🔩 20  🪵 30  💎 2  │
│ [ ? ][ ? ][ ? ][ ? ]                │   [    CRAFT    ]   │
└─────────────────────────────────────┴────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Panel | Near-black translucent (`#131414`), rounded ~8 px, red square close (`#8D0102`). |
| Tiles | Dark rounded squares (`#061308`–`#2D2517`) with icon, name and costs (icon + number). Locked = 50 % transparent; unknown = big `?`. |
| Selected | Yellow fill (`#99750B`) + yellow outline. |
| Tier headers | Italic yellow caps `NEEDS CRAFTING BENCH 3` (`#E4D64E`) with a small bench icon. |
| Costs | Number turns **red** when you can't afford it. |
| CRAFT | Wide lime-green button (`#7DE538`), italic white text with dark outline. |
| HUD | Top-center `Day 27` in a handwritten italic font; moon + countdown top-right with compass; thin hunger bar with icon. |
| World events | Center italic text: `it has started to rain and thunder`. |

## Steal this

- Group recipes by the requirement that unlocks them, and show the next tier as `?` tiles.
- Red costs = "can't afford", no extra message needed.

## Build it in rbxui

The [crafting bench](../ejemplos/crafting-bench.md) example: resource counters, tiered sections, locked/unknown tiles, details pane with CRAFT.

## Sources

Gameplay screenshots via Insider Gaming, BO3, Game Rant and 99nights-intheforest.net (HUD, crafting bench, campfire).
