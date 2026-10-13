# Fig — editor con el modelo de Figma

Fig (`http://localhost:5170/fig/`) es un editor de diseño cuyo documento **es** el de Figma: cada capa guarda los campos
de Figma tal cual (los mismos del formato binario kiwi que usan el portapapeles y los `.fig`). Por eso lo que copias de
Figma, editas aquí y vuelves a pegar en Figma llega sin perder nada, aunque Fig no entienda algún campo.

## Pasar diseños entre Figma y Fig

| Quieres… | Haz… |
|---|---|
| Traer capas de Figma | Ctrl+C en Figma → Ctrl+V en Fig (imágenes y textos incluidos) |
| Traer un archivo entero | Figma: Archivo › Guardar copia local (`.fig`) → arrástralo a Fig |
| Llevar capas a Figma | Ctrl+C en Fig (o «Copiar para Figma») → Ctrl+V en Figma |
| Llevar un documento entero | Menú › «Descargar .fig» → arrástralo a la pantalla de archivos de Figma |

Los textos creados o editados en Fig se pegan en Figma con sus glifos ya maquetados (Figma no maqueta los textos
pegados que no los traen). Las imágenes viajan dentro del portapapeles.

## Fidelidad

El render usa lo que Figma ya calculó cuando viene en el documento (geometría exacta, esquinas suavizadas, glifos de los
textos) y las fórmulas del renderer de Figma para fusiones, ajustes de imagen, desenfoques, sombras y ruido
(`studio/figfx.js`). Comparado con el export de Figma (`exportAsync`) píxel a píxel:

| Prueba | Error medio por canal |
|---|---|
| Ventanas con studs (Overlay, máscaras, sombras interiores) | 1,1 / 255 |
| Botones con resplandor y studs | 0,8 / 255 |
| Frame pegado desde Figma | 0,8 / 255 |
| Botones creados en Fig por un plugin, pegados en Figma | 1,0 / 255 |

Detalles del formato que importan (y que Fig respeta): un grupo de Figma es un FRAME con `resizeToFit` (no recorta);
`strokeGeometry` es una banda de 2× el grosor centrada en el borde que se recorta según la alineación; las sombras por
defecto no se ven detrás de la forma (`showShadowBehindNode`); el Soft light de Figma no es el de CSS.

## Rendimiento

Cada capa auxiliar (opacidad, fusión, efectos, máscaras) mide lo que ocupa el nodo más sus sombras y desenfoques, no la vista
entera, y lo que cae fuera de la vista no se pinta. La geometría se guarda por forma, así que mover o recolorear no la rehace.
Pasar el ratón por encima solo repinta el overlay sobre la página ya pintada.

| Documento (lienzo 1420×897) | Antes | Ahora |
|---|---|---|
| Ventanas con studs (32 capas con efectos, 4 máscaras) | 270–530 ms | 15–40 ms |
| Botones con resplandor | 40–170 ms | 12–20 ms |

## Editar

Herramientas: mover (V), frame (F/A), rectángulo (R), elipse (O), línea (L), pluma (P), texto (T), mano (H / espacio).
Selección como en Figma: clic = capa de primer nivel dentro del frame, Ctrl+clic = la más profunda, doble clic = entrar,
Enter / Shift+Enter = hijos / padre, Esc = salir. Arrastrar con guías, soltar sobre otro frame para meterlo dentro
(o reordenar en un auto layout), Alt+arrastrar duplica, Shift bloquea el eje.

Atajos: Ctrl+Z / Ctrl+Shift+Z, Ctrl+C / X / V / D, Ctrl+G (agrupar), Ctrl+Shift+G (desagrupar), Ctrl+Alt+G (frame),
Shift+A (auto layout), Ctrl+[ / ] (orden), Ctrl+Shift+H (ocultar), Ctrl+Shift+L (bloquear), Ctrl+R (renombrar),
Shift+1 / Shift+2 (ver todo / la selección), Ctrl+0 (100 %), Ctrl+S (guardar; también se guarda solo).

Propiedades: posición, tamaño, giro, radios (también por esquina), recorte, auto layout (dirección, wrap, alineación,
espacio, repartir, padding, abrazar / fijo; en los hijos rellenar, fijo, posición absoluta), fusión y opacidad de capa,
texto (fuente, estilo, tamaño, interlineado, espaciado, alineaciones, redimensionado, decoración, mayúsculas), rellenos
y bordes (sólido, lineal con ángulo y paradas, radial, angular, diamante, imagen con modo y ajustes), efectos (sombra,
sombra interior, desenfoque, desenfoque de fondo) y exportar a PNG.

## Plugins

Fig ejecuta plugins de Figma (la API `figma.*`): menú › Plugins. Para instalar uno, «Instalar plugin…» y elige la
carpeta que tenga su `manifest.json` (con `main` ya compilado a JavaScript y, si tiene, `ui`). Se incluyen dos de
ejemplo en `fig/sample-plugins/` (Generador de botones, Colores de la selección), que también funcionan en Figma.

La API cubre nodos y sus propiedades (incluidas auto layout y texto), crear y buscar nodos, selección, páginas,
viewport, fuentes, imágenes, `clientStorage`, `pluginData`, `notify`, eventos (`selectionchange`, `currentpagechange`,
`close`, `run`) y `exportAsync`. Los cambios de un mismo tick son un único paso de deshacer.

## Lo que todavía no hace

Componentes e instancias (se importan como frames), operaciones booleanas nuevas, edición de puntos de vectores ya
existentes, variables y estilos, prototipos, comentarios, colaboración en tiempo real e historial de versiones.
Background blur se pinta, pero sin la escarcha del Glass.

## Archivos

`fig/` (editor: `render.js`, `layout.js`, `model.js`, `app.js`, `panels.js`, `plugins.js`), `studio/figdoc.mjs`
(importar / exportar), `studio/figtext.mjs` (glifos), `studio/figkiwi.mjs` (formato kiwi), `studio/figfx.js`
(fórmulas del renderer). Documentos en `out/fig/docs/`, imágenes en `out/fig/images/`, plugins en `out/fig/plugins/`.
