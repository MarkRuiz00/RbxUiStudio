# Blade Ball

**Genre:** arena / reflex · **Style family:** skewed energetic ·
**Why:** shows how one geometric idea (skew) gives a whole UI its personality.

The lesson: **everything leans.** Buttons, panels and banners are parallelograms; every window owns a color.

## Screen map

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬                                   [🪙 34 ➕]           │
│/EMOTE/          - YOU ELIMINATED NAME! -          BLOCK    │
│/AFK  /                                            [🛡 F]    │
│/QUESTS/                                           ABILITY  │
│/SKILLS SKINS/                                     [⏩ Q]    │
│                         ‹ Spectate ›                  (⬆)  │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Observed |
|---|---|
| Shape | Parallelograms leaning right, with a darker bottom edge. |
| Left menu | Skewed buttons, blue (`#6280DF`) fill, each label in its own color (`EMOTE` red, `QUESTS` yellow); a bigger `SKILLS / SKINS` card with a purple flame icon. |
| Currency | Skewed blue plate (`#3D6DDB`) with coin + number and a green `+`. |
| Actions | Right side: square blue tiles with white icon (shield, dash), label above (`BLOCK`, `ABILITY`) and a key badge (`F`, `Q`). |
| Kill banner | Top-center red italic (`#E20F13`) `- YOU ELIMINATED NAME! -`. |
| Font | Bold condensed italic caps. |

## Window system (seen in a public Blade Ball-style kit)

Dark windows, each with a **skewed colored header strip and a matching bottom line**: Shop red, Rewards green, Stats blue,
Settings white, Quests orange, Update Log purple. Rewards: timed reward tiles (`5 Mins`, `10 Mins`…) on a progress track with dots.
⚠️ That kit is a community recreation — treat it as a pattern reference.

## Steal this

- Pick one geometric trait (skew, round, square) and apply it to *every* element.
- One color per window, used in its header and in the button that opens it.

## Build it in rbxui

Skew isn't a GuiObject property. Fake it with an `ImageLabel` of a parallelogram (9-slice the straight edges) or a
`UIGradient` transparency cut on a Frame rotated slightly; text stays unrotated on top. See the [arena HUD](../ejemplos/arena-hud.md).

## Sources

Gameplay screenshots via Theria Games; the window kit images were hosted on Framer (community UI kit).
