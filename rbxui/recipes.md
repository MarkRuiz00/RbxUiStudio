# Recipes

Copy-ready rbxui nodes for the pieces every game needs. Sizes are in the 1280×720 design canvas (auto-scaled in-game, see [format.md](format.md)).
All snippets are validated by `node tools/validate-docs.mjs`.

## Window (dark body, colored header, close button)

```json
{ "ClassName": "Frame", "Name": "ShopWindow",
  "props": { "AnchorPoint": [0.5, 0.5], "Position": [0.5, 0, 0.53, 0], "Size": [0, 720, 0, 460], "BackgroundColor3": "#FFFFFF", "Visible": true },
  "children": [
    { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 12] } },
    { "ClassName": "UIGradient", "Name": "Body", "props": { "Color": [[0, "#2B2F3A"], [1, "#1E212A"]], "Rotation": 90 } },
    { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3, "Color": "#0B0C10" } },
    { "ClassName": "Frame", "Name": "Header",
      "props": { "Size": [1, 0, 0, 56], "BackgroundColor3": "#FFFFFF" },
      "children": [
        { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 12] } },
        { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#FFE76A"], [1, "#FFA51F"]], "Rotation": 90 } },
        { "ClassName": "TextLabel", "Name": "Title",
          "props": { "Position": [0, 20, 0, 0], "Size": [1, -90, 1, 0], "BackgroundTransparency": 1, "Text": "SHOP", "TextSize": 34,
                     "TextXAlignment": "Left", "TextColor3": "#FFFFFF", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
          "children": [ { "ClassName": "UIStroke", "Name": "Outline", "props": { "Thickness": 3, "Color": "#6B3A00" } } ] },
        { "ClassName": "TextButton", "Name": "Close",
          "props": { "AnchorPoint": [1, 0.5], "Position": [1, -10, 0.5, 0], "Size": [0, 44, 0, 44], "BackgroundColor3": "#FFFFFF", "Text": "X",
                     "TextSize": 26, "TextColor3": "#FFFFFF", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
          "interactions": [ { "trigger": "click", "action": "close" } ], "buttonFx": { "hover": 1.08, "press": 0.88 },
          "children": [
            { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } },
            { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#FF7A7A"], [1, "#E8263B"]], "Rotation": 90 } },
            { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3, "Color": "#5C0A12", "ApplyStrokeMode": "Border" } }
          ] }
      ] }
  ] }
```

Notes: the header covers the window's top corners (same radius). Use `"Visible": false` when a button opens it.

## Gradient button with outlined text

```json
{ "ClassName": "TextButton", "Name": "BuyButton",
  "props": { "Size": [0, 200, 0, 56], "BackgroundColor3": "#FFFFFF", "Text": "BUY", "TextSize": 30, "TextColor3": "#FFFFFF",
             "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" }, "AutoButtonColor": false },
  "buttonFx": { "hover": 1.06, "press": 0.9 },
  "children": [
    { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } },
    { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#9BFF5C"], [1, "#2DBA3C"]], "Rotation": 90 } },
    { "ClassName": "UIStroke", "Name": "Border", "props": { "Thickness": 3, "Color": "#0F4A16", "ApplyStrokeMode": "Border" } }
  ] }
```

A `UIStroke` on a TextButton applies to either the box (`Border`) or the text (`Contextual`). For both, put the text in a child `TextLabel` (see the window title above).

## Currency pill (icon overlapping the left edge)

```json
{ "ClassName": "Frame", "Name": "Coins",
  "props": { "Position": [0, 16, 0, 72], "Size": [0, 190, 0, 44], "BackgroundColor3": "#1E212A", "BackgroundTransparency": 0.15 },
  "children": [
    { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0.5, 0] } },
    { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 2, "Color": "#0B0C10" } },
    { "ClassName": "Frame", "Name": "Icon",
      "props": { "AnchorPoint": [0.5, 0.5], "Position": [0, 8, 0.5, 0], "Size": [0, 52, 0, 52], "BackgroundColor3": "#FFFFFF" },
      "children": [
        { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0.5, 0] } },
        { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#FFE76A"], [1, "#FFA51F"]], "Rotation": 90 } },
        { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3, "Color": "#6B3A00" } }
      ] },
    { "ClassName": "TextLabel", "Name": "Amount",
      "props": { "Position": [0, 44, 0, 0], "Size": [1, -56, 1, 0], "BackgroundTransparency": 1, "Text": "12.5K", "TextSize": 28,
                 "TextXAlignment": "Left", "TextColor3": "#FFFFFF", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
      "children": [ { "ClassName": "UIStroke", "Name": "Outline", "props": { "Thickness": 2.5, "Color": "#0B0C10" } } ] }
  ] }
```

