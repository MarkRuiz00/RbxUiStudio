# Rebirth popup

![](renders/rebirth-popup.png) · JSON: [rebirth-popup.rbxui.json](rebirth-popup.rbxui.json) · Style: [simulator](../estilos/simulator.md)

**Purpose:** confirm a destructive-but-rewarding action; show exactly what is lost and gained.

## Layout decisions
- **Before → after rows** (`UIListLayout` vertical): loss in red, gain in green/purple, so the trade-off reads in one second.
- **Reassurance line** ("You keep your pets") under the stats — reduces fear of the reset.
- **Two equal buttons** with `HorizontalFlex: "Fill"`: Cancel (red) left, Rebirth (purple, the feature's color) right.
- Popup ScreenGui `DisplayOrder: 10` so it sits above windows.
- `Cancel` and the header `Close` both close the popup through `interactions` (`target: "RebirthPopup"`).

## Wiring
`Confirm` → RemoteEvent; the server validates the requirement, resets coins, increments rebirths and the multiplier.
