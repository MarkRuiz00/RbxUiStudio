# Responsive UI: phone, tablet, PC, console

Sources: [Cross-platform development](https://create.roblox.com/docs/projects/cross-platform) · [Adaptive design](https://create.roblox.com/docs/production/publishing/adaptive-design) · [Test on hardware](https://create.roblox.com/docs/performance-optimization/test-on-hardware) · [Style editor](https://create.roblox.com/docs/ui/styling/editor)

Players join from phones, tablets, PCs and consoles — often switching input mid-session. Design **phone first**: it's the smallest screen and the most players.

## Size and position

- Position and size containers with **Scale**; the docs warn Scale alone can be "huge" on 4K TVs → cap with `UISizeConstraint` or adapt by screen size.
- Lock shapes with `UIAspectRatioConstraint`.
- Use layouts so content reflows instead of overlapping.

## Detect the screen class, not pixels

`GuiService.ViewportDisplaySize` → `Enum.DisplaySize`:

| Value | Typical device |
|---|---|
| `Small` | Most phones/tablets/handhelds |
| `Medium` | Laptops and monitors |
| `Large` | TVs |

Adapt with a `UIScale` (e.g. 1.15 on Small for bigger touch targets, 0.9 on Large) or swap layouts.
The UI **Style Editor** supports Style Queries on `ViewportDisplaySize` and `UserInputService.PreferredInput` to swap tokens (text sizes, paddings) automatically.

## Detect the input

`UserInputService.PreferredInput` → `KeyboardAndMouse`, `Touch`, `Gamepad`, `MicroGamepad`.
Show input-specific hints (keyboard `1–5`, gamepad button icons) and make every button **selectable with a gamepad** (`Selectable = true`, sensible `NextSelection*` when the automatic order is wrong).

## Touch targets

Roblox's docs ask that interactive elements be "large enough to tap reliably" and cite the WCAG touch-target guideline of **at least 9 × 9 mm**.
In practice that's **≥ 44 × 44 px** on a phone-sized viewport (Apple HIG value; ⚠️ not a Roblox constant). Keep ≥ 8 px between adjacent targets.

## Test

- Studio **Device Emulator** (phones/tablets/console) and **Controller Emulator**.
- Real phones: text that is crisp at 1440p can be unreadable on a cheap phone — test legibility at arm's length.
- RbxUI Studio: open the **device view** (top bar) — it re-lays the scene at phone/tablet/PC/TV sizes, marks the thumb zones and flags text under 9 px and tap targets under 44 px.

### The phone math of a scaled design

If the whole UI is scaled with one `UIScale = min(W / 1280, H / 720)` (what RbxUI's runtime does with `autoScale`), a landscape phone
of 844×390 points gets **×0.54**. Every size in the design shrinks by that factor, so on a 1280×720 canvas:

| You want on the phone | Design it at |
|---|---|
| text ≥ 9 px (Roblox's readability floor) | **≥ 17 px** |
| tap target ≥ 44 px (⚠️ Apple HIG value) | **≥ 82 px** |
| 8 px between targets | ≥ 15 px |

Small phones (667×375) scale ×0.52 — the same numbers still hold within a pixel.
