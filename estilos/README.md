# Styles of top Roblox games

Four families cover most popular games. Pick **one** per game and keep it everywhere (palette, radius, stroke, font, motion).
These are **design conventions observed in popular experiences**, not engine rules — engine facts live in [../roblox-ui/](../roblox-ui/README.md).

| Style | Looks like | Typical games | Guide |
|---|---|---|---|
| Simulator | Saturated gradients, thick dark outlines, chunky numbers, sunbursts, studs | Pet/clicker/tycoon simulators | [simulator.md](simulator.md) |
| Cartoony | Soft rounded shapes, pastel-bright colors, bouncy motion, playful fonts | Adopt/roleplay, obbies, casual | [cartoony.md](cartoony.md) |
| Stud | Square corners, black strokes, stud textures, "classic Roblox" toy look | Retro/brick, building games | [stud.md](stud.md) |
| Minimal | Flat dark/light panels, thin strokes, clean sans font, few colors | Shooters, horror, competitive, story | [minimal.md](minimal.md) |

Shared building blocks (textures, sunbursts, sparkles, backgrounds): [resources.md](resources.md) — curated from [ui-resources.com](https://ui-resources.com).

## Universal rules (all styles)

- **One accent for the main action** (buy/play/claim). Everything else is calmer. Green = buy/confirm, red = close/danger, gold = premium/Robux is the genre convention.
- **Hierarchy by size, not by color count**: title > primary button > content > secondary buttons > fine print.
- **Same distances everywhere**: an 8 px spacing scale (4, 8, 12, 16, 24, 32).
- **One radius family** and **one stroke width family** (e.g. radius 8/12, stroke 2/3).
- **Text never sits on a busy texture without an outline or plate** ([../roblox-ui/text.md](../roblox-ui/text.md)).
- **Max 2 font families**: one display, one body.

## Menu hierarchy (applies to every style)

1. **HUD** (always visible, small): currencies top-left, side menu left-middle, progress bottom-center, boosts top-right.
2. **Windows** (one at a time, centered, ~60–70 % of the short screen side): Shop, Inventory, Pets, Rebirth, Settings.
3. **Popups** (above windows): confirmations, rewards, "not enough coins".
4. **Overlays** (above all): loading, transitions, cutscenes.

Each layer is its own `ScreenGui` with increasing `DisplayOrder` ([../roblox-ui/zindex.md](../roblox-ui/zindex.md)).
