# RbxUI Design System (v10 · Stud Style WangUI) — base de conocimiento

Objetivo: UIs de Roblox estilo simulator **rápidas y armónicas**. Se diseña en HTML con `ds/ds.css` + `ds/ds.js`
(constructores de componentes), se exporta con `export.mjs` → PNG + `build.luau`.

## 0. ESTILO OBJETIVO: "Stud Style" de WangUI (v10) — el usuario dijo "muestra al 100% lo que quiero"
Referencia: tweet x.com/i/status/2102918341748985941 → fotogramas en `assets/ref_wangui/` (Index, Inventory, Rebirth, Premium Shop).
ABRIRLOS Y COMPARAR antes de diseñar nada. Comparativa actual: `out/gif_vs_v10.png`.
1. **Studs en TODO lo de color** (cabeceras, botones, tarjetas): textura `0092` a 37px en `overlay`. En el cuerpo de ventana studs muy tenues.
2. **Esquinas 100% RECTAS (radio 0)** en todo. Contorno negro 2px + reborde interior claro fino.
2b. **Brillo tipo cristal** en toda pieza de color: línea blanca de 2px arriba, mitad superior más clara con corte duro al 48%, **dos reflejos diagonales** (112°) y **bisel oscuro** de 4px abajo. Parámetros por pieza: `--gloss`, `--sheen`, `--bevel` (cajas oscuras y ventana a 0). La cabecera lleva sus propios reflejos (105°).
3. **Ventana**: cuerpo carbón `#31333b→#292b32`; cabecera del color del tema (degradado claro→oscuro) 50px, icono 40 + título 26px blanco; **X roja cuadrada** con reborde naranja.
4. **Secciones**: etiqueta dorada pequeña ("Gamepasses!") con línea dorada brillante debajo (`sect()`).
5. **Tarjetas de pase**: fondo radial saturado (verde/naranja) + sunburst, título grande con DEGRADADO de color (morado/azul), icono en **moneda dorada** (`coin()`), texto descriptivo a la derecha, botón verde con logo Robux abajo-derecha.
6. **Slots Index/Inventory** (`tile()`): relleno oscuro del color de rareza (radial) + **borde interior brillante** del mismo color, esquinas 6px, icono grande centrado, texto abajo-izquierda ("1 in 2", "$4.3m/s", "x100").
7. **Rebirth**: cajas casi negras con icono + texto (`box()`), **flecha roja** con contorno (`arrow()`), aviso rojo + barra de progreso lima (`progress()`), botón lima + botón rosa con **badge de precio Robux** en la esquina (`btn({badge})`).
8. **HUD**: "Shop" ancho naranja con la cesta sobresaliendo por la izquierda; cuadrados 66px de color con icono y etiqueta; dinero = icono + número grande verde lima SIN caja + "+" verde.
9. Botones: lima = acción/comprar, rosa/magenta = pagar Robux/saltar, rojo = cerrar. Texto blanco borde negro siempre.
10. Iconos quietos; animación solo en ventanas (0.2s) y botones.

## 1. Tokens
| token | valor | uso |
|---|---|---|
| `--ink` | por variante (`--tk` del tema, `#16600a` CTA, `#7a3e00` dorado…) | contorno + trazo/sombra del texto que contiene |
| `--bw` | `2px` | borde de todas las piezas |
| `--r-s / --r-m / --r-l` | `3 / 4 / 6px` | botón / tarjeta / ventana |
| `--lip` | `3px` (ventana 4px) | sombra sólida inferior |
| espaciado | `4, 8, 12, 16` | gap entre piezas 8-12, padding de ventana 14 |
| `v-dim` | negro 28-40% translúcido | barras de divisa, estado reclamado/bloqueado |
| CTA | `#9cf53b → #2fb81a` | SOLO comprar/confirmar |
| danger | `#ff6a6a → #d8182a` | SOLO cerrar |

Temas (`th-<nombre>`): `orange, gold, blue, green, purple, pink`. Cada uno define `--t1` (claro) … `--t4` (oscuro) y `--tk` (contorno).
Ventana: cuerpo `t3→t4`, cabecera `t1→t2→t3` (más clara que el cuerpo). Tarjetas: `shade 0` = `t1→t2` (brillante), `2` = héroe dorado, `'n'` = apagado.

## 2. Tipografía
Montserrat 900 (Roblox: `Montserrat.json`, `FontWeight.Heavy`), blanco, contorno `--ink`, sombra 2px.
Solo 3 tamaños: `t-title` 30px · `t-label` 19px · `t-small` 14px. Cursiva: nunca (salvo un título promo).
Color alternativo único: dorado `#ffd83a` para precios tachados/valor. Degradado de texto: solo títulos de tarjeta.

