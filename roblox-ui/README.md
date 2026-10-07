# Roblox UI fundamentals

Engine facts every UI designer (human or AI) needs. Each file links the official page it was checked against.
Values in `code` use the **rbxui JSON notation** (see [../rbxui/format.md](../rbxui/format.md)): `UDim2 = [xScale, xOffset, yScale, yOffset]`, `Vector2 = [x, y]`, `Color3 = "#RRGGBB"`.

| File | Topic |
|---|---|
| [udim2.md](udim2.md) | Position/Size: Scale vs Offset, when to use each |
| [anchorpoint.md](anchorpoint.md) | AnchorPoint (0 / 0.5 / 1) and pinning to edges |
| [aspect-ratio.md](aspect-ratio.md) | UIAspectRatioConstraint, UISizeConstraint, AutomaticSize, UIScale |
| [layouts.md](layouts.md) | UIListLayout (incl. flex), UIGridLayout, UIPadding, UIFlexItem |
| [modifiers.md](modifiers.md) | UICorner, UIStroke, UIGradient |
| [9-slice.md](9-slice.md) | ScaleType Slice, SliceCenter, SliceScale |
| [images.md](images.md) | Image size limits, formats, tinting, tiling, reusing textures |
| [safe-area.md](safe-area.md) | ScreenInsets, top bar, notches, reserved/thumb zones |
| [zindex.md](zindex.md) | ZIndex, ZIndexBehavior, DisplayOrder |
| [text.md](text.md) | Fonts, AutomaticSize vs TextScaled, UITextSizeConstraint, RichText |
| [responsive.md](responsive.md) | Phone / tablet / PC / console, input types |
| [animation.md](animation.md) | TweenService patterns for UI |

Primary source: <https://create.roblox.com/docs/ui> (text mirrored at <https://github.com/Roblox/creator-docs>).
