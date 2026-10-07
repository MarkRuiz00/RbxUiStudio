# Layouts: UIListLayout, UIGridLayout, UIPadding, UIFlexItem

A layout object placed inside a container **controls the Position (and often the Size) of its siblings**; editing those properties by hand stops working.
Sources: [List and flex layouts](https://create.roblox.com/docs/ui/list-flex-layouts) · [Grid and table layouts](https://create.roblox.com/docs/ui/grid-table-layouts)

## UIListLayout

| Property | Use |
|---|---|
| `FillDirection` | `Vertical` (menus, lists) or `Horizontal` (tab bars, currency rows) |
| `SortOrder` | `LayoutOrder` (recommended, explicit) or `Name` |
| `Padding` | `UDim` gap **between** items, e.g. `[0, 8]`. Not around the edges → use `UIPadding` |
| `HorizontalAlignment` / `VerticalAlignment` | Align items and the whole list inside the container |
| `Wraps` | Wrap to a new line when items overflow (inventory "flow" rows) |
| `HorizontalFlex` / `VerticalFlex` | Distribute extra space: `Fill`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly` |
| `ItemLineAlignment` | Cross-axis alignment inside a line (`Stretch` makes uneven tiles fill the line) |

Reverse order: negate `LayoutOrder` values (`0, -1, -2…`).
Flex adds a small performance cost — only enable it when you need it (official note).

```json
{ "ClassName": "Frame", "Name": "Tabs", "props": { "Size": [1, 0, 0, 44], "BackgroundTransparency": 1 },
  "children": [
    { "ClassName": "UIListLayout", "Name": "List", "props": { "FillDirection": "Horizontal", "SortOrder": "LayoutOrder", "Padding": [0, 6], "HorizontalFlex": "Fill" } },
    { "ClassName": "TextButton", "Name": "Pets",  "props": { "LayoutOrder": 1, "Size": [0, 80, 1, 0], "Text": "Pets" } },
    { "ClassName": "TextButton", "Name": "Items", "props": { "LayoutOrder": 2, "Size": [0, 80, 1, 0], "Text": "Items" } }
  ] }
```

### UIFlexItem (one item fills the rest)

Child of a list item: `FlexMode` = `Fill` | `Grow` | `Shrink` | `Custom`. Classic use: search bar that takes all the width left by fixed buttons.

## UIGridLayout

Uniform cells — inventories, shop grids, badge walls.

| Property | Use |
|---|---|
| `CellSize` | `UDim2` size of every cell. Scale is relative to the container: `[0.23, 0, 0.3, 0]` ≈ 4 columns |
| `CellPadding` | `UDim2` gap between cells, e.g. `[0, 8, 0, 8]` |
| `FillDirection` + `FillDirectionMaxCells` | Fill rows/columns and cap items per row (0 = no cap) |
| `StartCorner`, `SortOrder` | Where filling starts / ordering |

Respects constraints: put a `UIAspectRatioConstraint` **inside the grid layout** to keep cells square at any screen size (allowed by the docs: "UIGridLayout respects any constraints").

For scrolling inventories put the grid inside a `ScrollingFrame` with `AutomaticCanvasSize = "Y"`.

## UIPadding

`PaddingTop/Bottom/Left/Right` (`UDim`). Space **inside** the container edges. Pair it with every list/grid so content never touches borders.

```json
{ "ClassName": "UIPadding", "Name": "Pad", "props": { "PaddingTop": [0, 12], "PaddingBottom": [0, 12], "PaddingLeft": [0, 12], "PaddingRight": [0, 12] } }
```

## Pitfalls

- Constraints on items (`UIAspectRatioConstraint`, `UISizeConstraint`) **override** the layout's sizing — that's intended, but surprising.
- A list item sized with Scale is relative to the container, so 5 items of `0.25` overflow — use `HorizontalFlex: Fill` or `UIFlexItem`.
- Text-only items with `AutomaticSize` inside a list are fine; `TextScaled` items need a fixed size to scale into.
