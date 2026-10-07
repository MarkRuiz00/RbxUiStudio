# Keeping shapes: UIAspectRatioConstraint, UISizeConstraint, AutomaticSize, UIScale

Constraints and modifiers go as **children** of the `GuiObject` they affect.
Source: [Size modifiers and constraints](https://create.roblox.com/docs/ui/size-modifiers) · [UIAspectRatioConstraint](https://create.roblox.com/docs/reference/engine/classes/UIAspectRatioConstraint)

## UIAspectRatioConstraint

Enforces a **width ÷ height** ratio regardless of the object's Size (even Scale sizes).

| Property | Meaning |
|---|---|
| `AspectRatio` | width/height, must be > 0. Default `1` (square). For height/width use the inverse. |
| `AspectType` | `FitWithinMaxSize` — as large as possible inside its own size · `ScaleWithParentSize` — max size is the parent's size |
| `DominantAxis` | Which axis drives the new size when it would exceed the parent (`Width` / `Height`) |

```json
{ "ClassName": "ImageButton", "Name": "ShopButton",
  "props": { "Size": [0.09, 0, 0.16, 0], "Image": "rbxassetid://..." },
  "children": [ { "ClassName": "UIAspectRatioConstraint", "Name": "Aspect", "props": { "AspectRatio": 1 } } ] }
```

Use it on: square buttons, icon slots, cards, avatar thumbnails, any image with a fixed shape.
**Note:** under a layout (`UIListLayout`) the constraint **overrides** the layout's sizing (official docs).

## UISizeConstraint

`MinSize` / `MaxSize` (pixels, `Vector2`). Keeps a Scale-sized window from getting tiny on phones or enormous on 4K.

```json
{ "ClassName": "UISizeConstraint", "Name": "Limits", "props": { "MinSize": [280, 200], "MaxSize": [720, 520] } }
```

Also overrides layout sizing when both apply.

## AutomaticSize

`None` (default) · `X` · `Y` · `XY`. Resizes the object to fit its descendants (e.g. localized text). The object's `Size` becomes the **minimum** size.
`ScrollingFrame` uses `AutomaticCanvasSize` instead (grows the canvas, not the frame).

```json
{ "ClassName": "TextLabel", "Name": "Toast",
  "props": { "Size": [0, 0, 0, 40], "AutomaticSize": "X", "TextSize": 22, "Text": "Saved!" },
  "children": [ { "ClassName": "UIPadding", "Name": "Pad", "props": { "PaddingLeft": [0, 16], "PaddingRight": [0, 16] } } ] }
```

## UIScale

Multiplies the parent's `AbsoluteSize` (and everything inside, including `UIStroke` and `UICorner`). Great for pop animations
(`Scale` 0.8 → 1) and for shrinking a whole menu on small screens. RbxUI's runtime animates windows through a `UIScale`.