## 3. Componentes (`ds.js` v10)
`win({name,title,icon,theme,w})` · `sect(name,text)` · `card({name,theme,variant:'card',fxs,style})` · `tile({name,theme,file,tl,bl,w,h,iconSize,state:'claimed',blCls})` · `coin(file,size)` · `box(name,inner,style)` · `arrow(name)` · `progress({name,value,text,style})` · `btn({name,label,variant:'cta'|'pink'|'grey'|'std',theme,size,badge})` · `buy({name,price,size,variant})` · `hero(file,name,size,opts)` · `hudWide(name,file,label,theme)` · `hudSquare(name,file,label,theme)` · `currency(name,file,value,colorCls)` · `fx()` · `place()` · `render()`.
Temas: orange, yellow, gold, red, pink, lime, green, teal, cyan, blue, purple, grey.

## 4. Recetas (pantallas en `screens/`)
- **Premium Shop** (`shop.html`): `win(yellow)` → `sect('Gamepasses!')` → 2 `card` (lime / orange) con título degradado + `coin` + descripción + `buy` → `sect('Bundles!')` → tarjeta cyan con `hero` + título dorado + `buy l` con precio tachado.
- **Daily Rewards** (`daily.html`): `win(purple)` → grid 3×2 `tile` (Day N arriba-izq, xN abajo-izq, colores variados; día 1 `claimed`) + Día 7 `tile gold` alto → `btn Claim (cta l)` + `btn Skip All (pink l, badge 99)`.
- **Rebirth** (`rebirth.html`): `win(red)` → 2 filas `box → arrow → box` → `box` con aviso rojo + `progress` → `btn Rebirth (cta)` + `btn Rebirth Now (pink, badge)`.
- **Index/Inventory**: `win(green|blue)` → grid de `tile` por rareza + botones inferiores (Equip Best lima, Auto Sell rosa, contador en `box`).

## 5. Checklist antes de exportar
- [ ] ¿Comparado con la referencia lado a lado (proporciones, densidad, grosores)?
- [ ] ¿Cuerpo gris a cuadros + color solo en cabecera? ¿Texto con borde negro?
- [ ] ¿Iconos grandes (75-85%)? ¿Contornos del tono de cada pieza?
- [ ] ¿Ningún icono sobresale? ¿Ninguna recompensa con caja?
- [ ] ¿≤1 título por tarjeta y sin descripciones?
- [ ] ¿Bordes 2px, radios 3-6px?
- [ ] ¿Logo Robux oficial en todos los precios?
- [ ] Revisar `design.png` a 1:1 (recortes) buscando: textos cortados, máscaras con bordes duros, desalineados.
- [ ] `compare.png` igual que `design.png`.

## 6. Animaciones (runtime)
`runtime/RbxUIController.client.luau` → `StarterPlayerScripts.RbxUIController`. Solo referencia la UI (UIScale/Position/Rotation/Visible).
- El exportador pone `AnchorPoint 0.5,0.5` a todo (escala/rotación desde el centro), `UIScale` en cada imagen y botón, y ventanas `*Window` con `Visible=false`.
- Ventanas (rápido): escala 0.78→1 Back 0.2s + subida 4% Quint 0.2s + blur 14 en 0.15s; tarjetas del Body en cascada (0.025s, 0.18s Back). Cierre 0.12s (bajada + 0.85). El mismo botón abre/cierra. Precarga de imágenes al arrancar.
- Botones: hover 1.06, pulsar 0.9, soltar rebote Back. Pestañas: `TabHighlight` se desliza a la pulsada.
- **Iconos SIEMPRE QUIETOS**: sin tambaleo, latido ni flotación (lo pidió el usuario). Solo se animan ventanas y botones.
- Navegación por nombre (`bind(gui, "HUDLeft.ShopButton", ...)`); compras en tabla `PRODUCTS` (id 0 = sin configurar).
- `ShopScreen:GetAttribute("HideLegacyHUD")` (true) oculta en juego `StudUI.HUD.Buttons/BottomLeft/StarterPack` del juego original.

## 6b. RbxUI Studio (editor visual)
Flujo recomendado: diseñar/retocar en **RbxUI Studio** (`rbxui/studio/`, ver README) → Exportar → Claude instala en Studio.
- Para crear rápido: componer con `ds.js` en `screens/x.html` → Importar en el Studio → ajustar a mano.
- Las escenas usan las MISMAS clases de `ds.css`: cualquier cambio de estilo del sistema se refleja en todas.
- Nombres: botones terminan en `Button` (ImageButton), la ventana en `Window` (el runtime la abre/cierra), su contenido en un Frame `Body` (animación en cascada).

## 7. Pipeline
```
node rbxui/export.mjs rbxui/screens/<pantalla>.html --shot   # iterar
node rbxui/export.mjs rbxui/screens/<pantalla>.html          # PNG + build.luau (+ postimg anti-halo)
```
Importar a Studio: `python studio_sync.py plan <Screen...>` → `upload_image` → `studio_sync.py record` → `studio_sync.py install` → `execute_luau` (ver `README.md`). Caché de assets por hash de contenido en `out/asset_cache.json`.
