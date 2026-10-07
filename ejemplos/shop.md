# Shop

![](renders/shop.png) · JSON: [shop.rbxui.json](shop.rbxui.json) · Style: [simulator](../estilos/simulator.md)

**Purpose:** sell currency packs and boosts for Robux; make the best offer obvious.

## Layout decisions
- **Window 760×520, centered** slightly below the middle (`Position [0.5,0,0.54,0]`) to clear the top bar.
- **Header 62 px** in the shop's identity color (gold) with the title left and a red close button right — color only in the header, the body stays dark so cards pop.
- **Tabs** (`UIListLayout` horizontal): the active tab gets the header gradient, inactive tabs are dark with gray text.
- **`ScrollingFrame` + `UIGridLayout`** (166×200 cells, 14 px gaps, `AutomaticCanvasSize: "Y"`): any number of products; the second row peeking out signals "scroll".
- **Card anatomy** top→bottom: sunburst + icon, name, what you get, price button. Price button is green = buy, with the Robux icon tinted white.
- **"BEST VALUE" tag** slightly rotated over the card edge — breaks the grid on purpose for the offer you want to sell.

## Decisions worth copying
- Card color = rarity/value tier (blue → green → purple → gold).
- Price text width is fixed per digit count so the icon + price group stays centered (the editor can't measure `AutomaticSize` text yet).
- `ShopButton` (bottom-left) shows the no-code toggle: `interactions: toggle → ShopWindow, pop`.

## Phones
Cells are 166 px wide in canvas units → ~4 per row on PC; on a 844×390 phone the auto-scale shrinks everything proportionally (window ~60 % of the height). For many products, add a `UIAspectRatioConstraint` to the grid instead of fixed cells.

## Wiring
Each `Buy` button → `MarketplaceService:PromptProductPurchase(player, productId)` in a LocalScript; grant on the server in `ProcessReceipt`.
