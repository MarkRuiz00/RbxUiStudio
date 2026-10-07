# Images in rbxui

`Image` (also `HoverImage`, `PressedImage`) accepts:

| Value | Meaning |
|---|---|
| `rbxassetid://123456` | An image already on Roblox — used as is |
| `assets/…/file.png` | A **local** file relative to `tool/`. Previewed by the editor; uploaded to Roblox by the Studio plugin when you install (ids remembered in `assets/rbx_assets.json`) |
| `""` | No image (useful for an ImageButton that's only a colored box) |

## Where local images come from

- **ui-resources.com** (textures, sunbursts, sparkles, backgrounds): `node tools/ui-resources.mjs fetch <id>` → `tool/assets/ui-resources/<Category>/<Tag>/<id>_<Title>.<ext>`.
  Index with credits: [../estilos/resources.md](../estilos/resources.md). Example paths:
  - studs: `assets/ui-resources/Textures/Stud/0090_Stud_texture.png`
  - sunburst: `assets/ui-resources/Effects/Sunbursts/0033_Sunburst.png`
- **User logos**: `rbxui_list_logos` → `assets/logos/<folder>/<file>`.
- **Online icons** (Iconify) and **SVG** pasted in the editor → rasterized to `assets/figma/<hash>.png`.
- **Figma** imports → `assets/figma/…` (see [figma-import.md](figma-import.md)).

## Texture recipe (tinted, tiled, reusable)

```json
{ "ClassName": "Frame", "Name": "Panel", "props": { "BackgroundColor3": "#FFFFFF", "Size": [0, 360, 0, 220], "ClipsDescendants": true },
  "children": [
    { "ClassName": "UICorner",   "Name": "Corner",   "props": { "CornerRadius": [0, 10] } },
    { "ClassName": "UIGradient", "Name": "Gradient", "props": { "Color": [[0, "#7FDBFF"], [1, "#1F7CFF"]], "Rotation": 90 } },
    { "ClassName": "ImageLabel", "Name": "Studs",
      "props": { "Image": "assets/ui-resources/Textures/Stud/0090_Stud_texture.png", "ScaleType": "Tile", "TileSize": [0, 32, 0, 32],
                 "ImageTransparency": 0.8, "BackgroundTransparency": 1, "Size": [1, 0, 1, 0] },
      "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } } ] }
  ] }
```

The same texture file serves every panel color — change only the gradient. (`UICorner` on the image clips it to the rounded shape.)

## Rules

- ≤ 1024 px per side; PNG for transparency; convert `.webp` to PNG if you upload by hand ([../roblox-ui/images.md](../roblox-ui/images.md)).
- White/grayscale art + `ImageColor3`/`UIGradient` tint instead of one upload per color.
- Credit ui-resources authors; check their terms before publishing a game with their art.
- Text goes in `TextLabel`s, not baked into images (moderation + localization).
