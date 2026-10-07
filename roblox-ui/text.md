# Text

Sources: [TextLabel](https://create.roblox.com/docs/reference/engine/classes/TextLabel) · [Size modifiers › Text size](https://create.roblox.com/docs/ui/size-modifiers#text-size) · [UITextSizeConstraint](https://create.roblox.com/docs/reference/engine/classes/UITextSizeConstraint) · [Rich text](https://create.roblox.com/docs/ui/rich-text)

## Sizing text: AutomaticSize first, TextScaled second

Roblox's own guidance on `TextScaled`:

> "It's recommended that you avoid usage of TextScaled and adjust UI to take advantage of the AutomaticSize property instead."
> Also avoid applying **both** to the same label.

| Approach | When |
|---|---|
| Fixed `TextSize` + `AutomaticSize` on the label/box | Body text, buttons with variable labels, localized text |
| `TextScaled = true` + `UITextSizeConstraint` | Big decorative numbers/titles that must fill a fixed box (counters, "LEVEL 99") |

- `TextScaled` ignores `TextSize`, enables `TextWrapped`, and without constraints scales up to **100** px.
- `UITextSizeConstraint`: `MinTextSize` (default 1) and `MaxTextSize` (default 1000). **Never use a minimum below 9** — "the text will be difficult to read for many viewers".

```json
{ "ClassName": "TextLabel", "Name": "Coins",
  "props": { "Text": "12.5K", "TextScaled": true, "Size": [0.6, 0, 1, 0], "BackgroundTransparency": 1,
             "FontFace": { "family": "FredokaOne", "weight": "Regular", "style": "Normal" }, "TextColor3": "#FFFFFF" },
  "children": [
    { "ClassName": "UITextSizeConstraint", "Name": "TextLimits", "props": { "MinTextSize": 14, "MaxTextSize": 48 } },
    { "ClassName": "UIStroke", "Name": "Outline", "props": { "Thickness": 2.5, "Color": "#1B1B2F", "ApplyStrokeMode": "Contextual" } }
  ] }
```

## Fonts

Use Roblox's built-in font families: `Font.new("rbxasset://fonts/families/<Name>.json", weight, style)` (or the older `Enum.Font`).
In rbxui write `FontFace: { "family": "Montserrat", "weight": "Heavy", "style": "Normal" }` — `family` is the `<Name>` of the families file.

Game-UI favorites (all in the official family list):

| Use | Families |
|---|---|
| Chunky display / numbers | `FredokaOne`, `LuckiestGuy`, `Bangers`, `DenkOne` |
| Bold UI labels | `Montserrat` (weights Bold → Black), `BuilderSans` (Bold / ExtraBold) |
| Clean body / settings | `BuilderSans`, `Nunito`, `Roboto` |
| Themed | `Creepster` (horror), `PressStart` (pixel), `Michroma` (sci-fi), `Fondamento` (fantasy) |

Gotham (`Gotham`, `GothamBold`, `GothamBlack`) still exists in `Enum.Font`; Builder Sans is the newer Roblox family (⚠️ Roblox does not document which font its own UI uses).
⚠️ Weight availability differs per family — pick it in Studio's font picker to confirm.

## Readability on busy backgrounds

1. White text + dark `Contextual` `UIStroke` (2–4 px).
2. Or a solid/semi-opaque plate behind the text.
3. Contrast: aim for WCAG 4.5:1 for small text, 3:1 for large/bold display text (WCAG guideline, not a Roblox rule).

## RichText

`RichText = true` enables tags: `<b>`, `<i>`, `<u>`, `<s>`, `<font color="#FF0000" size="20" face="..." weight="heavy">`, `<stroke color="#000" thickness="2">`, `<br/>`.
Good for prices ("<font color=\"#7CF05A\">FREE</font>") and mixed weights in one label.

## Localization

Labels with `AutomaticSize` grow for longer languages; `TextScaled` ones shrink. Leave ~30 % spare width on buttons.
