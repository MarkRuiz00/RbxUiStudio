# rbxui — diseñar UI de Roblox en HTML y exportarla

Pipeline: **HTML/CSS/SVG** (se ve y se itera rápido) → **export.mjs** (Playwright + Chrome) → PNGs + `build.luau` → Studio (Instances permanentes en StarterGui).

## ⭐⭐ RbxUI Studio — editor visual tipo Figma (flujo principal)
Abrir: doble clic en `rbxui/RbxUI Studio.bat` (o `node rbxui/studio/server.mjs` → http://localhost:5170/studio/). En Claude Code: `preview_start rbxui-studio`.
- **Pegar de Figma**: capas editables (fusiones → capas Luz/Sombra teñidas, texturas en mosaico, máscaras = recorte). Qué se importa y cómo: [`docs/figma-cobertura.md`](figma-cobertura.md).
- **Escenas** = `screens/<Name>.scene.json` (Name = nombre del ScreenGui). Árbol de nodos con posición absoluta y clases del design system.
- **Capas** (arrastrar para reordenar/anidar, ocultar, bloquear, renombrar con doble clic) · **Insertar** (ventanas, botones, comprar con Robux, HUD, tarjeta, slot, caja, sección, moneda, barra, flecha, textos, iconos, efectos, grupo) · **Iconos** (Studs + Robux; con una imagen seleccionada la reemplaza).
- **Lienzo**: clic selecciona como Figma (primero el grupo de arriba; doble clic entra; Ctrl+clic profundo; Esc sube), arrastrar con imán a bordes/centros (guías rosas), asas de tamaño, zoom/paneo.
- **Propiedades**: nombre, cómo se exporta (imagen/texto/frame/horneado), X/Y/W/H, color de tema, estilo (v-*), studs/brillo/reflejos/bisel, degradado propio, texto (tamaño, color, alineación, degradado), icono, clases y CSS crudos, alinear/distribuir.
- **Exportar a Roblox** = guarda + `export.mjs screens/<Name>.scene.html` → `out/<Name>/` (PNG + build.luau). La instalación en Studio la hace Claude (`studio_sync.py` + MCP).
- **Importar** convierte una pantalla hecha con los constructores DS (`screens/*.html`) en escena (`studio/convert.mjs`). Paridad comprobada: <0.6% de píxeles distintos (bordes de texto).
- Código: `studio/server.mjs` (API sin dependencias) · `studio/render.js` (renderizador compartido editor/export) · `studio/editor.js` · `studio/convert.mjs` · `studio/scenehtml.mjs`.
- Claude puede editar escenas a mano (JSON) o generarlas con los constructores DS e importarlas; el usuario retoca en el editor.

## ⭐ Interfaz del editor (estilo Figma, 2026-09-27)
- Tema oscuro/claro con los tokens de Figma UI3 (`studio.css`, botón sol/luna; se recuerda en localStorage), Inter 11 px, iconos SVG propios (`studio/icons.js`, `SVGI()`
  en editor.js — ojo: `ICON()` de editor.js son rutas de Studs).
- Herramientas: **V** mover · **F** frame · **T** texto · **I** imagen · **B** botón · **H** mano. Se dibuja arrastrando en el lienzo; se crea dentro del frame que hay debajo.
- **Fuera del marco**: el lienzo muestra y edita lo que sale del escenario (como Figma); etiqueta «fuera» en capas; **Shift+1** ver todo, **Shift+2** selección,
  clic en el % = 100%. En «Probar» se recorta a la pantalla real.
- **Fondos del lienzo** (panel sin selección): baseplate, cielo, pradera, atardecer, noche, studs, rejilla, transparente, colores, `ui-resources/Backgrounds`,
  y **Subir** (captura de tu juego → `assets/backgrounds/`). Solo referencia: no se exporta. `RBXRender.BG_PRESETS` / `stageBg()`.
- Panel de propiedades: **Relleno** (muestra + hex + %, degradado con inicio/fin/ángulo), **Borde** (UIStroke: color, grosor, borde/texto, uniones), **Esquinas** (UICorner).
- **Iconos**: Juego (Studs) · Efectos (ui-resources: sunbursts, estrellas, texturas…) · **Online** (Iconify: búsqueda + datos por colección en JSON, SVG montado
  en el editor → PNG en el servidor; color elegible para los monocromos; colecciones: emojis a color, Game Icons, Material, Lucide, Phosphor, Tabler…).

## ⭐⭐ Ejemplos IA, Logos y MCP (2026-09-27)
- **Marca**: logo en `studio/brand/` (`logo.png` 512, `logo-128.png`, `favicon.png`, `logo.ico`, original `logo_original.webp`). Pantalla de carga animada, botones con degradado de marca.
- **Ventanas** (`openWin` en editor.js): modales (fondo con desenfoque, una a la vez; `modal(h('h3',título), …)` sigue valiendo) y **flotantes** (sin fondo,
  arrastrables por la cabecera, varias a la vez). Esc cierra la de delante (las flotantes solo si tienen el foco). Avisos flotantes `toast(msg, 'ok|err|warn|info|busy|mcp')`.
- **Ejemplos IA** (botón del libro): UIs del usuario como referencia de estilo para la IA. Con la ventana delante, **Ctrl+V** de lo copiado en Figma lo convierte y lo guarda;
  también soltar `.fig`/`.json`, «De la selección», «Escena actual», «Desde JSON». Cada ejemplo = `examples/<id>.json` {name, desc, include, source, rbxui}; miniatura viva,
  interruptor «usar en el prompt», insertar en la escena, ver JSON. `GET /api/ai-prompt?examples=marked|all|none|ids` = prompt rbxui + ejemplos (lo usa la pestaña Prompt IA y el MCP).
- **Logos** (Iconos → Logos): carpetas en `assets/logos/<carpeta>/` (PNG/JPG/WEBP/SVG). Subir carpeta (📁↑), subir archivos, borrar carpeta; **soltar carpetas** en el lienzo
  o en la pestaña Iconos. Clic = insertar (o reemplazar la ImageLabel seleccionada); los SVG se rasterizan al insertar.
- **MCP** (botón del enchufe; punto verde = cliente conectado): `studio/mcp.mjs` (stdio, sin dependencias; si el servidor del editor no está, lo arranca).
  «Conectar» registra el MCP en **Claude Code** (`claude mcp add -s user rbxui`), **Claude Desktop** o **Cursor** (JSON, con copia `.rbxui.bak`); «Probar» lanza mcp.mjs y lista sus herramientas;
  actividad en vivo de cada llamada. Herramientas: `rbxui_status`, `rbxui_design_guide`, `rbxui_list_scenes`, `rbxui_get_scene`, `rbxui_put_scene` (el editor se actualiza solo),
  `rbxui_render` (PNG de la escena guardada vía Chrome + `studio/view.html`), `rbxui_open_scene`, `rbxui_editor_selection`, `rbxui_editor_insert` (en vivo, sin guardar),
  `rbxui_list_examples`, `rbxui_get_example`, `rbxui_add_example`, `rbxui_list_logos`, `rbxui_build`.
- **En vivo**: el editor escucha `GET /api/events?cid=` (SSE). El MCP pide cosas al editor con `POST /api/editor/rpc` → evento `rpc` → la pestaña activa responde en `/api/editor/reply`.

## ⭐⭐ Plugin de Roblox Studio «RbxUI Connect» (2026-09-27)
- Fuente `plugin/RbxUIConnect.plugin.luau` (sin anotaciones de tipo para poder pasar `node ../tools/luacheck.js`). Se instala desde el editor (botón **Studio** → Instalar plugin)
  en `%LOCALAPPDATA%\Roblox\Plugins\RbxUIConnect.lua`. Studio lo carga al abrir un place; la primera vez pide permiso HTTP para localhost.
- Widget acoplable: estado, escenas nativas con «Instalar», «Instalar todas», «Instalar solo al guardar en el editor» (autoinstalación), «Editar la selección en RbxUI»,
  «Subir imágenes que faltan», actividad y URL del servidor.
- Protocolo: long-poll `GET /api/studio/poll` (20 s) → trabajos `install` (build.luau en un ModuleScript temporal + LocalScript RbxUINative; con ChangeHistory = Ctrl+Z),
  `upload` (píxeles de `/api/studio/pixels` → `AssetService:CreateEditableImage` + `WritePixelsBuffer` + `CreateAssetAsync(Image)`: **sin API key**, solo plugins locales;
  cada id se guarda al momento en `assets/rbx_assets.json`), `export` (ScreenGui → rbxui, sin valores por defecto; `RbxUI_*` vuelven a interactions/buttonFx) y `list`.
- Editor: botón **Studio** (punto verde = conectado), ventana Roblox Studio, y «Construir en Roblox» → **Instalar en Studio** (sube antes las imágenes).
  Traer de Studio: los `rbxassetid` sin archivo local se descargan como miniatura (thumbnails API) a `assets/roblox/<id>.png` y se registran.
- MCP: `rbxui_studio_status`, `rbxui_studio_install`, `rbxui_studio_upload_images`, `rbxui_studio_list_guis`, `rbxui_studio_pull`.

## ⭐⭐ Compatibilidad con Figma ampliada (2026-09-27)
- **Auto-layout** → `UIListLayout` (FillDirection, Padding, alineaciones, `HorizontalFlex/VerticalFlex` = SpaceBetween/Around/Evenly, `Wraps`) + `UIPadding` +
  `UIFlexItem` (hijo «Fill container» = FlexMode Fill, «Stretch» = ItemLineAlignment Stretch) + `AutomaticSize` si abraza el contenido. **Grid** con celdas iguales → `UIGridLayout`.
  Cada hijo va en su hueco exacto; si saca varias capas (sombra) o un PNG con margen (iconos) se mete en un Frame del tamaño del hueco. Hijos «Absolute» fuera de la lista.
  Con máscaras/fusiones/capas giradas dentro, o espejo → posiciones fijas (aviso). Opción por escena: ScreenGui → Auto-layout «Nativo / Posiciones fijas» (`&layout=0`).
- **Restricciones** (Left/Right/Center/Left&Right/Scale) → `AnchorPoint` + UDim2 con escala: lo anclado a la derecha sigue a la derecha en otras pantallas.
- **Prototipo** → `interactions`: On click → Navigate/Swap = open, Open overlay = toggle, Close/Back = close; animación si no es instantánea. La capa pasa a botón con buttonFx
  (también con hover/press de componentes interactivos). Los destinos empiezan ocultos (salvo la primera pantalla copiada). Copia el destino junto con el botón.
- **Scroll** de Figma (o etiqueta) → `ScrollingFrame` interior (CanvasSize del contenido, AutomaticCanvasSize con auto-layout); el fondo queda fuera; «Fixed» fuera del scroll.
- **Texto**: subrayado/tachado (`<u>/<s>`), truncado «…» (`TextTruncate AtEnd`), tramos con otra fuente (`<font family=…>`), cursiva (`<i>`), color/tamaño/peso por tramo.
- **Bordes** discontinuos y con grosor distinto por lado → horneado; vectores con `stroke-dasharray`. **Componentes** → atributos `FigmaComponent` / `FigmaVariant`.
- **Etiquetas en el nombre de la capa**: `[ignore]` no se importa · `[hidden]` Visible=false · `[button]` botón · `[textbox]`/`[input]` TextBox (el texto pasa a PlaceholderText) ·
  `[scroll]`/`[scrollx]`/`[scrollxy]` · `[flatten]`/`[image]`/`[png]` toda la capa a una imagen · `[native]` no hornear · `[absolute]`/`[nolayout]` sin auto-layout. Se quitan del Name.
- Editor: `layoutKids` (rbxjson.js) entiende Flex, Wraps, UIFlexItem y ItemLineAlignment; RichText `family=` y TextTruncate se pintan.

## Proyectos y carpetas (página de inicio)
- `/` → `studio/home.html` (+ `home.js`, `home.css`): proyectos = grupos de escenas, en carpetas con color. `projects.json` en rbxui/ (se crea solo la
  primera vez: Steal And Grow en «Juegos», test en «Pruebas»). API `GET/POST /api/projects` (acciones create, update, delete[deleteScenes → screens/_papelera],
  addScenes, removeScene, folderCreate/Update/Delete). Portada = la escena más grande. Arrastrar tarjeta → carpeta. Ctrl+K busca.
- Editor con `?project=<id>`: miga con el nombre, el selector solo lista sus escenas, logo → inicio. Escenas nuevas (`POST /api/scene?project=`),
  importadas (`/api/rbxui/import?project=`) y las del MCP / Studio (proyecto del estado del editor) se añaden al proyecto.
- Ejemplos IA = «apuntes»: `studyNotes()` en server.mjs resume la técnica (estructura, paleta, fuentes, bordes, radios, degradados) y va delante de cada JSON
  en el prompt / `rbxui_design_guide`; las tarjetas la muestran.
- Figma: texto en espejo → imagen (`bakeText` con scaleX(-1)); texto de una línea → TextYAlignment Center.

## Copia para el móvil (Artifact privado)
- `node studio/showcase.mjs` → `out/showcase/index.html` (visor con las escenas nativas, renderizador del editor en línea, vista «Juego» con todas las pantallas a la vez,
  botones que abren/cierran ventanas, pantalla completa girada) + `out/showcase/files.json` (imágenes a publicar con `root` = rbxui/).
  Publicado en https://claude.ai/artifact/32sNm5sButYt6DGK6PMC2b — para actualizar: regenerar y republicar con ese `url`.
- Modo red local del servidor: escucha en 0.0.0.0; fuera de este PC exige la clave del QR (cookie `rbxui_t`, `.secrets/lan.json`). OJO: detrás de un túnel
  (localhost.run, cloudflared…) las peticiones llegan desde 127.0.0.1 y se saltarían la clave: antes de montar uno, tratar como remotas las que traigan X-Forwarded-*/Host público.

## Mascota (estados vacíos y errores)
- `studio/brand/mascot_error.png` (enchufe): página de error del servidor (404/500 en navegador), ventanas de error, «se perdió la conexión» (precargada como blob
  para verse con el servidor caído), Studio/MCP sin conectar. `studio/brand/mascot_empty.png` (cajón): sin escenas (lienzo), escena vacía, sin ejemplos, sin logos.
  `mascot_ok.png` (enchufe conectado): conexiones de Studio/MCP, «Instalado en Studio», héroes de las ventanas conectadas · `mascot_work.png` (llave inglesa): avisos
  de espera (`toast(…, 'busy')` la pone sola: Figma, subir imágenes, instalar) · `mascot_search.png` (lupa): búsquedas sin resultados y 404 · `mascot_lock.png` (candado): 401/403.
  Helper `stateBox(kind, título, texto, botones, tamaño)` y `toast(msg, kind, { mascot })` en editor.js; todas se precargan como blob.

## ⭐⭐ Escenas nativas + formato JSON "rbxui" (Instances reales, sin PNG) — 2026-09-27
Segundo tipo de escena (`"native": true`): cada nodo es una **Instance real de Roblox** (`rbxClass` + `props` + modificadores UI* en `mods`).
Lo que pinta el editor = lo que crea Roblox (comprobado en "Steal And Grow!": ShopScreen/DailyScreen/RebirthScreen nativas instaladas).
- **Formato** `{"format":"rbxui","version":1,"name","screens":[ScreenGui...]}`. Nodo `{ClassName, Name, props, children, interactions?, buttonFx?, attributes?}`.
  Tipos: Color3 `"#RRGGBB"` · UDim2 `[xs,xo,ys,yo]` · UDim `[s,o]` · Vector2 `[x,y]` · enums por nombre · ColorSequence `[[t,"#hex"]]` ·
  NumberSequence `n | [[t,v]]` · Font `{family,weight,style}`. ScreenGui lleva `"design":{"width":1280,"height":720,"autoScale":true,"background":"#hex|baseplate"}`.
  Imágenes: `"rbxassetid://N"` o ruta local `"assets/studs/X_Outline.png"` (se sube y se mapea en `assets/rbx_assets.json`).
- **Editor**: botón **JSON rbxui** (Importar pegando la respuesta de una IA / archivo · Exportar · **Prompt IA** para copiar) · **▶ Probar** (tecla P: hover/pulsar + abrir/cerrar ventanas con pop) ·
  Insertar muestra Instances + kit Stud Style nativo · Propiedades: clase, Visible, Anchor, ZIndex, fondo, texto (fuentes oficiales), imagen, modificadores (JSON), interacciones, props crudas ·
  franja de la barra superior (58 px) · UIListLayout/UIGridLayout se recolocan en vivo. Guardar escribe también `screens/<Name>.rbxui.json`.
- **Construir en Roblox** → `out/native/<Doc>.build.luau` (script que crea las Instances; los ScreenGui anteriores del mismo nombre van a `ServerStorage.RbxUI_Backup`).
- **Runtime** `runtime/RbxUINative.client.luau` (StarterPlayerScripts): autoescala (UIScale = min(ancho/1280, alto/720) en cada hijo del ScreenGui), ventanas exclusivas con pop + blur,
  hover/pulsar, `interactions` (toggle/open/close, destino buscado en todo el PlayerGui), `RbxUI_HidePaths` en el ScreenGui oculta HUDs del juego.
- **Código**: `studio/rbxjson.js` (conversión JSON⇄escena, defaults de Roblox, render nativo, prompt IA) · `studio/studkit.js` (kit Stud Style: win/button/buyButton/priceBadge/hudSquare/hudWide/
  piece/tile/box/coin/section/currency) · `studio/rbxbuild.mjs` (JSON → Luau; CLI `plan`/`record` de imágenes) · `screens/native.mjs` (genera las 3 pantallas → `screens/StudStyle.rbxui.json`).
- **Instalar (Claude)**: `cd rbxui && python -m http.server 8765 --bind 127.0.0.1` → `node studio/rbxbuild.mjs plan <json>` → `upload_image` → guardar resultado → `node studio/rbxbuild.mjs record <res.json>` →
  `node studio/rbxbuild.mjs <json>` → `execute_luau` (Edit): HttpEnabled on solo para GetAsync, ModuleScript temporal con Source = build.luau, `require(m)()`, destruir; LocalScript `RbxUINative`.Source = runtime.
- **Desde Figma** (escenas nativas): en Figma selecciona y **Ctrl+C** → en el editor **Ctrl+V**. También: arrastrar un **.fig** (elige frame; trae las imágenes),
  pegar/arrastrar PNG/JPG/SVG (con una ImageLabel seleccionada, la reemplaza) y pegar JSON rbxui. Ctrl+C en el editor copia JSON rbxui al portapapeles del sistema.
  `studio/figkiwi.mjs` decodifica el binario de Figma (fig-kiwi: esquema kiwi embebido + zstd/deflate, sin dependencias) · `studio/figma.mjs` lo convierte:
  frames/rectángulos → Frame (+UICorner/UIStroke/UIGradient lineal, recorte si el frame recorta), texto → TextLabel (fuente mapeada a una oficial de Roblox, TextSize = fontSize×1.14,
  una línea en Figma ⇒ sin ajuste, estilos mezclados ⇒ RichText), vectores e iconos (frames solo con vectores) → SVG → PNG en `assets/figma/` → ImageLabel,
  sombras nítidas → copia desplazada, capas llamadas *Button/Btn* → TextButton/ImageButton con buttonFx, instancias sin hijos → se copian del componente con overrides.
  Un frame único 16:9 se trata como pantalla y se escala al escenario; si lo pegado es mayor que el escenario, se encaja (×escala).
  **Imágenes**: el `figmeta` del portapapeles trae `imageHashes` {sha1: URL firmada de S3, caduca} → se descargan (caché `out/figma/cache/`) y se reducen a 1024 px;
  si una falla queda el hueco `figma-image:<hash>` (pegar encima un PNG o importar el .fig).
  **Piezas que Roblox no puede pintar** (pinturas con fusión OVERLAY/MULTIPLY…, texturas en mosaico o recortadas, degradados radiales/angulares, sombras difuminadas,
  radios distintos) → el fondo + contorno + sombras se hornean a PNG con Chrome (mix-blend-mode = mismo resultado que Figma) y los hijos siguen nativos encima.
  **Efectos** (`fxFilter` en figma.mjs, un filtro SVG que sirve para `<g filter>` y para `filter:url()` en HTML): Drop/Inner shadow, Layer blur (FOREGROUND_BLUR,
  progresivo = medio), Noise (MONOTONE/DUOTONE/MULTITONE, densidad, tamaño), Texture (= GRAIN: bordes deformados, clipToShape), Glass (bisel + brillo especular;
  la refracción de lo de detrás no existe en Roblox). Background blur: imposible (no hay desenfoque por Frame) → aviso. Repeat/Symmetry/Custom → aviso.
  Textos: sombra nítida = copia nativa; halo difuminado = texto nativo + PNG del halo detrás; blur/noise/grain/glass/inner = el texto entero a PNG (fuente de Google).
  Vectores sin `fillGeometry` (lo normal en el portapapeles) se leen de `vectorNetworkBlob` (sin regiones = se rellena el lazo); booleanas sin geometría = unión / resta con máscara.
  Grupos modernos = FRAME con `resizeToFit` (sin recorte ni fondo).
  **Bordes** con fusión (SOFT_LIGHT/OVERLAY… típico "borde interior que tiñe"), degradado o imagen → anillo enmascarado (content-box XOR) fusionado con el relleno, en el PNG horneado.
  **Espejo**: matriz con determinante < 0 = volteo horizontal + rotación (no 180°); se propaga a los hijos (posición reflejada), iconos volteados en el SVG,
  fotos con PNG volteado (`<hash>_m.png`), degradados con ángulo espejado; el texto nativo no se puede voltear (aviso).
  **Sombras nítidas**: todas (la primera encima), con spread; en textos la copia engorda el UIStroke (el contorno negro que "baja").
  **Máscaras y fusiones de capa** (render de escena, `htmlNode`/`sceneDoc` en figma.mjs): la escena pegada se pinta en HTML fiel a Figma (left/top sin
  contextos de apilamiento => las fusiones atraviesan grupos como en Figma; máscara = no se pinta y recorta a las hermanas de encima con clip-path en su
  espacio local). Lo enmascarado se hornea recortado (render aislado); una capa con fusión (OVERLAY/SOFT_LIGHT… a nivel de capa) se "desfusiona":
  se pinta la escena sin y con ella y se despeja una imagen normal L con "L encima de B = R" (alfa mínimo). Imágenes servidas por URL virtual (img.local).
  Imágenes STRETCH/CROP con transformación (recorte, rotación, ESPEJO) se colocan con la matriz inversa.
  **Escala al pegar**: por defecto diseño 1920×1080 (×720/1080), opción por escena (ScreenGui → Figma: 1080p / 1:1 / encajar); si no cabe, se encaja.
  **Fuentes**: si Roblox no la trae integrada, se usa la misma de la Creator Store por id (`rbxassetid://…`, tabla `ASSET_FONTS` en rbxjson.js,
  Inter = 12187365364); el editor la carga de Google Fonts al vuelo. El último pegado se guarda en `out/figma/last_paste.html` para depurar. Probado con .fig reales (formato v101, 449 capas en ~1,7 s).
- **Lecciones Roblox (comprobadas)**: UIStroke `LineJoinMode=Miter` + UICorner ⇒ contorno CUADRADO (usar Round en piezas redondas; el editor lo pinta igual) ·
  `Instance.new` da fondo `#A3A2A5` y fuente LegacyArial (el editor usa esos defaults) · el constructor fuerza `BorderSizePixel=0`, `AutoButtonColor=false`, ScreenGui `ResetOnSpawn=false`,
  `ZIndexBehavior=Sibling`, `ScreenInsets=DeviceSafeInsets` · studs nativos = `assets/rbx/stud.png` (versión sombra/brillo de Stud/0092) en mosaico 37 px con ImageTransparency ~0.72.

## ⭐ Design System (base de todo)
**Leer primero `DESIGN_SYSTEM.md`** (reglas, tokens, componentes, recetas, checklist).
- `ds/ds.css` (tokens + componentes) · `ds/ds.js` (constructores `DS.win/tabs/card/hero/reward/buy/btn/hudSquare/hudWide/currency/place/render`).
- Pantallas en `screens/`: `shop.html`, `daily.html`. Nueva pantalla = copiar una y componer con `DS.*`.
- Robux oficial: `assets/brand/robux_ol.png` (con contorno) / `robux_white.png`.

## Assets (usar SIEMPRE)
- `assets/studs/` — Studs Icon Pack v4 (gvesster, 152 iconos; `*_Outline.png` = con contorno oscuro, el estilo bueno). Licencia: uso en juegos propios OK; NO revender/redistribuir el pack ni usarlo en encargos de clientes. Ojo: `Basket_Outline` = cesta roja, `Cart_Outline` = carrito, `X_Red_Outline` = X de cerrar.
- `assets/ui-resources/` — 583 recursos de https://ui-resources.com (API `/api/resources`): Effects (halftones, sunbursts, stars, lightning…), Textures (stud, checker, grid, paper), Icons, Faces. Índice en `index.json`.
- Fuente: **Montserrat Black Italic** (la de los UI kits de referencia; en Roblox `Font.new("rbxasset://fonts/families/Montserrat.json", Heavy, Italic)`). Texto = contorno 6-8px + sombra sólida inferior.
- v3 (histórico): `kit3.css` + `kit3.js` + `shop3.html`. Estilo cuadrado (radio 3-8px), borde oscuro + borde interior claro, labio inferior.
  - Pieza: `pc` + color `c-green|lime|purple|gold|orange|red|blue|cyan|teal|pink|grey|dark|slate|rainbow` + textura `tx-stud|tx-studL|tx-weld|tx-lines|tx-dots` + radio `r0..r3` (+ `flat`, `pill`).
  - La textura va en `::after` con opacidad `--to` y máscara `--tm` (por defecto se desvanece hacia abajo).
  - Efectos horneados (hijos `.fx`, kit3.js los recorta a la forma del padre): `fx-half` (`.l` = hacia la izq.), `fx-burst`, `fx-burst2`, `fx-glow`, `fx-spark`, `fx-streak`, `fx-vign`.
  - Ventana: `win` + cabecera `win-head h-pink|h-blue|h-green|h-gold` (weld + brillo + rayas diagonales).
  - Texto: `txt` + `t-xl|lg|md|sm|xs` (+ `it` cursiva, `left/right`, `strike`); degradado con `data-grad="#fff,#ffd23a"`.
- v1/v2 (`kit.css`, `kit2.css`, `shop.html`, `shop2.html`) quedan como histórico.

## Archivos
- `kit.css` — estilo "simulator": contorno grueso `#1b1030`, degradados saturados, brillo superior, labio inferior. Clases: `btn-sq sq-*`, `btn-green`, `btn-red`, `panel-body`, `header-orange`, `card-red`, `card-gold`, `rar-*`, `slot-*`, `txt*`.
- `icons.js` — iconos SVG cartoon (`data-icon="basket|gift|gear|trade|rebirth|invite|cash|box|coin|close"`). Añadir nuevos en `ICONS`.
- `shop.html` — pantalla de ejemplo (HUD + Shop). Stage 1280x720.
- `export.mjs` — exportador. `shot.mjs` — captura cualquier HTML a PNG.

## Marcado
| atributo | efecto |
|---|---|
| `data-rbx-root data-name="X"` | raíz → `ScreenGui` X |
| `data-rbx="frame"` | Frame transparente (solo layout) |
| `data-rbx="image"` | ImageLabel con PNG de SU arte (hijos data-rbx excluidos). Nombre acabado en `Button` → ImageButton |
| `data-rbx="text"` | TextLabel: FontFace según CSS + UIStroke + clon sombra (`drop-shadow`) + UIGradient (`data-grad`) + Rotation (`transform`) + RichText `<s>` (`strike`) |
| `<img data-rbx="image">` | se sube el PNG original (sin re-rasterizar), dedupe por archivo; su `drop-shadow` => ImageLabel sombra teñida |
| `data-name` | Name de la Instance |
| `data-pad="N"` | px extra alrededor para sombras/labios que salen del rect |

## Uso
```
node rbxui/export.mjs rbxui/shop.html --shot   # solo design.png (iterar)
node rbxui/export.mjs rbxui/shop.html          # export completo -> rbxui/out/<Screen>/
node rbxui/shot.mjs rbxui/out/ShopScreen/compare.html out.png   # verificar recomposición
```
Salida: `img/*.png` (@2x, deduplicados, post-procesados por `postimg.py`: bleed anti-halo + tope 1024px), `uploads.json`, `layout.json`, `build.luau`, `compare.html`.

## Importar a Studio (probado en "Steal And Grow!", 2026-09-26)
1. `python -m http.server 8765 --bind 127.0.0.1` en `rbxui/out/` (background).
2. `python studio_sync.py plan ShopScreen DailyScreen` → lista de URLs que faltan (caché por **hash de contenido** en `out/asset_cache.json`; lo que no cambió no se resube).
3. `upload_image` con esas URLs (lotes de ~13) → guardar el JSON resultado en un archivo → `python studio_sync.py record <archivo>`.
4. `python studio_sync.py install ShopScreen DailyScreen` → `out/<Screen>/install.luau` (ids + build).
5. `execute_luau` (Edit): `HttpService.HttpEnabled` suele estar en false → ponerlo a true SOLO durante el `GetAsync`,
   ModuleScript temporal en ServerStorage con `Source = GetAsync(install.luau)`, `require`, destruirlo, **restaurar HttpEnabled**.
6. Captura limpia: guardar `Enabled` de las ScreenGuis del usuario, desactivarlas, aplicar escala de UIStroke a mano
   (`Base * AbsoluteSize.Y/720`), `screen_capture`, y RESTAURAR al final. Las pantallas nuevas quedan `Enabled=false`.
7. Runtime: copiar `runtime/RbxUIController.client.luau` a `out/runtime/` y en el mismo `execute_luau` crear/actualizar `StarterPlayer.StarterPlayerScripts.RbxUIController` (LocalScript) con `Source = GetAsync(...)`. Probar con `start_stop_play` + `user_mouse_input` (instance_path `LocalPlayer.PlayerGui...`) + `screen_capture` (sí funciona en Play).
8. Parar el servidor: `Get-NetTCPConnection -LocalPort 8765 | Stop-Process`.

### Lecciones de Roblox (ya resueltas en export.mjs)
- `Montserrat` en Roblox = `GothamSSm` (misma métrica). Heavy existe. A igual TextSize los glifos salen ~14% más pequeños
  que en Chrome → el exportador agranda las cajas de texto ×1.14 (alto) y ×1.25 (ancho).
- `UIStroke.Thickness` y offsets van en píxeles fijos → sombras en escala + LocalScript `UIScaler` que multiplica
  el atributo `Base` de cada UIStroke por `AbsoluteSize.Y / 720`. En edición no corre: aplicarlo a mano antes de capturar.
- Opacidad de iconos → `ImageTransparency` (y su sombra se atenúa igual).
