# Pet Simulator 99

**Genre:** collection simulator · **Style family:** [simulator](../estilos/simulator.md) (clean white variant) ·
**Why:** the reference simulator UI that most pet/clicker games imitate.

The lesson: **clean white windows, zero boxes behind HUD numbers, and icons that break out of their frames.**

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬                                                     │
│🎁03:52  🔧             ┌🗂 Inventory! [🔒🐱▦][Search ][X]┐ Rebirth 2 │
│💊 🔄                    │▌  Your Team 20/20              │ Rank 6 - Pro │
│🐱 👆                    │▌  🐶 🐱 🐲 🦄 …  (no tiles)      │ Earn 500 ◆ │
│◇ 7.59k                 │▌  42.2k 38.9k ???              │ 101/500    │
│◆ 73,748                └────────────────────────────────┘ [🎁 Rewards]│
│🍎x10 🍊x18            ⑤[🗂][🧺][🏅][⇄][🛡][⚙]                  │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Windows | White body (`#FFFFFF`) with a very faint gray paw-print pattern, rounded ~12 px, thin dark outline. |
| Title | Big white display text with dark outline, ending in **"!"** (`Inventory!`, `Trading!`), sitting on the top edge; a big icon overlaps the top-left corner. |
| Header controls | Segmented pill (lock · pets · grid), white **Search** pill with gray placeholder, red rounded close (`#EA1F64`, pinkish red). |
| Category rail | Vertical gray rail on the left inside the window with category icons and red count badges. |
| Grid | **No tile backgrounds** — pets float on white; value/count bottom-right in outlined text (`42.2k`, `x7`), gold star = favorite, green dot = equipped. |
| HUD | Icon + outlined number, no panels (`7.59k`, `73,748`). Timers under gift icons (`03:52`). Boosts bottom-left as icons with `x10` stacks. |
| Main menu | Bottom-center row of 3D icons **without buttons behind them**; red circle badge with count (`#F71053`). |
| Quests | Right side, right-aligned text lines with progress `101/500` and a reward icon, plus a green `Rewards` button (`#7DF514`). |
| Font | Rounded heavy display (looks like `FredokaOne`, ⚠️ unconfirmed). |
| Count color | Team count in cyan-blue (`#4DB6D7`). |

## Signature components

1. **Breaking icon title**: the window icon is larger than the header and overlaps the frame — instant identity per window.
2. **Tooltip card**: white rounded card with name, rarity in color (`Epic`), description, and a "Tap to activate" hint.
3. **Locked enchant slots**: lock icon + `Rank 11` requirement inside each slot, one gold `Buy` slot.
4. **Quest list on the HUD**: always-visible goals with numbers — the game tells you what to do next.

## Steal this

- White windows over a colorful world feel premium and calm.
- No tiles in dense grids: icons + outlined numbers read better and look less busy.
- Every menu icon can carry a red badge.

## Avoid

- White windows need **strong outlines on text and icons**; pastel icons on white disappear.

## Build it in rbxui

The [pet inventory](../ejemplos/pet-inventory.md) example rebuilds these patterns with original art:
breaking icon, segmented filter, search pill, category rail, tile-less grid, bottom menu with badges.

## Sources

Gameplay screenshots via Pro Game Guides and Try Hard Guides (inventory, trading, enchants, tools).
