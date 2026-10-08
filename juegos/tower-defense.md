# Anime Vanguards · Tower Defense Simulator

**Genre:** tower defense (gacha) · **Style family:** neon dark (Anime Vanguards) / slate functional (TDS) ·
**Why:** the genre with the most "menus per minute": summon banners, unit hotbars, waves, rewards.

The lesson: **the summon screen is a stage** — banner art, odds, pity bars and two big buttons — and **the unit hotbar shows price and level on each slot**.

## Screen map — in a match

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬  Wave: 20     [+ Base Health 100/100 ▬▬▬]   Time Left: ∞  ⚙│
│                                                          │
│ quests ⚠                                                    │
│                                                          │
│   [1 $850][2 $300][3 $1,400][4 $4,500][5 $725][6 $200]  $74,897 │
└──────────────────────────────────────────────────────────┘
```

## Screen map — summon (Anime Vanguards)

```
            Exclusive pity ▬▬▬ 0/400   Legendary pity ▬ 0/50
┌ Select a Banner ┐ ╱ SUMMON ╲════════════════════(X)  ┌ 25% Luck ┐┌ 37.5% ┐
│ [Special      ] │ │ ⏱ 00:00:31  Special Banner     │  │  🧪 99   ││ 🧪 199 │
│ [Standard     ] │ │  The King   Fastest   Lilia    │  │ 500 Gems ││2500 Gems│
│ [Winter       ] │ │  Mythic     Mythic    Mythic   │  │   249    ││  799   │
│ [Selection    ] │ │ [Index][Summon x1][Summon x10][Info]│  └──────────┘└────────┘
└─────────────────┘ └──────────────────────────────────┘
       412 ◆   43,225 ●   [Lvl 1 550¥][Lvl 1 850¥][🔒 Lvl 10][🔒 Lvl 30]
```

## Visual language (Anime Vanguards)

| | Observed |
|---|---|
| Panels | Very dark, slightly purple (`#2B1C26`), glowing colored borders. |
| Headers | **Slanted parallelogram** title plate in purple (`#9242EF`) with italic caps (`SUMMON`). |
| Buttons | Bright flat colors with italic bold text: `Summon x1/x10` green (`#06E421`), `Index` magenta (`#BF02D2`), `Info` cyan (`#03ACD8`). |
| Banner list | Cards with art and a colored frame per banner (green Special, red Standard, cyan Winter, yellow Selection). |
| Rarity | `Mythic` in pink/purple gradient text, `Exclusive` in red. |
| Pity | Thin labeled bars `Mythic Pity 3/400`. |
| Menu | Left grid of small square icon buttons with labels (`Units`, `Store`, `Items`, `Play`, `Areas`, `Summon`) + red `NEW!` tags. |
| Events | `★ 2x Player Experience!` italic purple lines bottom-left. |

## Visual language (TDS)

| | Observed |
|---|---|
| Match HUD | `Wave: 20` (number in red), green Base Health bar top-center with `+`, `Time Left` right. |
| Hotbar | 6 tower slots with keybind number and **green price under each** (`$850`). |
| Lobby | Left column of wide rectangular buttons with icon + label (`STORE` red, `ITEMS`, `SKILLS`), a big green `PLAY SURVIVAL`. |
| Offers | `Starter Bundle!` with timer and `47% OFF` tag top-center; battle-pass countdown banner. |
| Results | Red ribbon `🏆 TRIUMPH! 🏆` over a dark reward panel with tiles (`200`, `50 XP`). |
| Placement | World prompts with key boxes: `[🖱] Place`, `[R] Rotate`, `[Q] Cancel`. |

## Steal this

- Put odds/pity **on** the summon screen (players trust visible numbers).
- Price + level + lock on every hotbar slot.
- Show controls as key boxes next to the action while placing.

## Build it in rbxui

See the [summon banner](../ejemplos/summon-banner.md) example: slanted header, banner list, featured units, odds cards and pity bars.

## Sources

Gameplay screenshots via TheGamer, Try Hard Guides, Sportskeeda, Theria Games, Screen Rant and Pro Game Guides.
