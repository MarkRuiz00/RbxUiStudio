# Figma: import and export

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

## Exporting to Figma

The editor goes the other way too (native rbxui screens): **Copiar para Figma** (Ctrl+Shift+C) puts the screen on the clipboard
→ Ctrl+V in Figma; **Descargar .fig para Figma** downloads a `.fig` to drop on Figma's file browser. Images travel inside
the clipboard/file and texts arrive already laid out (glyphs included), so nothing needs re-editing in Figma.

| rbxui | Figma |
|---|---|
| Frame / TextLabel / ImageLabel… | FRAME (fill, UIGradient, UICorner, UIStroke, clipping, CanvasGroup) |
| Text | TEXT (closest Figma font style, rich-text runs as style overrides, measured as Roblox lays it out) |
| UIListLayout + UIPadding | Auto layout (direction, gap, padding, alignment, wrap, hug) |
| Image | Image fill (tint and 9-slice baked to PNG) |

Code: `tool/studio/tofigma.js` (scene → node description, in the browser) → `figexport.mjs` (kiwi message → clipboard / `.fig`).

## Fig (Figma-model editor)

To design outside Figma and bring it back identical, use **Fig** at <http://localhost:5170/fig/>: its document *is* Figma's,
so copy → edit → paste back is lossless, and it runs Figma plugins. No Roblox involved. Guide (Spanish): [../tool/docs/FIG.es.md](../tool/docs/FIG.es.md).
