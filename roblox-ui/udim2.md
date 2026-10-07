# UDim2 — Scale vs Offset

`Position` and `Size` of every `GuiObject` are a `UDim2`: one `UDim` (Scale, Offset) per axis.

- **Scale** — a *percentage* of the parent container's size on that axis (`0.5` = 50 %).
- **Offset** — a number of *pixels*, added to the Scale part.
- Final value = `Scale × parentSize + Offset`.

Source: [Position and size UI objects](https://create.roblox.com/docs/ui/position-and-size)

```jsonc
"Size":     [0.4, 0, 0.6, 0]     // 40 % of parent width, 60 % of parent height
"Position": [0.5, 0, 1, -24]     // horizontal center, 24 px above the bottom
```

## When to use which

| Use **Scale** for | Use **Offset** for |
|---|---|
| Where a panel sits on the screen | Stroke width, padding, gaps |
| How big a window is relative to the screen | Small fixed details (badge dot, divider line) |
| Children that fill their parent (`[1,0,1,0]`) | Insets: `[1,-16,1,-16]` = full size minus 8 px each side |

**Rule of thumb:** screens differ (a 5" phone vs a 4K TV), so anything that defines the *layout* is Scale; anything that defines *craft* is Offset.

## Common patterns

| Want | Size | Position | AnchorPoint |
|---|---|---|---|
| Fill parent | `[1,0,1,0]` | `[0,0,0,0]` | `[0,0]` |
| Fill parent with 12 px margin | `[1,-24,1,-24]` | `[0.5,0,0.5,0]` | `[0.5,0.5]` |
| Centered window, 60 % wide | `[0.6,0,0.7,0]` + aspect constraint | `[0.5,0,0.5,0]` | `[0.5,0.5]` |
| Bottom bar | `[1,0,0.12,0]` | `[0,0,1,0]` | `[0,1]` |
| Top-right button | `[0.08,0,0.08,0]` + `UIAspectRatioConstraint` 1 | `[1,-12,0,12]` | `[1,0]` |

## Pitfalls

- **Pure Offset UI** looks fine in Studio and tiny on a 4K TV / huge on a phone. Avoid fixed pixel sizes for containers.
- **Pure Scale squares aren't squares**: `[0.1,0,0.1,0]` is 10 % of width × 10 % of height → a rectangle on a 16:9 screen. Add a `UIAspectRatioConstraint` ([aspect-ratio.md](aspect-ratio.md)).
- Scale on a child of a layout (`UIListLayout`) is relative to the **parent**, not to the remaining space — use `UIFlexItem` for "fill the rest" ([layouts.md](layouts.md)).
- The official cross-platform guide warns that Scale alone can render "huge" on 4K TVs; combine with `UISizeConstraint` or screen-size adaptation ([responsive.md](responsive.md)).
