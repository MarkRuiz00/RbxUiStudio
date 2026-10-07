# 9-slice images

One image is split into 9 parts so a panel/button can be **any size without stretching its corners or border**.
Source: [UI 9-slice design](https://create.roblox.com/docs/ui/9-slice) · [ImageLabel.SliceCenter](https://create.roblox.com/docs/reference/engine/classes/ImageLabel#SliceCenter)

| Part | Scaling |
|---|---|
| 1, 3, 7, 9 (corners) | none |
| 2, 8 (top/bottom edges) | horizontal |
| 4, 6 (left/right edges) | vertical |
| 5 (center) | horizontal + vertical |

## Properties (ImageLabel / ImageButton)

- `ScaleType: "Slice"` — enables 9-slice.
- `SliceCenter` — a `Rect` in **source-image pixels**: `[minX, minY, maxX, maxY]` of the stretchable center.
  For a 64×64 rounded-box image with 16 px corners: `[16, 16, 48, 48]`.
- `SliceScale` — multiplies the edge size as if the texture were upscaled. Default `1.0`. Use `0.5` to get thinner borders from a high-res source.

```json
{ "ClassName": "ImageLabel", "Name": "Panel",
  "props": { "Image": "rbxassetid://...", "ScaleType": "Slice", "SliceCenter": [16, 16, 48, 48], "SliceScale": 1,
             "BackgroundTransparency": 1, "Size": [0.5, 0, 0.6, 0] } }
```

In Studio, the **9-Slice Editor** (click `…` on SliceCenter) lets you drag the 4 red lines; note its offsets are *distances from each edge*, not the Rect values.

## When to use it

- Ornate frames, scrolls, wooden/metal panels, speech bubbles — art that `UICorner` + `UIStroke` can't draw.
- Buttons whose label length varies (localization).

## In RbxUI Studio

The JSON accepts `ScaleType: "Slice"` and `SliceCenter`, and they build correctly in Roblox, but **the editor preview does not render 9-slice yet** (⚠️ check it in Studio). For flat/cartoony styles prefer `UICorner` + `UIStroke` + `UIGradient`, which preview exactly.
