# Safe area, top bar, notches and thumb zones

Sources: [On-screen UI containers › Screen insets](https://create.roblox.com/docs/ui/on-screen-containers#screen-insets) · [ScreenGui](https://create.roblox.com/docs/reference/engine/classes/ScreenGui) · [Position and size › Cross-platform factors](https://create.roblox.com/docs/ui/position-and-size#cross-platform-factors) · [GuiService.TopbarInset](https://create.roblox.com/docs/reference/engine/classes/GuiService#TopbarInset)

## ScreenGui.ScreenInsets

| Value | Keeps UI clear of | Use for |
|---|---|---|
| `CoreUISafeInsets` (**default**) | Roblox top bar buttons **and** device cutouts | Anything interactive (recommended) |
| `DeviceSafeInsets` | Device cutouts only (not the top bar) | Full-width HUD strips you align yourself |
| `TopbarSafeInsets` | Area between the top bar controls and the right edge; the ScreenGui flexes horizontally with the top bar | Custom top-bar buttons that sit next to Roblox's |
| `None` | Nothing | Non-interactive backgrounds/vignettes only |

`IgnoreGuiInset = true` switches `CoreUISafeInsets` to `DeviceSafeInsets` (legacy way to draw under the top bar).

Related:
- `ClipToDeviceSafeArea` (default `true`) clips descendants to the device safe area — set `false` for edge-to-edge backgrounds.
- `SafeAreaCompatibility` (default `FullscreenExtension`) auto-extends "fullscreen" UI on devices with cutouts.
- `GuiService.TopbarInset` (a `Rect`) is the free area next to Roblox's top-left controls; it changes at runtime (health bar, CoreGui toggles).

## Top bar height

The Roblox top bar is **58 px** tall in the current design (⚠️ not stated as a constant in the docs — read `GuiService.TopbarInset` / `GuiService:GetGuiInset()` at runtime instead of hard-coding). RbxUI's editor shows that 58 px band so you don't put things under it.

## Reserved and thumb zones (mobile)

- **Reserved**: Roblox's default mobile controls (thumbstick, jump) occupy the **bottom-left and bottom-right corners**. Don't put info or buttons there.
- **Thumb reach**: frequently used buttons go near the bottom-right but above the jump button; far top-center is hard to reach on phones and very hard on tablets ("40 % from the top is reachable on a phone but almost unreachable on a tablet").
- Menus that open rarely (settings, codes) can live top-left/top-right.

## Practical layout for a game HUD

```
┌ top bar (Roblox) ──────────────────────────────┐
│ currencies (top-left, under the bar)  [x2 boost]│
│ side menu (left middle: Shop, Pets, Rebirth)    │
│                                                 │
│                 gameplay space                  │
│                                                 │
│ [thumbstick]     level/XP bar      [action][jump]│
└─────────────────────────────────────────────────┘
```
