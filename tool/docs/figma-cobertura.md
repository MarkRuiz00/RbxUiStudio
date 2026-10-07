# Figma → RbxUI: cobertura

Qué hace el importador (`studio/figma.mjs`) con cada función de Figma Design, contrastado con la referencia
funcional de Figma (sept. 2026). Solo cubre lo que se pega/arrastra (portapapeles fig-kiwi o `.fig`): RbxUI no es
un clon de Figma, es un conversor a Instances reales de Roblox, así que lo de colaboración, permisos, bibliotecas
publicadas, Dev Mode, FigJam/Slides/Sites/Make/Buzz/Weave no aplica.

Estados: **Nativo** = Instance/propiedad editable de Roblox · **Capas** = varias Instances editables que imitan el
efecto · **Imagen** = se hornea a PNG (se ve igual, no se edita por partes) · **No** = no se importa.

## Geometría y contenedores

| Figma | RbxUI | Cómo |
|---|---|---|
| Frame / grupo / sección | Nativo | Frame (grupos sin fondo; frames recortan con `ClipsDescendants`) |
| Rectángulo, elipse | Nativo | Frame + UICorner (elipse = radio 0.5) |
| Arco / anillo / sector de elipse | Imagen | SVG → PNG |
| Línea, flecha, polígono, estrella, vector, booleanas, flatten | Imagen | red vectorial (`vectorNetworkBlob`) → SVG → PNG |
| Radio de esquina (uno) | Nativo | UICorner |
| Radios distintos por esquina | Imagen | Roblox solo tiene un radio |
| Corner smoothing | No | Roblox no lo tiene (queda radio normal) |
| Rotación, espejo | Nativo / Imagen | `Rotation`; espejo = el contenido se refleja (textos espejados → imagen) |
| Constraints (izq/der/centro/ambos/escala) | Nativo | `AnchorPoint` + Position/Size en escala |

## Auto layout

| Figma | RbxUI | Cómo |
|---|---|---|
| Horizontal / vertical, gap, padding, alineación | Nativo | UIListLayout + UIPadding |
| Space between / evenly / around | Nativo | `HorizontalFlex`/`VerticalFlex` |
| Wrap | Nativo | `Wraps` (Roblox usa un solo gap: aviso si el de filas difiere) |
| Fill container / stretch | Nativo | UIFlexItem (`FlexMode=Fill`, `ItemLineAlignment=Stretch`) |
| Hug contents | Nativo | `AutomaticSize` |
| **Min/max ancho-alto** | Nativo | **UISizeConstraint** |
| **Aspect ratio (en auto-layout)** | Nativo | **UIAspectRatioConstraint** |
| Posición absoluta dentro del layout | Nativo | sale del flujo, posición fija |
| Grid con celdas iguales | Nativo | UIGridLayout |
| Grid con spans / pistas fr distintas | Posiciones fijas | UIGridLayout solo tiene un tamaño de celda (aviso) |
| Canvas stacking (First/Last on top) | Nativo | ZIndex |
| Layout en espejo, hijos girados, máscaras o fusiones dentro | Posiciones fijas | aviso |

## Apariencia

| Figma | RbxUI | Cómo |
|---|---|---|
| Relleno sólido, varios rellenos | Nativo / Capas | fondo + Frames `Fill2`, `Tint`… |
| Degradado lineal | Nativo | UIGradient |
| Degradado radial / angular / diamante | Imagen (capa) | solo esa pintura a PNG, el resto sigue nativo |
| Imagen Fill / Fit / Crop / Stretch | Nativo | ImageLabel `ScaleType` Crop/Fit/Stretch; recorte o giro de imagen → PNG |
| Imagen Tile | Nativo | ImageLabel `ScaleType=Tile` + `TileSize` |
| Ajustes de imagen (exposición, contraste…) | Imagen (capa) | |
| **Modos de fusión** (Overlay, Soft light, Multiply, Screen…) | Capas | ver abajo |
| Trazo interior / centro / exterior | Nativo | UIStroke `BorderStrokePosition` |
| Trazo con degradado lineal | Nativo | UIStroke + UIGradient |
| Trazo discontinuo, por lados, con imagen, perfil de anchura | Imagen | |
| Opacidad de capa | Nativo | transparencias / `GroupTransparency` |
| Drop shadow nítida | Capas | Frame de sombra detrás |
| Drop shadow difuminada | Capas | la sombra sola a PNG detrás (la pieza sigue nativa) |
| Inner shadow, layer blur, noise, texture, glass | Imagen | |
| Background blur | No | imposible en Roblox (aviso) |

