# Bee Swarm Simulator

**Genre:** collection simulator · **Style family:** classic functional (pre-2020 look, still played) ·
**Why:** shows that a long-lived game can stay simple if the two core numbers are always visible.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│☰ 💬   [Honey| 14,647,331 ][Pollen| 811/933,750 ]   account │
│x98 x17 🟢🟡 … buff icons with stacks                         │
│🥚 ? 🏅 ☺ ⚙ $        [ Tap | Make Honey ]                    │
│┌ item list ┐                                              │
││Royal Jelly│                                              │
│└───────────┘                                              │
│            [▢][▢][▢][▢][▢][▢][▢] x2558                     │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Meters | Label block (white, `Honey`) + dark translucent value bar with the number; the pollen bar fills as your bag fills. |
| Buffs | A long row of round icons with stack counts (`x31`) under the meters. |
| Menu | Row of white line icons (egg, ?, badges, quests, settings, shop) top-left. |
| Prompt | Big two-part prompt top-center: `Tap` (white) + `Make Honey` (blue box). |
| Hotbar | Custom rounded-square slots with gray border and counts. |
| Lists | Light gray cards with icon left, title + paragraph right; old-school, readable. |
| Font | Clean sans (Gotham/Source Sans look). |

## Steal this

- **Two labeled meters** for the core loop (collect → convert) at the top.
- A context prompt that names the action (`Make Honey`) instead of a generic "E".

## Avoid

- 30+ buff icons in a row: hard to parse on phones. Group them or show the top 5 + "more".

## Sources

Gameplay screenshots via Reddit posts and wallpaper sites (hive, items, buffs).
