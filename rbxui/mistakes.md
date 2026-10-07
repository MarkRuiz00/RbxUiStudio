# Common mistakes (and fixes)

| Symptom | Cause | Fix |
|---|---|---|
| Gradient looks dark / wrong color | `UIGradient` multiplies `BackgroundColor3` | Set `BackgroundColor3: "#FFFFFF"` and put colors in the gradient |
| Element drifts away from its corner on other screens | Offset position on a top-level child, or AnchorPoint not matching the edge | `Position [1,-16,0,16]` + `AnchorPoint [1,0]` for top-right; Scale for top-level positions (auto-scale only scales size) |
| Square button becomes a rectangle | Scale size on both axes | Add `UIAspectRatioConstraint` (`AspectRatio: 1`) |
| Items overlap / ignore Position | Parent has a `UIListLayout`/`UIGridLayout` | Let the layout place them; use `LayoutOrder`, `Padding`, `UIPadding` |
| Items in a list don't fill the width | Scale sizes are relative to the parent, not the free space | `HorizontalFlex: "Fill"` on the layout or a `UIFlexItem` child with `FlexMode: "Fill"` |
| "nombre repetido entre hermanos" warning | Two siblings with the same `Name` | Rename (`Item1`, `Item2`…); interactions find targets by name |
| Text unreadable on textures | No outline / plate | White text + `UIStroke` `Contextual` 2–4 px dark, or a plate |
| Tiny text on phones | `TextScaled` without limits or `TextSize` < 9 | `UITextSizeConstraint` `MinTextSize ≥ 9`; prefer fixed `TextSize` + `AutomaticSize` |
| `TextScaled` + `AutomaticSize` fight | Both on the same label | Use one (Roblox recommends AutomaticSize) |
| Window doesn't open from the button | `target` name typo, or the window isn't `Visible: false` initially | Match `Name` exactly; hidden windows start `Visible: false` |
| Image shows as magenta checker in the editor | Local path doesn't exist | Fetch it (`tools/ui-resources.mjs fetch <id>`) or fix the path |
| Image missing in Roblox | Local image not uploaded | Install with the plugin (uploads first) or `rbxui_studio_upload_images` |
| Texture squashed | `ScaleType: "Stretch"` on a pattern | `ScaleType: "Tile"` + `TileSize` |
| 9-slice looks wrong only in the editor | Preview doesn't render Slice | Check in Studio; the build is correct |
| Content under the Roblox top bar | Placed in the top 58 px of the canvas | Keep that band empty; leave `ScreenInsets` at `CoreUISafeInsets` |
| Stroke cut off at the edges | `Outer`/`Center` stroke inside a clipping parent | `BorderStrokePosition: "Inner"` or add padding |
| Everything is huge on TV / tiny on phone | Pure Offset with `autoScale: false`, or pure Scale without caps | Keep `autoScale: true`, or add `UISizeConstraint` / `UIScale` per display size |
