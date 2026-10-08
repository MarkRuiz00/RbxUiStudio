# RIVALS

**Genre:** competitive FPS · **Style family:** esports clean ·
**Why:** ~222K concurrent in June 2026 (#5).

The lesson: **FPS conventions transfer directly** — HP bottom-left, ammo bottom-right, timer and score top-center, killfeed top-right.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬 ⚙          [3:53]                sweatbara 🔫 atharvb311 │
│           #1  #2  #3  #4 … (avatars + kills)                 │
│Beginner Tasks [3/3]                                        │
│▶ Play a duel     0/1 🔑x3                                   │
│                          ⌖                                │
│                                     20 100⫼  🔫 🔫 💣        │
│(▬▬▬▬▬▬▬ 150)      [Leave M]        Assault Rifle  2  3  4    │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| HP | Thick rounded pill bottom-left, bright green (`#68FA39`) with dark outline and the number inside. |
| Ammo | Huge white `20` + small `100` reserve + bullet icon, weapon name under it in bold italic, weapon slot icons with key numbers. |
| Timer | Dark gray rounded pill (`#3C3B40`) top-center. |
| Scoreboard | Row of square player avatars with rank `#1` above and kills below. |
| Killfeed | Dark translucent rows top-right: `name 🔫 name`. |
| Tasks | Left: icon + task + thin progress bar + `0/1` + reward icon `x3`, with green checks when done. |
| Lobby menu | Bottom-center row of 3D icons with labels (`Backpack`, `Career`, `Weapons`, `Tasks`, `Shop`, `Rewards`, `Settings`) and red badges; red toast `Your new daily shop is ready!`. |
| Mode select | Full-screen blur, big `MATCHMAKING` title, gradient cards (`1v1`, `2v2`, `3v3`) — the hovered card scales up with a white border; tags `🔥 MOST POPULAR`, `LIMITED 2x`; green `PLAY`. |
| Leave | Red pill `Leave` with a key box `M`. |
| Font | Heavy geometric sans with italic numbers (Gotham/Montserrat look). |

## Steal this

- Selected card = scale 1.05 + white stroke, others dimmed.
- Key box next to secondary actions (`Leave [M]`).
- A task list with rewards in the corner of the lobby.

## Build it in rbxui

The [arena HUD](../ejemplos/arena-hud.md) example combines these with Blade Ball's skewed buttons.

## Sources

Gameplay screenshots via Sportskeeda, DazePuzzle, RecMG and Pro Game Guides.
