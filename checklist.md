# Final checklist

Run through this before calling a screen done. Render it (`rbxui_render`) at the design size **and** at a phone size (e.g. `design` 844×390).

## Works on every device
- [ ] Top-level elements are pinned with **Scale + matching AnchorPoint** (no off-screen drift on 4:3, 16:9, 19.5:9). → [udim2](roblox-ui/udim2.md), [anchorpoint](roblox-ui/anchorpoint.md)
- [ ] No **container** sized in pure Offset unless the scene uses rbxui `autoScale` (default) — otherwise tiny on TV / huge on phone.
- [ ] Squares stay square: `UIAspectRatioConstraint` on buttons, slots, icons. → [aspect-ratio](roblox-ui/aspect-ratio.md)
- [ ] Big windows have a `UISizeConstraint` (or fit within ~70 % of the short side).
- [ ] Nothing important in the **top 58 px** (Roblox top bar) or the **bottom-left/right corners** (mobile thumbstick & jump). → [safe-area](roblox-ui/safe-area.md)
- [ ] `ScreenInsets` left at `CoreUISafeInsets` for interactive UI; `None` only for full-bleed backgrounds.
- [ ] Every button is reachable/selectable with a gamepad (`Selectable`, sensible order) if you ship on console. → [responsive](roblox-ui/responsive.md)

## Touch & readability
- [ ] Touch targets **≥ 44 × 44 px** at phone size, ≥ 8 px apart (WCAG ~9 mm guideline; 44 px is the Apple HIG value — ⚠️ not a Roblox constant).
- [ ] No text below **9 px** (`UITextSizeConstraint.MinTextSize ≥ 9` when `TextScaled`). → [text](roblox-ui/text.md)
- [ ] Text over textures/gradients has an outline (`UIStroke` Contextual) or a plate.
- [ ] Contrast ≈ **4.5:1** for small text, **3:1** for large bold text (WCAG).
- [ ] Labels have ~30 % spare width for translations (or use `AutomaticSize`).

## Visual consistency
- [ ] One style family; one corner radius family; one stroke width family. → [estilos](estilos/README.md)
- [ ] One accent for the primary action per screen; green = buy/confirm, red = close/danger.
- [ ] Gradients have `BackgroundColor3 = #FFFFFF` (they multiply). → [modifiers](roblox-ui/modifiers.md)
- [ ] Spacing on an 8 px scale; lists/grids use `Padding` + `UIPadding`, not hand placement. → [layouts](roblox-ui/layouts.md)
- [ ] Textures are shared images tinted with `ImageColor3`/`UIGradient`, not one upload per color. → [images](roblox-ui/images.md)

## Structure & behavior
- [ ] Unique `Name`s among siblings; meaningful names (scripts find things by name).
- [ ] Windows opened by buttons start `Visible: false`; every window has a close path (button + interaction).
- [ ] Every clickable has `buttonFx` (hover/press feedback).
- [ ] Layering is right: `ZIndexBehavior: Sibling`, popups in a ScreenGui with higher `DisplayOrder`. → [zindex](roblox-ui/zindex.md)
- [ ] Images ≤ 1024 px, PNG for transparency, no text baked into images.
- [ ] Third-party art is credited and its terms checked (see [estilos/resources.md](estilos/resources.md)).

## Tooling
- [ ] `node tools/validate.mjs file <your.rbxui.json>` passes (API names, enums, value shapes, targets).
- [ ] `rbxui_put_scene` returned no warnings; the render matches the intent.
- [ ] Things the preview can't show (9-slice, `IgnoreGuiInset`, `SafeAreaCompatibility`) were checked in Studio.
