# BedWars

**Genre:** PvP · **Style family:** desktop-app slate ·
**Why:** the best example of a **catalog** UI on Roblox: filters, search, sort, details pane.

## Screen map — Kit Shop

```
┌ Kit Shop                    Next free rotation: 04:19:06:04 ┐┌──────────────┐
│ ☑ Kit Owned  ☐ Battlepass  [Any Class ▾] [Default Sort ▾]   ││   (render)   │
│ [🔍 Search Kit          ]   Free Kit Slots Unlocked: 4 / 4    ││ Miner        │
│ [FREE THIS WEEK!][        ][LIMITED ][        ]             ││ description… │
│ [ portrait    ][ portrait ][portrait][portrait]             ││ Skins: ▢ ▢   │
│ [ Name        ][ Name     ][ Name   ][ Name   ]             ││ [ EQUIPPED ] │
└─────────────────────────────────────────────────────────────┘└──────────────┘
```

## Visual language

| | Observed |
|---|---|
| Panels | Lavender slate (`#6367A7`) body, darker header (`#2F3045`), cards one step darker (`#4E5081`). Radius ~4 px. |
| Cards | Portrait render, name bar at the bottom with a class icon, a small diamond/rank badge top-right. |
| Tags | Purple ribbon `FREE THIS WEEK!` (`#7352BD`), `LIMITED` on top of cards. |
| Details | Right pane: big render, name, paragraph, skins row, `USE KIT SKIN` checkbox, green `EQUIPPED` (`#2AAD62`). |
| Controls | Checkboxes, dropdowns, search — real form controls. |
| Lobby | Left grid of square dark buttons with icon over label (`BATTLEPASS`, `MISSIONS`, `LOCKER`, `CLAN`, `FRIENDS`, `WARPS`). |
| Font | Medium geometric sans, no outlines. |

## Steal this

- Once a list passes ~20 items, add search + one filter + one sort.
- A details pane avoids popups-on-popups.

## Sources

Gameplay screenshots via a DevForum post and a marketplace listing (kit shop, lobby).
