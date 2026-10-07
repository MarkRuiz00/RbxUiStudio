# AnchorPoint

`AnchorPoint` (a `Vector2`) is the **origin point** from which an object is positioned and sized, as a fraction of the object's own size.
Default `(0, 0)` = top-left. `(0.5, 0.5)` = center: position/size changes grow outward from the middle.

Source: [Position and size › AnchorPoint](https://create.roblox.com/docs/ui/position-and-size#anchorpoint)

The engine accepts any fraction 0–1, but **use only 0, 0.5 or 1** — other values make layouts hard to reason about and edit.

## Match the anchor to the edge you pin to

| Pinned to | AnchorPoint | Position example |
|---|---|---|
| Top-left | `[0, 0]` | `[0, 16, 0, 16]` |
| Top-center | `[0.5, 0]` | `[0.5, 0, 0, 16]` |
| Top-right | `[1, 0]` | `[1, -16, 0, 16]` |
| Center | `[0.5, 0.5]` | `[0.5, 0, 0.5, 0]` |
| Bottom-center | `[0.5, 1]` | `[0.5, 0, 1, -16]` |
| Bottom-right | `[1, 1]` | `[1, -16, 1, -16]` |

Why: with the anchor on the same edge, the element keeps its distance to that edge on every screen size, and resizing it doesn't push it off-screen.

## AnchorPoint and animation

Pop-in/scale animations look right only if the anchor is where the "growth" should come from:
a window that pops from its center needs `[0.5,0.5]`; a dropdown that unfolds downward needs `[x,0]`.

## AnchorPoint and AutomaticSize

`AutomaticSize` respects the anchor: a label with `AnchorPoint [1, 0.5]` grows to the **left** as its text gets longer
([Size modifiers › Automatic sizing](https://create.roblox.com/docs/ui/size-modifiers#automatic-sizing)).

## Pitfalls

- Changing AnchorPoint after positioning moves the object visually (Position stays the same, origin changes) — set it first.
- Children inside a `UIListLayout`/`UIGridLayout` are placed by the layout; their Position is ignored, AnchorPoint matters only for the layout container itself.
