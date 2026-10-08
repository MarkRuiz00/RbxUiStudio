# Blox Fruits

**Genre:** action RPG · **Style family:** flat functional (MMO) ·
**Why:** ~218K concurrent in June 2026 and one of the most visited games ever.

The lesson: **zero decoration, maximum information** — colored stat names and full-width bars can be enough for an RPG.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬                                         leaderboard │
│🔊⚙☠✋🏠▦                Race: Rabbit          Mastery 180   │
│ (compass)              ┌ STATS            [1]┐ BUDDHA       │
│[Stats][Items]          │ Melee     Lv. 19 [+]│ Transform [Z]│
│[Close][Shop ]          │ Defense   Lv. 81 [+]│ Impact    [X]│
│$82,759                 │ …                   │ …        [C]│
│Lv. 122 ▬▬▬▬ xp         │ Available Points: 6 [Refund]│      │
│[Health 500/500      ]  └─────────────────────┘             │
│[Energy 190/190      ]       [1][2][3][4] hotbar             │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Buttons | Flat yellow rectangles (`#FBD435`) with dark text, a 2×2 grid (`Stats`, `Items`, `Close`, `Shop`). No radius, no gradient. |
| Bars | Full-width rectangles with centered text: Health green (`#31F003`), Energy cyan (`#05C6FA`), thin XP bar purple (`#AF3CC8`). |
| Money / level | `$82,759` in green (`#7BF150`) and `Lv. 122` in white, plain text. |
| Stats window | Black translucent rows (`#2A2C27`), stat name in its own color — Melee `#EC8287`, Defense `#618AEC`, Sword `#97F76C`, Gun yellow, Blox Fruit `#C485ED` — level right-aligned, yellow `+` square. |
| Skills | Right column: skill name, mastery required, keybind `[Z]`. |
| Font | Bold clean sans (Gotham/Source Sans look). |

## Steal this

- A color per stat, used everywhere that stat appears.
- Keybinds printed next to skills.
- Bars with the number written inside.

## Avoid

- Flat yellow buttons with dark text look dated next to modern simulators; fine for an RPG that wants to feel "tool-like".

## Sources

Gameplay screenshots via KeenGamer, TheGamer and now.gg (stats menu, HUD, mastery).
