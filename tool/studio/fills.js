/* RbxUI — rellenos de Figma con imagen (texturas) -> Instances de Roblox. Compartido: importador (node) y editor (window.RBXFills).

   Roblox no tiene modos de fusión. Una pintura de imagen se convierte en 1-2 ImageLabel con PNG de máscara SIN color
   (blancos con alfa), reutilizables por todas las piezas; el color va aparte:
     NORMAL            -> 'orig'        la imagen tal cual (con sus ajustes)
     OVERLAY/SOFT/HARD -> 'hi' + 'lo'   luces (alfa = 2·lum-1) y sombras (alfa = 1-2·lum), teñidas con blend(C,1) y blend(C,0)
     MULTIPLY/…        -> 'inv'         negro con alfa 1-lum            SCREEN/… -> 'lum'  blanco con alfa lum
   Overlay y Soft light son lineales en la capa de arriba dentro de cada mitad, así que sobre un color C el tinte es exacto;
   si debajo hay un degradado lineal, el tinte es un UIGradient con blend(color del degradado, 1 ó 0).
   % de la pintura -> ImageTransparency · mosaico -> ScaleType Tile + TileSize · recorte -> máscara recortada (compartida).

   La receta de Figma viaja en attributes.FigmaSpec (JSON) de cada capa: el editor la edita y pide las máscaras al servidor. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RBXFills = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GROUP = { NORMAL: null, PASS_THROUGH: null, OVERLAY: 'split2', HARD_LIGHT: 'split2', SOFT_LIGHT: 'split1', MULTIPLY: 'dark', DARKEN: 'dark',
    LINEAR_BURN: 'dark', COLOR_BURN: 'dark', SCREEN: 'light', LIGHTEN: 'light', LINEAR_DODGE: 'light', COLOR_DODGE: 'light', DIFFERENCE: 'split2',
    EXCLUSION: 'split1', HUE: 'split1', SATURATION: 'split1', COLOR: 'split1', LUMINOSITY: 'split2' };
  const BLENDS = [['NORMAL', 'Normal'], ['OVERLAY', 'Overlay'], ['SOFT_LIGHT', 'Soft light'], ['HARD_LIGHT', 'Hard light'], ['MULTIPLY', 'Multiply'],
    ['DARKEN', 'Darken'], ['COLOR_BURN', 'Color burn'], ['SCREEN', 'Screen'], ['LIGHTEN', 'Lighten'], ['COLOR_DODGE', 'Color dodge']];
  const groupOf = (blend) => (blend && blend in GROUP ? GROUP[blend] : blend ? 'split2' : null);
  const kindsOf = (blend) => ({ split2: ['hi', 'lo'], split1: ['hi', 'lo'], dark: ['inv'], light: ['lum'] }[groupOf(blend)] || ['orig']);
  const PART_NAME = { hi: ' Light', lo: ' Shade', inv: ' Shade', lum: ' Light', orig: '' };

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
  const toHex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fromHex = (h) => { const s = String(h || '#FFFFFF').replace('#', ''); return { r: parseInt(s.slice(0, 2), 16) / 255, g: parseInt(s.slice(2, 4), 16) / 255, b: parseInt(s.slice(4, 6), 16) / 255 }; };

  // blend(C, T) por canal (W3C / Figma)
  const softD = (C) => (C <= 0.25 ? ((16 * C - 12) * C + 4) * C : Math.sqrt(C));
  const CH = { split2: (C, T) => (C < 0.5 ? 2 * C * T : 1 - 2 * (1 - C) * (1 - T)),
    split1: (C, T) => (T <= 0.5 ? C - (1 - 2 * T) * C * (1 - C) : C + (2 * T - 1) * (softD(C) - C)),
    dark: (C, T) => C * T, light: (C, T) => 1 - (1 - C) * (1 - T) };
  const blendRgb = (group, B, T) => { const f = CH[group] || CH.split2; return { r: clamp01(f(B.r, T.r)), g: clamp01(f(B.g, T.g)), b: clamp01(f(B.b, T.b)) }; };

  // ajustes de imagen (Figma: exposición, contraste, saturación) -> filtro CSS
  function filterCss(f) {
    if (!f) return '';
    let s = '';
    if (f.exposure) s += `brightness(${r4(Math.pow(2, f.exposure))}) `;
    if (f.contrast) s += `contrast(${r4(1 + f.contrast)}) `;
    if (f.saturation) s += `saturate(${r4(1 + f.saturation)}) `;
    return s.trim();
  }

  // lo que queda DEBAJO de las texturas: el fondo del propio nodo (BackgroundColor3 × UIGradient, como pinta Roblox)
  //   -> { solid: rgb } | { grad: { stops: [[t, rgb]], rot } } | null (desconocido: transparente)
  function baseOf(props, mods) {
    props = props || {};
    if ((+props.BackgroundTransparency || 0) > 0.5) return null;
    const bg = fromHex(props.BackgroundColor3 || '#A3A2A5');
    const g = (mods || []).find((m) => m.ClassName === 'UIGradient' && (m.props || {}).Enabled !== false);
    const seq = g && g.props && g.props.Color;
    if (Array.isArray(seq) && seq.length) {
      const stops = seq.map(([t, h]) => { const c = fromHex(h); return [t, { r: c.r * bg.r, g: c.g * bg.g, b: c.b * bg.b }]; });
      return { grad: { stops, rot: +(g.props.Rotation || 0) } };
    }
    if (typeof seq === 'string') { const c = fromHex(seq); return { solid: { r: c.r * bg.r, g: c.g * bg.g, b: c.b * bg.b } }; }
    return { solid: bg };
  }
  const sample = (stops, t) => {
    let j = 0; while (j < stops.length - 2 && stops[j + 1][0] < t) j++;
    const [t0, a] = stops[j], [t1, b] = stops[Math.min(j + 1, stops.length - 1)], u = t1 > t0 ? clamp01((t - t0) / (t1 - t0)) : 0;
    return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
  };
  // tinte de una parte: { color, gradient (props de UIGradient) | null }
  function tintFor(blend, kind, base) {
    if (kind === 'orig' || kind === 'lum') return { color: '#FFFFFF', gradient: null };
    if (kind === 'inv') return { color: '#000000', gradient: null };
    const T = kind === 'hi' ? 1 : 0, g = groupOf(blend) || 'split2', TT = { r: T, g: T, b: T };
    if (!base) return { color: T ? '#FFFFFF' : '#000000', gradient: null };
    if (base.solid) return { color: toHex(blendRgb(g, base.solid, TT)), gradient: null };
    const N = 10, col = [];
    for (let i = 0; i <= N; i++) col.push([r4(i / N), toHex(blendRgb(g, sample(base.grad.stops, i / N), TT))]);
    return { color: '#FFFFFF', gradient: { Color: col, Rotation: base.grad.rot } };
  }

  // color T con fusión encima del fondo -> { color, gradient } (null = fondo desconocido)
  function blendOver(blend, base, T) {
    const g = groupOf(blend), t = typeof T === 'string' ? fromHex(T) : T;
    if (!g) return { color: toHex(t), gradient: null };
    if (!base) return null;
    if (base.solid) return { color: toHex(blendRgb(g, base.solid, t)), gradient: null };
    const N = 10, col = [];
    for (let i = 0; i <= N; i++) col.push([r4(i / N), toHex(blendRgb(g, sample(base.grad.stops, i / N), t))]);
    return { color: '#FFFFFF', gradient: { Color: col, Rotation: base.grad.rot } };
  }
  // capas de una pintura. spec = receta de Figma; masks = { kind: ruta PNG }; corner = UICorner del nodo (o null)
  //   spec: { fill, paint, blend, src, srcW, srcH, mode:'Tile'|'Stretch'|'Crop'|'Fit', scale, k, crop:[x,y,w,h]|null, opacity, filter, mirror }
  function layersFor(spec, masks, base, corner) {
    const kinds = kindsOf(spec.blend);
    return kinds.map((kind) => {
      const t = tintFor(spec.blend, kind, base);
      const props = { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: masks[kind], ScaleType: spec.mode || 'Stretch' };
      if (spec.mode === 'Tile') props.TileSize = [0, r2((spec.srcW || 64) * (spec.scale || 1) * (spec.k || 1)), 0, r2((spec.srcH || 64) * (spec.scale || 1) * (spec.k || 1))];
      if (t.color !== '#FFFFFF') props.ImageColor3 = t.color;
      const op = spec.opacity == null ? 1 : spec.opacity;
      if (op < 0.999) props.ImageTransparency = r4(1 - op);
      const children = [];
      if (corner) children.push(JSON.parse(JSON.stringify(corner)));
      if (t.gradient) children.push({ ClassName: 'UIGradient', Name: 'UIGradient', props: t.gradient });
      const blend = spec.blend && spec.blend !== 'NORMAL' ? { FigmaBlend: spec.blend } : {};
      return { ClassName: 'ImageLabel', Name: (spec.paint || 'Image') + PART_NAME[kind], props, ...(children.length ? { children } : {}),
        attributes: { FigmaFill: spec.fill, FigmaPaint: spec.paint || 'Image', ...blend, FigmaPart: kind, FigmaSpec: JSON.stringify(spec) } };
    });
  }
  const specOf = (node) => { try { return JSON.parse((node.attributes || {}).FigmaSpec || 'null'); } catch { return null; } };

  const strokeOf = (st) => { try { return JSON.parse((st && st.attributes || {}).FigmaStroke || 'null'); } catch { return null; } };
  return { GROUP, BLENDS, groupOf, kindsOf, blendRgb, filterCss, baseOf, tintFor, blendOver, layersFor, specOf, strokeOf, toHex, fromHex };
});
