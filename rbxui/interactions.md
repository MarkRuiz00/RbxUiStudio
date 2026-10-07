# Interactions and button effects (no code)

The bundled LocalScript `RbxUINative` (installed with the scene) reads these fields and does the work in-game. The editor's **Play** (▶) mode previews them.

## interactions

On a button (`TextButton` / `ImageButton`; a `Frame` with interactions is turned into a button by the Figma importer):

```json
"interactions": [ { "trigger": "click", "action": "toggle", "target": "ShopWindow", "animation": "pop" } ]
```

| Key | Values |
|---|---|
| `trigger` | `click` |
| `action` | `open`, `close`, `toggle` |
| `target` | `Name` of the window. Searched in the same ScreenGui first, then in every ScreenGui of the player. For `close`, omit it to close the window that contains the button |
| `animation` | `pop` (scale 0.78 → 1, Back easing, ~0.2 s) or `none` |

Behavior: opening a window closes any other open window (one window at a time) and adds a light background blur; closing shrinks it out.
Windows that start hidden must have `"Visible": false`.

## buttonFx

```json
"buttonFx": { "hover": 1.06, "press": 0.9 }
```

Scale on mouse hover and on press (through the object's `UIScale`, combined with auto-scale and window animation).
Use it on every clickable thing — it's the cheapest "juice" there is.

## Full example: side button opens a shop, X closes it

```json
{ "ClassName": "ImageButton", "Name": "ShopButton",
  "props": { "AnchorPoint": [0, 0.5], "Position": [0, 16, 0.5, 0], "Size": [0, 76, 0, 76], "BackgroundColor3": "#FFFFFF", "Image": "" },
  "interactions": [ { "trigger": "click", "action": "toggle", "target": "ShopWindow", "animation": "pop" } ],
  "buttonFx": { "hover": 1.06, "press": 0.9 },
  "children": [ { "ClassName": "UICorner", "Name": "Corner", "props": { "CornerRadius": [0, 10] } } ] }
```

and inside `ShopWindow` (with `"Visible": false`):

```json
{ "ClassName": "TextButton", "Name": "Close", "props": { "Text": "X", "Size": [0, 44, 0, 44] },
  "interactions": [ { "trigger": "click", "action": "close" } ], "buttonFx": { "hover": 1.08, "press": 0.88 } }
```

## Beyond this

Purchases, inventories, data, cooldowns → your own LocalScripts/Scripts that **reference** the Instances by name
(`PlayerGui:WaitForChild("ShopScreen").ShopWindow…`). Keep the UI structure in StarterGui; don't rebuild it with `Instance.new`.
Roblox patterns: [TweenService](../roblox-ui/animation.md), MarketplaceService for Robux purchases, RemoteEvents for server actions.
