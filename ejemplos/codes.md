# Codes

![](renders/codes.png) · JSON: [codes.rbxui.json](codes.rbxui.json) · Style: [simulator](../estilos/simulator.md)

**Purpose:** redeem promo codes; tell the player where to find more.

## Layout decisions
- **Small window (500×300)** — one task, one input, one button.
- **TextBox** with placeholder, large text (26 px) and `ClearTextOnFocus: false` so typos can be fixed.
- **Status line** under the button (green success / red error) instead of a separate popup.
- Hint text above the input sends players to the group (community growth).

## Wiring
On `Redeem`, send the text to the server (RemoteFunction), validate against your code list and per-player redemption record, and return a message for `Status.Text`. Never trust the client with rewards.
