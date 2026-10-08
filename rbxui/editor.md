# Editor tools for checking a design

RbxUI Studio (the editor UI is in Spanish) has tools that make the [checklist](../checklist.md) quick to apply.

| Tool | Where | What it tells you |
|---|---|---|
| **Vista por dispositivo** | top bar (screen + phone icon) | The scene re-laid out at 844×390, 667×375, 1024×768, 1920×1080, 3840×2160 with RbxUI auto-scale; joystick/jump zones, top bar, TV-safe area; list of buttons under 44 px and text under 9 px on that device (click = select) |
| **Medir (Alt)** | hold Alt with one layer selected | Distances in px to the hovered layer, or to the container's four edges |
| **Márgenes** | layer panel (Capa) | Distance to the parent's left/top/right/bottom; amber when opposite sides differ (uneven padding) |
| **Comprobación** | toolbar badge (✓ / ⚠ N / ✕ N) | Unknown properties, invalid enum items, wrong value shapes, duplicate sibling names — same checks as `tools/validate.mjs` |
| **Relleno → textura / color con fusión** | layer panel, Relleno header | Adds a texture (tiled studs in Overlay by default, or any local ui-resources texture/effect) or a color with a blend mode to any layer. Click the fill row to edit it in a floating panel (image, mode, scale, blend, opacity, exposure/contrast/saturation) |
| **Insertar → Stud 3D** | Insertar tab | 3D stud blocks: buttons, square side button, header, card, window, 3D text ([estilos/stud.md](../estilos/stud.md#modern-stud-3d-blocks)) |

## Getting around (RbxUI Studio 2)

| | Where | |
|---|---|---|
| **Paleta de comandos** | `Ctrl+K`, the search box in the top bar or ⌘ in the dock | Fuzzy search over every action, tool, screen, layer (jumps to it), Insert component and template |
| **Plantillas** | top bar (layout icon), Home → *Desde plantilla*, or the palette | Any of the 15 [example UIs](../ejemplos/README.md) becomes a new screen with a free name (it never replaces one of yours) |
| **Dock** | bottom of the canvas | Tools (V F T I B H), undo/redo, Insert, palette |
| **Atajos** | `?` or the ⋯ menu | Every keyboard shortcut |
| **Estado** | bottom-left chip | "Saved", errors (click for details) |

## How blend modes become Roblox

Roblox UI has no blend modes. RbxUI converts them so the result looks the same and stays editable:

- **Texture with Overlay / Soft light** → two ImageLabels with *shared, colorless* masks (highlights and shadows) tinted with `ImageColor3`, or with a `UIGradient` when the layer under them is a gradient. One upload per texture, reused by every button.
- **Multiply / Screen** → one black or white mask.
- **Solid color with a blend** → a Frame with the color the blend produces over the layer's own fill (a `UIGradient` over gradients).
- Changing the layer's color or gradient re-tints all of them automatically. Exact over solid colors and linear gradients; over images or unknown backgrounds it's an approximation.
