# Collection index

![](renders/collection-index.png) · JSON: [collection-index.rbxui.json](collection-index.rbxui.json) · Style: dark index ·
Patterns from: [Fisch / Fish It!](../juegos/fishing.md)

**Purpose:** the retention screen of collection games — what you have, what you're missing, and where to find it.

## What to notice

| Element | How it's built | Why |
|---|---|---|
| Title | big fish icon rotated −14° breaking out of the corner + `Fish Index` | window identity |
| Progress | `All fish 162 / 284` bar next to the title | the completion goal is the headline |
| Locations | banner buttons with a gradient (stand-ins for location art), selected = white stroke | filter by place |
| Grid | `UIGridLayout` 130×116; found = icon + name bar in the rarity color; missing = ghost icon + `??` in the rarity color | you know *how rare* the missing fish is |
| Details | rarity card (`Epic`, icon, `1 in 1K`), facts line, mutation pills | odds and variants feed the hunt |
| Catch line | `RichText` sentence under the window with the fish name in its rarity color | feedback as one readable line |

## Notes

- For real silhouettes use the fish image with `ImageColor3 = #000000` and `ImageTransparency ≈ 0.3` — emoji can't be tinted.
