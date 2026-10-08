# Fisch · Fish It!

**Genre:** fishing RPG / collection · **Style family:** [minimal](../estilos/minimal.md) (Fisch) / dark index (Fish It!) ·
**Why:** Fish It! was top-10 in June 2026 (~143K); Fisch defined the genre's look in 2024–25.

The lesson: **a collection index of silhouettes is the strongest retention screen in the genre**, and catch feedback is a one-line sentence.

## Screen map (Fisch)

```
┌──────────────────────────────────────────────────────────┐
│▣ ☰ 💬      SE ── S ── SW  [ Menu ][ Shop ]              👥 │
│Angler Quest                                               │
│Return this to the Angler: Sturgeon        76  +60xp       │
│                                         ( SHAKE )         │
│      You just caught a Translucent Phantom Ray at 5.8kg!  │
│                                              ☆ ≋ ☾ ❄      │
│        [1 Rod][2 Bag][3 Bestiary][4 GPS]…     Level 76      │
│                                              155,344 C$    │
└──────────────────────────────────────────────────────────┘
```

## Visual language

| | Fisch | Fish It! |
|---|---|---|
| Panels | Barely any: text with soft shadow over the world | Very dark translucent windows (`#000000`–`#252A2E`) |
| Title | Italic quest title with underline | Big title with a fish icon breaking out (`Fish Index`), collection bar `All Fish: 162/284` |
| Buttons | Translucent blue bars (`Menu`, `Shop`) under a compass strip; round dark `SHAKE` | `Sell All: Mythic` red (`#FC1518`), `Favorite: OFF` yellow (`#FADC33`), `Sell All` mint green (`#08FC97`) |
| Collection | — | Undiscovered = black silhouette + `??` in the rarity color; locations list with photo banners |
| Rarity | Colored words in sentences (`Legendary`, `Mythical`) | Framed tiles + colored mutation pills (`Ghost`, `Radioactive`, `Midnight`…) |
| Feedback | `You just caught a <name> at 5.8kg!` bottom-center, `+60xp` floating | `1 in 20` odds above the caught fish |
| Font | Italic serif/sans mix | Bold sans |

## Steal this

- Silhouettes + `??` for what's missing, with a total counter.
- Catch message as a sentence with the rarity-colored name.
- Odds on display (`1 in 1K`) for rare items.

## Build it in rbxui

The [collection index](../ejemplos/collection-index.md) example: location list, silhouette grid, progress bar, details panel with mutations.

## Sources

Gameplay screenshots via Destructoid, Deltia's Gaming, Pro Game Guides, IDN Times and LDPlayer.
