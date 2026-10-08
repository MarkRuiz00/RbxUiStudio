# Arena HUD

![](renders/arena-hud.png) · JSON: [arena-hud.rbxui.json](arena-hud.rbxui.json) · Style: [minimal](../estilos/minimal.md) + energetic accents ·
Patterns from: [RIVALS](../juegos/rivals.md), [Blade Ball](../juegos/blade-ball.md)

**Purpose:** a competitive HUD that follows FPS conventions so players never search: HP bottom-left, ammo bottom-right,
score + timer top-center, killfeed top-right, tasks top-left.

## What to notice

| Element | How it's built | Why |
|---|---|---|
| Score | blue plate · dark timer pill · red plate in a centered horizontal list | the round state in one glance |
| Kill banner | red heavy italic text with dark outline, under the score | short feedback, top-center |
| Killfeed | dark translucent rows, `RichText` names in team colors | readable on any background |
| Tasks | title + rows (icon, text, 6 px bar, ✓ or reward) | goals without opening a menu |
| Side menu | buttons rotated −4° with colored labels (`EMOTE` red, `QUESTS` yellow) | Blade Ball's "everything leans" energy without real skew |
| Actions | `BLOCK [F]`, `ABILITY [Q]`: label above, square button, dark key badge on the corner | shows the keybind on PC; on touch the same buttons are the tap targets (86 px) |
| Health | shield bar + thick HP pill with the number inside | the most important number is the biggest bar |
| Weapon | huge ammo count, reserve, weapon name, 3 slots with key numbers, selected = white stroke | FPS standard |
| Leave | red pill with a `M` key box | secondary action, still discoverable |

## Notes

- Roblox has no skew. Rotation (−3° to −5°) gets most of the feel; for real parallelograms use a 9-sliced parallelogram image.
- Montserrat Black **Italic** is used for numbers; check the weight/style exists in Studio's font picker (⚠️ availability differs per family).
