# Images: limits, tinting, tiling, reuse

Sources: [Texture specifications](https://create.roblox.com/docs/art/modeling/texture-specifications) · [ImageLabel](https://create.roblox.com/docs/reference/engine/classes/ImageLabel) · [Asset Manager](https://create.roblox.com/docs/projects/assets/manager) · [Developer products](https://create.roblox.com/docs/production/monetization/developer-products)

## Limits

- **1024 × 1024 px** is the maximum texture resolution Roblox supports (texture specifications page). Images uploaded larger are reduced —
  ⚠️ the downscale behavior for *UI* images is widely reported but not spelled out on the UI pages. Design UI art at ≤ 1024 px on its longest side.
- Formats: the Asset Manager imports `.png`, `.jpg`, `.gif`, `.tga`, `.bmp` (bulk import supported). Use **PNG** for anything with transparency.
- Developer product icons: max 512 × 512, keep important details inside the circle.
- Every image is moderated; text-heavy or logo-like images may be rejected. Keep text as `TextLabel`s, not baked into images.

## ScaleType

| Value | Behavior |
|---|---|
| `Stretch` (default) | Fills the box, may distort |
| `Fit` | Keeps aspect, letterboxed |
| `Crop` | Keeps aspect, fills and crops |
| `Tile` | Repeats the image; tile size = `TileSize` (`UDim2`, default `[1,0,1,0]`), starting top-left |
| `Slice` | 9-slice, see [9-slice.md](9-slice.md) |

## Tint instead of re-uploading

`ImageColor3` **multiplies** the image color. Upload icons/textures **white or grayscale**, then tint per use:

- one white icon → 5 colored buttons;
- one white/black-with-alpha stud texture → every panel color.

`UIGradient` on an `ImageLabel` multiplies too (gradient-tinted icons, rainbow textures).
`ImageTransparency` controls opacity (texture "strength", e.g. `0.85` for a subtle stud overlay).

```json
{ "ClassName": "ImageLabel", "Name": "Studs",
  "props": { "Image": "rbxassetid://<stud texture>", "ScaleType": "Tile", "TileSize": [0, 32, 0, 32],
             "ImageColor3": "#FFFFFF", "ImageTransparency": 0.8, "BackgroundTransparency": 1, "Size": [1, 0, 1, 0], "ZIndex": 2 } }
```

## No blend modes

Roblox UI has **no Overlay/Multiply/Screen** blending. Effects designed in Figma with blend modes must be converted:
- a texture with light and dark detail → a white-alpha "highlights" image + a black-alpha "shadows" image, each tinted;
- RbxUI Studio does this automatically when importing from Figma ([../rbxui/figma-import.md](../rbxui/figma-import.md)).

## Outlines on images

`UIStroke` outlines a `GuiObject`'s box (or text glyphs), **not the opaque pixels of an image**. For outlined icons, bake the outline into the PNG
(Photopea/Photoshop "Stroke", or Figma after vectorizing) — keep it white so it can still be tinted.

## Spritesheets

`ImageRectOffset` / `ImageRectSize` show a region of one image — fewer uploads for icon sets and frame animations.

## Where to get art

Curated textures, sunbursts, stud patterns, sparkles, backgrounds: [../estilos/resources.md](../estilos/resources.md) (from ui-resources.com, credit the authors).
