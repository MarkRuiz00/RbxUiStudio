# Examples

Complete UIs in rbxui format. Every file passes `node tools/validate.mjs examples` (official Roblox API check + import + render in RbxUI Studio).
Open one in the editor: Ctrl+V its JSON, or `rbxui_put_scene` it through the MCP. Textures come from ui-resources.com:
run `node tools/ui-resources.mjs fetch --examples` once so the editor can show them.

| Example | Style | Shows | Render |
|---|---|---|---|
| [Simulator HUD](simulator-hud.md) | simulator | currency pills, 2×2 side menu with badge, boost button with sunburst, XP bar | ![](renders/simulator-hud.png) |
| [Shop](shop.md) | simulator | window + header + tabs, scrolling grid of product cards, Robux prices, open/close interactions | ![](renders/shop.png) |
| [Inventory](inventory.md) | stud | square/black-stroke look, search TextBox, rarity-colored slots, details panel | ![](renders/inventory.png) |
| [Settings](settings.md) | minimal | toggles, slider, segmented control, rows with dividers | ![](renders/settings.png) |
| [Loading screen](loading-screen.md) | minimal | full-screen overlay, gradient title, progress bar, `IgnoreGuiInset` | ![](renders/loading-screen.png) |
| [Daily reward](daily-reward.md) | cartoony | 7-day grid, claimed/today/locked states, ribbon title | ![](renders/daily-reward.png) |
| [Rebirth popup](rebirth-popup.md) | simulator | confirmation popup, before → after stats, flex buttons | ![](renders/rebirth-popup.png) |
| [Codes](codes.md) | simulator | TextBox input, redeem button, status message | ![](renders/codes.png) |
| [Stud shop + HUD](stud-shop-hud.md) | stud (3D blocks) | 3D stud blocks (face + lip + outer stroke), 3D text, teleport buttons, hero offer + dev products — from a Figma tutorial | ![](renders/stud-shop-hud.png) |

**Icons:** the emoji glyphs (🛒 🐾 🪙…) are placeholders so the examples work without third-party art. Replace them with
`ImageLabel`s of your own icon set (editor → Iconos → Online, or the packs in [../estilos/resources.md](../estilos/resources.md)).
Roblox renders emoji with its own font, so they look different in-game.