En el editor, esas capas no salen sueltas en el árbol: se ven en **Relleno** como la pila de Figma (una fila por
pintura: tipo, fusión, ojo, opacidad, quitar). Siguen siendo Instances normales al exportar a Roblox.

### Texturas (lo más importante para el estilo Roblox)

Una textura de Figma (imagen en Mosaico/Estirar/Rellenar, con su %, su fusión y sus ajustes) llega como ImageLabel(s) que
**reutilizan el mismo PNG sin color en todas las piezas**: el color lo ponen `ImageColor3`/`UIGradient`, el % `ImageTransparency`,
el mosaico `ScaleType=Tile` + `TileSize`. Así en Roblox se sube cada textura una vez. En el editor, clic en la fila del relleno
abre su panel flotante (cambiar imagen, modo, escala, fusión, opacidad, exposición/contraste/saturación). Si cambias el color
del fondo, las texturas y el borde con fusión se vuelven a teñir solos.

### Fusiones → capas neutras (lo que evita el "fondo = una imagen")

Roblox no tiene modos de fusión. Overlay / Soft light son lineales en la capa de arriba dentro de cada mitad, así que
sobre un color C: luces = capa de color `blend(C,1)` y sombras = capa de color `blend(C,0)`, con alfa = distancia
a gris medio × 2. El importador genera **dos máscaras blancas** (`…Light` / `…Shade`) teñidas con `ImageColor3`,
o con un **UIGradient** si debajo hay un degradado lineal. Es exacto sobre fondo liso o degradado lineal, y el color
se puede cambiar en Studio. Si lo de debajo es desconocido o muy variado, capa blanca/negra gris igualando luminosidad.
Pinturas sólidas con fusión = el color exacto resultante. "Lo de debajo" = la última hermana opaca que cubre el centro.

## Máscaras

| Figma | RbxUI | Cómo |
|---|---|---|
| Máscara de forma (rect., redondeada, elipse) | Nativo | Frame `ClipsDescendants` / CanvasGroup + UICorner; lo enmascarado sigue editable |
| Máscara vectorial libre | Imagen | |
| **Máscara alfa con degradado/transparencia** | Imagen | CSS `mask-image` con las pinturas de la máscara |
| **Máscara de luminancia** | Imagen | `mask-mode: luminance` |

## Texto

| Figma | RbxUI | Cómo |
|---|---|---|
| Fuente, tamaño, color, alineación H/V | Nativo | FontFace (fuente de la Creator Store si existe), TextSize ×1.14 |
| Posición vertical exacta | Nativo | `derivedTextData.baselines` → UIPadding + centrado |
| Estilos mezclados, subrayado, tachado, mayúsculas | Nativo | RichText |
| Truncar con "…", **max lines = 1** | Nativo | `TextTruncate=AtEnd`, sin ajuste |
| Borde de texto | Nativo | UIStroke contextual |
| Relleno degradado lineal | Nativo | UIGradient |
| Texto espejado, con blur/noise/glass | Imagen | |
| Texto sobre trayectoria, listas, OpenType, ejes variables | No / aproximado | |

## Componentes, variables, prototipos

| Figma | RbxUI | Cómo |
|---|---|---|
| Instancias / variantes / slots | Aplanado | se importa el resultado visible (con overrides); no hay vínculo a componente |
| Variables / estilos | Aplanado | se importa el valor resuelto |
| Click → navegar / overlay / cerrar / volver | Nativo | `interactions` del editor (TextButton + script) |
| Scroll (H/V/ambos), fixed | Nativo | ScrollingFrame, `AutomaticCanvasSize` |
| Sticky, Smart Animate, Motion, expresiones, variables de prototipo | No | |

## Pruebas

- Comparar SIEMPRE contra la referencia plana: `fromClipboardHtml(html, { flattenAll: true })` (scratchpad `cmp_layers.mjs`).
  Ojo: la referencia pinta fusiones sobre fondo transparente (grupo aislado), así que bordes/rayas con fusión encima de
  capas semitransparentes pueden salir distintos sin que el importador esté mal.
- Test sintético con campos reales del esquema kiwi (`figtest.mjs`): auto-layout, grid, scroll, constraints, prototipos,
  textbox, borde discontinuo, min/max + proporción, máscara con degradado.
