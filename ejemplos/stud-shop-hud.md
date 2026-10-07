# Stud shop + HUD (3D stud blocks)

![](renders/stud-shop-hud.png) · JSON: [stud-shop-hud.rbxui.json](stud-shop-hud.rbxui.json) · Style: [stud](../estilos/stud.md#modern-stud-3d-blocks)

Recreated from the Figma tutorial **"How to make Stud UI"** by **Hammoudi** (UI Genesis, Kek's channel) — the techniques are theirs;
this file shows how each Figma trick becomes real Roblox Instances.

**Purpose:** a complete "brainrot/tycoon"-style screen: teleport buttons on top, side menu on the left, cash bottom-left, and a shop with a hero offer plus three dev products.

## Figma technique → Roblox

| Figma (tutorial) | Roblox (this file) |
|---|---|
| 3D look: duplicate the shape, darker solid copy moved 4–6 px down | `Base` Frame in the darker *lip* color, the gradient `Face` on top is 6 px shorter (`Size [1,0,1,-6]`) |
| One outline around face + lip (duplicate → flatten → outside stroke only) | `UIStroke` **Outer** 4 px black on the `Base`: it already surrounds the whole silhouette |
| Brighter inner stroke 3–4 px | `UIStroke` **Inner** 3 px on the `Face`, a light tint of the face color |
| Top→bottom gradient | `UIGradient` Rotation 90 on the `Face` (`BackgroundColor3` white) |
| Tiled stud texture set to Overlay | `ImageLabel` `ScaleType: Tile` + `ImageTransparency 0.78` (Roblox has no Overlay; the texture is white/black alpha so it reads the same) |
| Text: stroke 4–5 + drop shadow (y 4, blur 0, opacity 100 %) | Two `TextLabel`s: a black copy 3 px lower + the colored one, both with a `UIStroke` |
| Sunburst inside the button, clipped by the mask group | Sunburst `ImageLabel` inside the `Face` (`ClipsDescendants: true`) |
| Main frame: black, semi-transparent, 5 px outside stroke | `ShopFrame` black at 0.45 transparency + Outer `UIStroke` 5 px |
| Equal padding everywhere (30 px at 1080p) | 20 px on the 1280×720 canvas between every block and the window edge |
| Exit button = header duplicated in red, square | `ExitButton` same block, red, `interactions: close` |
| Group & name every layer (Header, ExitButton, HeroFrame, DevProducts…) | Same names — they become Instance `Name`s scripts can find |

## Layout decisions (from the tutorial)
- **Teleport buttons** (Sell / Base / Shop) top-center, like Grow a Garden; colors = destination identity.
- **Left side buttons** 2×2 + a wide **Slow mode** toggle above them, grouped and centered vertically.
- **Cash** in green with a 3D outline and a small **+** button to buy more.
- **Hero offer** spans the full width (orange) with a big gem + sunburst; **dev products** below in a row of three equal blue cards.

## Not possible in Roblox (and what to do)
- Outlining a bitmap icon (the tutorial vectorizes it in Figma): Roblox can't stroke images either → use icons that already include their outline (export them with a stroke from Photopea/Photoshop/Figma).
- Layer blur on the background: no runtime blur of an image layer → pre-blur the image, or use a `BlurEffect` in `Lighting` for the 3D world behind the UI.