Replace the `Icon` frame with an `ImageLabel` (`ScaleType: "Fit"`) when you have a coin image.

## Tabs (equal width with flex)

```json
{ "ClassName": "Frame", "Name": "Tabs", "props": { "Size": [1, -32, 0, 44], "Position": [0, 16, 0, 68], "BackgroundTransparency": 1 },
  "children": [
    { "ClassName": "UIListLayout", "Name": "List", "props": { "FillDirection": "Horizontal", "SortOrder": "LayoutOrder", "Padding": [0, 8], "HorizontalFlex": "Fill" } },
    { "ClassName": "TextButton", "Name": "Pets", "props": { "LayoutOrder": 1, "Size": [0, 100, 1, 0], "BackgroundColor3": "#3A7BFF", "Text": "Pets", "TextSize": 22, "TextColor3": "#FFFFFF" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 8] } } ] },
    { "ClassName": "TextButton", "Name": "Items", "props": { "LayoutOrder": 2, "Size": [0, 100, 1, 0], "BackgroundColor3": "#2B2F3A", "Text": "Items", "TextSize": 22, "TextColor3": "#C9CDD6" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 8] } } ] },
    { "ClassName": "TextButton", "Name": "Gamepasses", "props": { "LayoutOrder": 3, "Size": [0, 100, 1, 0], "BackgroundColor3": "#2B2F3A", "Text": "Passes", "TextSize": 22, "TextColor3": "#C9CDD6" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 8] } } ] }
  ] }
```

## Scrolling grid of slots

```json
{ "ClassName": "ScrollingFrame", "Name": "Grid",
  "props": { "Position": [0, 16, 0, 124], "Size": [1, -32, 1, -140], "BackgroundTransparency": 1, "ScrollBarThickness": 6,
             "ScrollingDirection": "Y", "AutomaticCanvasSize": "Y", "CanvasSize": [0, 0, 0, 0] },
  "children": [
    { "ClassName": "UIGridLayout", "Name": "Layout", "props": { "CellSize": [0, 96, 0, 96], "CellPadding": [0, 10, 0, 10], "SortOrder": "LayoutOrder" } },
    { "ClassName": "UIPadding", "Name": "Pad", "props": { "PaddingTop": [0, 4], "PaddingLeft": [0, 4], "PaddingRight": [0, 4] } },
    { "ClassName": "ImageButton", "Name": "Slot1", "props": { "LayoutOrder": 1, "BackgroundColor3": "#2B2F3A", "Image": "" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } },
                    { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 2, "Color": "#3E4452" } } ] },
    { "ClassName": "ImageButton", "Name": "Slot2", "props": { "LayoutOrder": 2, "BackgroundColor3": "#2B2F3A", "Image": "" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } },
                    { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 2, "Color": "#3E4452" } } ] }
  ] }
```

In-game, a script clones `Slot1` per item; ship one or two template slots, not 50.

## Progress / XP bar

```json
{ "ClassName": "Frame", "Name": "XPBar",
  "props": { "AnchorPoint": [0.5, 1], "Position": [0.5, 0, 1, -24], "Size": [0, 520, 0, 34], "BackgroundColor3": "#1E212A" },
  "children": [
    { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0.5, 0] } },
    { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3, "Color": "#0B0C10" } },
    { "ClassName": "Frame", "Name": "Fill", "props": { "Size": [0.62, 0, 1, 0], "BackgroundColor3": "#FFFFFF" },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0.5, 0] } },
                    { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#7FDBFF"], [1, "#1F7CFF"]], "Rotation": 90 } } ] },
    { "ClassName": "TextLabel", "Name": "Label", "props": { "Size": [1, 0, 1, 0], "BackgroundTransparency": 1, "Text": "LEVEL 12  ·  620 / 1000", "TextSize": 20,
                 "TextColor3": "#FFFFFF", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
      "children": [ { "ClassName": "UIStroke", "Name": "Outline", "props": { "Thickness": 2, "Color": "#0B0C10" } } ] }
  ] }
```

