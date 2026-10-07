# Importing from Figma

Copy frames in Figma (Ctrl+C) and paste in the editor (Ctrl+V), or drop a `.fig` file. Images are downloaded; everything becomes rbxui.
Full coverage table: [../tool/docs/figma-cobertura.md](../tool/docs/figma-cobertura.md) (Spanish).

## What becomes what

| Figma | Roblox (rbxui) |
|---|---|
| Frame / rectangle / ellipse | `Frame` + `UICorner` (+ `UIStroke`, `UIGradient`) |
| Linear gradient | `UIGradient` (editable stops) |
| Image fill Fill / Fit / Stretch / Tile | `ImageLabel` `Crop` / `Fit` / `Stretch` / `Tile` + `TileSize` |
| Image fill with a blend mode (Overlay, Soft light, Multiply, Screen…) | 1–2 `ImageLabel`s with a **shared colorless mask** (`_hi`/`_lo`/`_inv`/`_lum`) tinted by `ImageColor3` or a `UIGradient` that follows the fill underneath |
| Stroke with blend mode | `UIStroke` with the exact resulting color (a `UIGradient` over gradient fills); the Figma color/blend is kept in `attributes.FigmaStroke` |
| Shape masks | `Frame` with `ClipsDescendants` (`CanvasGroup` + `UICorner` for rounded/elliptic) |
| Alpha/luminance/gradient masks, inner shadow, blur, noise, glass | baked to a PNG (Roblox can't draw them) |
| Auto-layout | `UIListLayout` (+ flex, wrap), `UIPadding`, `UIFlexItem`, `AutomaticSize`; equal-cell grids → `UIGridLayout` |
| Min/max size, aspect ratio | `UISizeConstraint`, `UIAspectRatioConstraint` |
| Constraints (left/right/center/scale) | `AnchorPoint` + Scale positions |
| Text | `TextLabel` with the closest Roblox font family, RichText for mixed styles, `UIStroke` for text strokes |
| Prototype (click → navigate/overlay/close) | `interactions` + `buttonFx` |

Every fill layer keeps its Figma recipe in `attributes.FigmaSpec`; the editor shows them as a Figma-like **fill stack** (click a fill → floating panel to change image, mode, scale, blend, opacity, exposure/contrast/saturation).

## Layer-name tags

Add to a Figma layer name: `[ignore]`, `[hidden]` (Visible false), `[button]`, `[textbox]`/`[input]`, `[scroll]`/`[scrollx]`/`[scrollxy]`,
`[flatten]`/`[image]`/`[png]` (whole layer as one image), `[native]` (never bake), `[absolute]`/`[nolayout]` (no auto-layout).

## Tips for Figma files that import well

- Use auto-layout for lists, tabs and grids.
- Keep text as text (don't outline it).
- Put textures as image fills with a blend mode on the shape (not as separate flattened layers).
- Name layers meaningfully — names become Instance `Name`s.
