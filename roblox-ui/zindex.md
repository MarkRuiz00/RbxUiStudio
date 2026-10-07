# Layering: ZIndex, ZIndexBehavior, DisplayOrder

Sources: [Position and size › ZIndex](https://create.roblox.com/docs/ui/position-and-size#zindex) · [LayerCollector.ZIndexBehavior](https://create.roblox.com/docs/reference/engine/classes/LayerCollector#ZIndexBehavior) · [On-screen containers › Display order](https://create.roblox.com/docs/ui/on-screen-containers#display-order)

## Inside one ScreenGui

`ZIndexBehavior` (on the ScreenGui):

- **`Sibling` (default)** — children **always render above their parent**; `ZIndex` only orders siblings of the same parent. Predictable, use this.
- `Global` — all descendants sorted by `ZIndex`, ties broken by hierarchy; a child needs a ZIndex at least as high as its parent to show above it.

With `Sibling`, structure = layering: background frame → texture image → content → shine on top, each a later/higher sibling.
Use `ZIndex` (any positive or negative integer) when siblings must overlap in a specific order (e.g. a "NEW" badge above an icon).

## Between ScreenGuis

`ScreenGui.DisplayOrder`: higher draws on top. Typical stack:

| DisplayOrder | ScreenGui |
|---|---|
| 0 | HUD |
| 5 | Shop / Inventory windows |
| 10 | Popups (daily reward, purchase confirm) |
| 100 | Loading screen / transitions |

## Pitfalls

- A `ScreenGui` inside a `Folder` in StarterGui resets on spawn even with `ResetOnSpawn = false` (only *direct* children honor it).
- Hidden windows should be `Visible = false` (or `Enabled = false` for a whole ScreenGui), not moved off-screen — off-screen UI still costs input/layout and may be clipped by `ClipToDeviceSafeArea`.