Animate `Fill.Size` X scale with TweenService (0.4 s Quad Out).

## 3D stud block

The modern stud button/panel ([estilos/stud.md](../estilos/stud.md#modern-stud-3d-blocks)): lip + outer stroke on the base, gradient face with an inner rim and studs.

```json
{ "ClassName": "Frame", "Name": "BaseButton", "props": { "Size": [0, 150, 0, 58], "BackgroundColor3": "#1F7A16" },
  "buttonFx": { "hover": 1.05, "press": 0.92 },
  "children": [
    { "ClassName": "UIStroke", "Name": "Outline", "props": { "Thickness": 4, "Color": "#000000", "BorderStrokePosition": "Outer", "LineJoinMode": "Miter" } },
    { "ClassName": "Frame", "Name": "Face", "props": { "Size": [1, 0, 1, -6], "BackgroundColor3": "#FFFFFF", "ClipsDescendants": true },
      "children": [
        { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#8BF25C"], [1, "#3FBF2A"]], "Rotation": 90 } },
        { "ClassName": "UIStroke", "Name": "Rim", "props": { "Thickness": 3, "Color": "#B8FF8F", "BorderStrokePosition": "Inner", "LineJoinMode": "Miter" } },
        { "ClassName": "ImageLabel", "Name": "Studs", "props": { "Image": "assets/ui-resources/Textures/Stud/0090_Stud_texture.png", "ScaleType": "Tile",
          "TileSize": [0, 48, 0, 48], "ImageTransparency": 0.78, "BackgroundTransparency": 1, "Size": [1, 0, 1, 0] } }
      ] }
  ] }
```

## 3D text (hard drop shadow)

Roblox text has no drop shadow: stack a black copy a few pixels lower behind the real label.

```json
{ "ClassName": "Frame", "Name": "Title", "props": { "Size": [0, 300, 0, 50], "BackgroundTransparency": 1 },
  "children": [
    { "ClassName": "TextLabel", "Name": "Shadow", "props": { "Size": [1, 0, 1, 0], "Position": [0, 0, 0, 4], "BackgroundTransparency": 1, "Text": "SHOP", "TextSize": 40,
      "TextColor3": "#000000", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
      "children": [ { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3.5, "Color": "#000000" } } ] },
    { "ClassName": "TextLabel", "Name": "Text", "props": { "Size": [1, 0, 1, 0], "BackgroundTransparency": 1, "Text": "SHOP", "TextSize": 40,
      "TextColor3": "#FFFFFF", "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" } },
      "children": [ { "ClassName": "UIStroke", "Name": "Stroke", "props": { "Thickness": 3.5, "Color": "#000000" } } ] }
  ] }
```

## Stud texture overlay

```json
{ "ClassName": "ImageLabel", "Name": "Studs",
  "props": { "Image": "assets/ui-resources/Textures/Stud/0090_Stud_texture.png", "ScaleType": "Tile", "TileSize": [0, 32, 0, 32],
             "ImageTransparency": 0.8, "BackgroundTransparency": 1, "Size": [1, 0, 1, 0] } }
```

Place it as a child of the colored frame (after the gradient, before the text). Fetch the file: `node tools/ui-resources.mjs fetch 90`.

## Sunburst behind a reward

```json
{ "ClassName": "ImageLabel", "Name": "Sunburst",
  "props": { "AnchorPoint": [0.5, 0.5], "Position": [0.5, 0, 0.5, 0], "Size": [0, 300, 0, 300], "BackgroundTransparency": 1,
             "Image": "assets/ui-resources/Effects/Sunbursts/0033_Sunburst.png", "ImageColor3": "#FFE76A", "ImageTransparency": 0.25, "ZIndex": 0 },
  "children": [ { "ClassName": "UIAspectRatioConstraint", "Name": "Square", "props": { "AspectRatio": 1 } } ] }
```

Rotate it in-game: `TweenService:Create(sun, TweenInfo.new(10, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1), {Rotation = 360})`.
