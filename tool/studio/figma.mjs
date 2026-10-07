// Figma -> rbxui (Instances nativas). Entrada: el portapapeles de Figma (Ctrl+C en Figma -> text/html) o un .fig.
//   Frame / Rectángulo / Elipse / Grupo / Componente / Instancia -> Frame (+UICorner, UIStroke, UIGradient)
//   Texto -> TextLabel (FontFace, color, alineación, contorno, estilos mezclados con RichText)
//   Vectores e iconos (frames solo con vectores) -> SVG -> PNG (assets/figma/<sha1>.png) -> ImageLabel
//   Imágenes: en un .fig vienen dentro (assets/figma/); en el portapapeles solo llega el hash -> hueco "figma-image:<hash>"
//   Sombra paralela -> copia desplazada detrás (Roblox no tiene sombras). Auto layout: se respetan las posiciones ya resueltas.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { decodeFig, parseClipboardHtml } from './figkiwi.mjs';

const require = createRequire(import.meta.url);
const RJ = require('./rbxjson.js');
const FL = require('./fills.js');
const { DATA: ROOT } = require('./paths.cjs');   // imágenes y caché van a los datos del usuario
const IMG_DIR = path.join(ROOT, 'assets', 'figma');
export const IMG_REL = 'assets/figma';

// ---------------------------------------------------------------- utilidades
const key = (g) => (g ? `${g.sessionID}:${g.localID}` : '');
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
const VECTORISH = new Set(['VECTOR', 'STAR', 'REGULAR_POLYGON', 'LINE', 'BOOLEAN_OPERATION']);
const SHAPES = new Set(['RECTANGLE', 'ROUNDED_RECTANGLE', 'ELLIPSE']);
const CONTAINERS = new Set(['FRAME', 'GROUP', 'SYMBOL', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION']);
const SKIP = new Set(['DOCUMENT', 'CANVAS', 'SLICE', 'CONNECTOR', 'STICKY', 'SHAPE_WITH_TEXT', 'CODE_BLOCK', 'STAMP', 'WIDGET', 'EMBED', 'LINK_UNFURL', 'MEDIA', 'TABLE', 'TABLE_CELL', 'WASHI_TAPE', 'HIGHLIGHT']);
const BUTTON_RE = /(^|[\s_\-./])(button|btn|boton|botón)([\s_\-./]|$)|button$|btn$/i;

function invert(t) {
  const d = t.m00 * t.m11 - t.m01 * t.m10 || 1e-9;
  return { m00: t.m11 / d, m01: -t.m01 / d, m02: (t.m01 * t.m12 - t.m11 * t.m02) / d,
    m10: -t.m10 / d, m11: t.m00 / d, m12: (t.m10 * t.m02 - t.m00 * t.m12) / d };
}
const apply = (t, x, y) => ({ x: t.m00 * x + t.m01 * y + t.m02, y: t.m10 * x + t.m11 * y + t.m12 });
const mul = (A, B) => ({ m00: A.m00 * B.m00 + A.m01 * B.m10, m01: A.m00 * B.m01 + A.m01 * B.m11, m02: A.m00 * B.m02 + A.m01 * B.m12 + A.m02,
  m10: A.m10 * B.m00 + A.m11 * B.m10, m11: A.m10 * B.m01 + A.m11 * B.m11, m12: A.m10 * B.m02 + A.m11 * B.m12 + A.m12 });
// trazado SVG (M/L/C/Q/Z absolutos, como los que generamos) transformado por una matriz afín (las Bézier se transforman exactas)
function transformPath(d, T) {
  return String(d || '').replace(/([MLCQ])([^MLCQZ]*)/g, (all, cmd, nums) => {
    const v = nums.trim().split(/[\s,]+/).filter(Boolean).map(Number), out = [];
    for (let i = 0; i + 1 < v.length; i += 2) { const q = apply(T, v[i], v[i + 1]); out.push(r2(q.x), r2(q.y)); }
    return cmd + out.join(' ');
  });
}
const KAPPA = 0.5523;
function rrectPath(w, h, rs) {             // rs = [sup-izq, sup-der, inf-der, inf-izq]
  const [tl, tr, br, bl] = rs.map((r) => Math.max(0, Math.min(r || 0, w / 2, h / 2)));
  const C = (a, b, c2, d2, e, f) => `C${r2(a)} ${r2(b)} ${r2(c2)} ${r2(d2)} ${r2(e)} ${r2(f)}`;
  return `M${r2(tl)} 0L${r2(w - tr)} 0` + (tr ? C(w - tr + tr * KAPPA, 0, w, tr - tr * KAPPA, w, tr) : '')
    + `L${r2(w)} ${r2(h - br)}` + (br ? C(w, h - br + br * KAPPA, w - br + br * KAPPA, h, w - br, h) : '')
    + `L${r2(bl)} ${r2(h)}` + (bl ? C(bl - bl * KAPPA, h, 0, h - bl + bl * KAPPA, 0, h - bl) : '')
    + `L0 ${r2(tl)}` + (tl ? C(0, tl - tl * KAPPA, tl - tl * KAPPA, 0, tl, 0) : '') + 'Z';
}
function ellipsePath(w, h) {
  const a = w / 2, b = h / 2, C = (x1, y1, x2, y2, x, y) => `C${r2(x1)} ${r2(y1)} ${r2(x2)} ${r2(y2)} ${r2(x)} ${r2(y)}`;
  return `M${r2(a)} 0` + C(a + a * KAPPA, 0, w, b - b * KAPPA, w, b) + C(w, b + b * KAPPA, a + a * KAPPA, h, a, h)
    + C(a - a * KAPPA, h, 0, b + b * KAPPA, 0, b) + C(0, b - b * KAPPA, a - a * KAPPA, 0, a, 0) + 'Z';
}
const visiblePaints = (ps) => (ps || []).filter((p) => p.visible !== false && (p.opacity ?? 1) > 0.001);
const dashAttr = (c) => (c.dashPattern?.length ? ` stroke-dasharray="${c.dashPattern.map((v) => Math.round(v * 100) / 100).join(' ')}"` : '');
// grosor de borde por lado [arriba, derecha, abajo, izquierda] si son distintos (si no, null)
function sideWeights(c) {
  if (!c.borderStrokeWeightsIndependent) return null;
  const w = [c.borderTopWeight, c.borderRightWeight, c.borderBottomWeight, c.borderLeftWeight].map((x) => x ?? c.strokeWeight ?? 0);
  return Math.max(...w) - Math.min(...w) > 0.01 ? w : null;
}

// posición sin rotar (esquina) + rotación alrededor del centro, como Roblox
// con espejo (determinante < 0) la matriz es R(θ)·escala(-1,1): volteo horizontal + rotación (un volteo vertical = horizontal + 180°)
function local(c) {
  const t = c.transform || ID, w = c.size?.x || 0, h = c.size?.y || 0;
  const cx = t.m02 + t.m00 * w / 2 + t.m01 * h / 2, cy = t.m12 + t.m10 * w / 2 + t.m11 * h / 2;
  const flip = t.m00 * t.m11 - t.m01 * t.m10 < 0;
  const rot = (flip ? Math.atan2(-t.m10, -t.m00) : Math.atan2(t.m10, t.m00)) * 180 / Math.PI;
  return { x: cx - w / 2, y: cy - h / 2, w, h, rot: Math.abs(rot) < 0.01 ? 0 : rot, flip };
}

// ---------------------------------------------------------------- árbol
function buildTree(message) {
  const map = new Map();
  for (const c of message.nodeChanges || []) if (c.phase !== 'REMOVED' && c.guid) map.set(key(c.guid), { c, kids: [], parent: null });
  for (const n of map.values()) {
    const p = map.get(key(n.c.parentIndex?.guid));
    if (p) { p.kids.push(n); n.parent = p; }
  }
  for (const n of map.values()) n.kids.sort((a, b) => ((a.c.parentIndex?.position || '') < (b.c.parentIndex?.position || '') ? -1 : 1));
  return map;
}
const cloneNode = (n, parent = null) => { const m = { c: structuredClone(n.c), kids: [], parent }; m.kids = n.kids.map((k) => cloneNode(k, m)); return m; };

// instancias sin hijos: se copian los hijos del componente maestro y se aplican overrides / derivedSymbolData
function resolveInstances(map, warn) {
  const symbols = new Map();
  for (const n of map.values()) if (n.c.type === 'SYMBOL' || n.c.type === 'COMPONENT') symbols.set(key(n.c.guid), n);
  const resolve = (inst, depth = 0) => {
    if (depth > 12) return;
    const sd = inst.c.symbolData;
    if (inst.c.type === 'INSTANCE' && !inst.kids.length && sd?.symbolID) {
      const master = symbols.get(key(sd.symbolID));
      if (!master) { warn.add(`Instancia "${inst.c.name}": su componente no viene en lo copiado (se pega vacía)`); return; }
      inst.kids = master.kids.map((k) => cloneNode(k, inst));
      const idx = new Map();
      const index = (n) => { idx.set(key(n.c.guid), n); if (n.c.overrideKey) idx.set(key(n.c.overrideKey), n); n.kids.forEach(index); };
      inst.kids.forEach(index);
      const find = (gp) => { const gs = gp?.guids || []; return gs.length ? idx.get(key(gs[gs.length - 1])) : null; };
      for (const d of inst.c.derivedSymbolData || []) {
        const t = find(d.guidPath); if (!t) continue;
        if (d.size) t.c.size = d.size;
        if (d.transform) t.c.transform = d.transform;
      }
      for (const o of sd.symbolOverrides || []) {
        const t = find(o.guidPath); if (!t) continue;
        for (const [k, v] of Object.entries(o)) if (k !== 'guidPath') t.c[k] = v;
        if (o.overriddenSymbolID && t.c.type === 'INSTANCE') { t.kids = []; t.c.symbolData = { ...(t.c.symbolData || {}), symbolID: o.overriddenSymbolID }; }
      }
    }
    for (const k of inst.kids) resolve(k, depth + 1);
  };
  for (const n of map.values()) if (!n.parent || n.parent.c.type === 'CANVAS') resolve(n);
}

// ¿los hijos de un grupo están en su espacio o en el del padre? (depende de la versión del formato)
function kidsInOwnSpace(n) {
  const w = n.c.size?.x || 0, h = n.c.size?.y || 0;
  if (!n.kids.length) return true;
  return n.kids.every((k) => { const g = local(k.c); return g.x >= -1.5 && g.y >= -1.5 && g.x + g.w <= w + 1.5 && g.y + g.h <= h + 1.5; });
}

// ---------------------------------------------------------------- pinturas
function linearHandles(p) {
  const inv = invert(p.transform || ID);
  return { a: apply(inv, 0, 0.5), b: apply(inv, 1, 0.5) };
}
// pintura lineal -> UIGradient (Color/Transparency/Rotation), colores multiplicados sobre blanco
function uiGradient(p, extraAlpha = 1) {
  const { a, b } = linearHandles(p);
  let dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  const proj = (x, y) => x * dx + y * dy;
  const cs = [proj(0, 0), proj(1, 0), proj(0, 1), proj(1, 1)];
  const pmin = Math.min(...cs), pmax = Math.max(...cs), p0 = proj(a.x, a.y), p1 = proj(b.x, b.y);
  const stops = (p.stops || []).map((s) => ({ t: clamp01((p0 + s.position * (p1 - p0) - pmin) / ((pmax - pmin) || 1)), c: s.color }))
    .sort((x, y) => x.t - y.t);
  if (!stops.length) return null;
  // parada casi en el borde -> al borde (si no, Roblox/el editor ven dos paradas del mismo color y editar «Inicio» no cambia nada)
  if (stops[0].t < 0.03) stops[0].t = 0; else stops.unshift({ ...stops[0], t: 0 });
  if (stops[stops.length - 1].t > 0.97) stops[stops.length - 1].t = 1; else stops.push({ ...stops[stops.length - 1], t: 1 });
  const uniq = [];
  for (const s of stops) { if (uniq.length && s.t - uniq[uniq.length - 1].t < 0.001) { if (s.t === 1) uniq[uniq.length - 1] = s; continue; } uniq.push(s); }
  if (uniq.length === 1) uniq.push({ ...uniq[0], t: 1 });
  uniq[0].t = 0; uniq[uniq.length - 1].t = 1;
  const pick = uniq.length > 20 ? uniq.filter((_, i) => i % Math.ceil(uniq.length / 20) === 0 || i === uniq.length - 1) : uniq;
  const op = (p.opacity ?? 1) * extraAlpha;
  const tr = pick.map((s) => [r4(s.t), r4(1 - clamp01((s.c.a ?? 1) * op))]);
  const props = { Color: pick.map((s) => [r4(s.t), hex(s.c)]), Rotation: r2(Math.atan2(dy, dx) * 180 / Math.PI) };
  if (tr.some((x) => x[1] > 0.001)) props.Transparency = tr;
  return { ClassName: 'UIGradient', Name: 'UIGradient', props };
}
const avgColor = (p) => { const s = p.stops || []; if (!s.length) return { r: 1, g: 1, b: 1, a: 1 }; const m = (k) => s.reduce((t, x) => t + x.color[k], 0) / s.length; return { r: m('r'), g: m('g'), b: m('b'), a: m('a') }; };
const rgbaCss = (c, a = 1) => `rgba(${Math.round(clamp01(c.r) * 255)},${Math.round(clamp01(c.g) * 255)},${Math.round(clamp01(c.b) * 255)},${r4(clamp01((c.a ?? 1) * a))})`;
const BLEND = { MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay', DARKEN: 'darken', LIGHTEN: 'lighten', COLOR_DODGE: 'color-dodge',
  COLOR_BURN: 'color-burn', HARD_LIGHT: 'hard-light', SOFT_LIGHT: 'soft-light', DIFFERENCE: 'difference', EXCLUSION: 'exclusion', HUE: 'hue',
  SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity', LINEAR_BURN: 'multiply', LINEAR_DODGE: 'plus-lighter' };
const isIdentity = (t) => !t || (Math.abs(t.m00 - 1) < 1e-3 && Math.abs(t.m11 - 1) < 1e-3 && Math.abs(t.m01) < 1e-3 && Math.abs(t.m10) < 1e-3 && Math.abs(t.m02) < 1e-3 && Math.abs(t.m12) < 1e-3);
export const imageHashes = (message) => {
  const out = new Set();
  for (const c of message.nodeChanges || []) for (const p of [...(c.fillPaints || []), ...(c.strokePaints || [])]) if (p.image?.hash) out.add(Buffer.from(p.image.hash).toString('hex'));
  return out;
};
// tamaño de un PNG / JPEG
export function imageDims(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), mime: 'image/png', ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), mime: 'image/jpeg', ext: 'jpg' };
      i += 2 + len;
    }
    return { w: 0, h: 0, mime: 'image/jpeg', ext: 'jpg' };
  }
  if (b.slice(0, 4).toString() === 'RIFF') return { w: 0, h: 0, mime: 'image/webp', ext: 'webp' };
  return { w: 0, h: 0, mime: 'image/png', ext: 'png' };
}

// una pintura de Figma como capa CSS (para hornear piezas con fusiones / texturas)
// ajustes de imagen de Figma (exposición, contraste, saturación) -> filtro CSS
function imgFilterCss(f) {
  if (!f) return '';
  let filt = '';
  if (f.exposure) filt += `brightness(${r4(Math.pow(2, f.exposure))}) `;
  if (f.contrast) filt += `contrast(${r4(1 + f.contrast)}) `;
  if (f.saturation) filt += `saturate(${r4(1 + f.saturation)}) `;
  return filt.trim();
}
function cssPaint(p, W, H, s, images, urlFn) {
  let bg = '', filt = '', inner = '';
  if (p.type === 'SOLID') bg = rgbaCss(p.color);
  else if (p.type === 'GRADIENT_LINEAR') {
    const { a, b } = linearHandles(p);
    const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H;
    let dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const proj = (x, y) => x * dx + y * dy, cs = [proj(0, 0), proj(W, 0), proj(0, H), proj(W, H)];
    const pmin = Math.min(...cs), pmax = Math.max(...cs), p0 = proj(ax, ay), p1 = proj(bx, by);
    const st = (p.stops || []).map((x) => `${rgbaCss(x.color)} ${r2(((p0 + x.position * (p1 - p0) - pmin) / ((pmax - pmin) || 1)) * 100)}%`);
    bg = `linear-gradient(${r2(Math.atan2(dx, -dy) * 180 / Math.PI)}deg, ${st.join(', ')})`;
  } else if (p.type === 'GRADIENT_RADIAL' || p.type === 'GRADIENT_DIAMOND') {
    const inv = invert(p.transform || ID), c0 = apply(inv, 0.5, 0.5), e1 = apply(inv, 1, 0.5), e2 = apply(inv, 0.5, 1);
    const rx = Math.hypot((e1.x - c0.x) * W, (e1.y - c0.y) * H), ry = Math.hypot((e2.x - c0.x) * W, (e2.y - c0.y) * H);
    bg = `radial-gradient(${r2(rx)}px ${r2(ry)}px at ${r2(c0.x * W)}px ${r2(c0.y * H)}px, ${(p.stops || []).map((x) => `${rgbaCss(x.color)} ${r2(x.position * 100)}%`).join(', ')})`;
  } else if (p.type === 'GRADIENT_ANGULAR') {
    const inv = invert(p.transform || ID), c0 = apply(inv, 0.5, 0.5), e1 = apply(inv, 1, 0.5);
    const ang = Math.atan2((e1.y - c0.y) * H, (e1.x - c0.x) * W) * 180 / Math.PI + 90;
    bg = `conic-gradient(from ${r2(ang)}deg at ${r2(c0.x * W)}px ${r2(c0.y * H)}px, ${(p.stops || []).map((x) => `${rgbaCss(x.color)} ${r2(x.position * 100)}%`).join(', ')})`;
  } else if (p.type === 'IMAGE') {
    const hh = p.image?.hash ? Buffer.from(p.image.hash).toString('hex') : '';
    const bytes = hh && images && images.get(hh);
    if (!bytes) return null;
    const d = imageDims(Buffer.from(bytes));
    const url = urlFn ? `url('${urlFn(hh)}')` : `url('data:${d.mime};base64,${Buffer.from(bytes).toString('base64')}')`;
    const mode = p.imageScaleMode || 'FILL';
    if (mode === 'TILE') { const k = (p.scale || 1) * s; bg = `${url} 0 0/${r2((d.w || p.originalImageWidth || 64) * k)}px ${r2((d.h || p.originalImageHeight || 64) * k)}px repeat`; }
    else if (mode === 'FIT') bg = `${url} center/contain no-repeat`;
    else if ((mode === 'STRETCH' || mode === 'CROP') && !isIdentity(p.transform)) {
      // p.transform lleva UV del nodo -> UV de la imagen (puede recortar, rotar o ESPEJAR): la imagen se coloca con la inversa
      const iv = invert(p.transform), Wd = W || 1, Hd = H || 1;
      inner = `<div style="position:absolute;left:0;top:0;width:${r2(Wd)}px;height:${r2(Hd)}px;transform-origin:0 0;`
        + `transform:matrix(${r4(iv.m00)},${r4(iv.m10 * Hd / Wd)},${r4(iv.m01 * Wd / Hd)},${r4(iv.m11)},${r2(iv.m02 * Wd)},${r2(iv.m12 * Hd)});background:${url} 0 0/100% 100% no-repeat"></div>`;
    } else if (mode === 'STRETCH') bg = `${url} 0 0/100% 100% no-repeat`;
    else bg = `${url} center/cover no-repeat`;
    const f = p.paintFilter;
    if (f) {
      if (f.exposure) filt += `brightness(${r4(Math.pow(2, f.exposure))}) `;
      if (f.contrast) filt += `contrast(${r4(1 + f.contrast)}) `;
      if (f.saturation) filt += `saturate(${r4(1 + f.saturation)}) `;
    }
  } else if (p.type === 'NOISE') {
    const nid = 'np' + crypto.createHash('sha1').update(JSON.stringify([p.noiseType, p.density, p.noiseSize, p.color, W, H])).digest('hex').slice(0, 10);
    const F = fxFilter([{ type: 'NOISE', visible: true, noiseType: p.noiseType, density: p.density, noiseSize: p.noiseSize, color: p.color, opacity: 1 }], s, nid, W, H, { noiseOnly: true });
    return `<svg style="position:absolute;inset:0;${BLEND[p.blendMode] ? `mix-blend-mode:${BLEND[p.blendMode]};` : ''}${(p.opacity ?? 1) < 1 ? `opacity:${r4(p.opacity)};` : ''}" width="${r2(W)}" height="${r2(H)}">`
      + `<defs>${F.svg}</defs><rect width="100%" height="100%" fill="#fff" filter="url(#${F.svg.match(/id="([^"]+)"/)[1]})"/></svg>`;
  } else return null;
  const blend = BLEND[p.blendMode];
  const common = `${blend ? `mix-blend-mode:${blend};` : ''}${(p.opacity ?? 1) < 1 ? `opacity:${r4(p.opacity)};` : ''}${filt ? `filter:${filt};` : ''}`;
  if (inner) return `<div style="position:absolute;inset:0;overflow:hidden;${common}">${inner}</div>`;
  return `<div style="position:absolute;inset:0;background:${bg};${common}"></div>`;
}


// ---------------------------------------------------------------- red vectorial (vectorNetworkBlob)
// En el portapapeles los VECTOR suelen venir sin fillGeometry: solo la red editable.
//   u32 vértices, u32 segmentos, u32 regiones · vértice: flags u32, x f32, y f32 · segmento: flags, ini u32, tanIni f32×2, fin u32, tanFin f32×2
//   región: winding u32, nºlazos u32, por lazo: nº u32 + índices de segmento u32
export function networkPaths(bytes, sx = 1, sy = 1) {
  if (!bytes || bytes.length < 12) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  const u32 = () => { const v = dv.getUint32(i, true); i += 4; return v; }, f32 = () => { const v = dv.getFloat32(i, true); i += 4; return v; };
  const vc = u32(), sc = u32(), rc = u32();
  if (!vc || vc > 1e5 || sc > 1e5 || 12 + vc * 12 + sc * 28 > bytes.length) return null;
  const V = [], S = [];
  for (let k = 0; k < vc; k++) { u32(); V.push({ x: f32() * sx, y: f32() * sy }); }
  for (let k = 0; k < sc; k++) { u32(); const a = u32(), ax = f32() * sx, ay = f32() * sy, b = u32(), bx = f32() * sx, by = f32() * sy; if (a >= vc || b >= vc) return null; S.push({ a, b, ax, ay, bx, by }); }
  const P = (v) => `${r2(v.x)} ${r2(v.y)}`;
  // tramo desde el vértice "from" (el segmento puede estar guardado al revés)
  const step = (sg, from) => {
    const fwd = sg.a === from;
    const p0 = V[fwd ? sg.a : sg.b], p1 = V[fwd ? sg.b : sg.a];
    const t0 = fwd ? { x: sg.ax, y: sg.ay } : { x: sg.bx, y: sg.by }, t1 = fwd ? { x: sg.bx, y: sg.by } : { x: sg.ax, y: sg.ay };
    const curve = Math.abs(t0.x) + Math.abs(t0.y) + Math.abs(t1.x) + Math.abs(t1.y) > 1e-3;
    return { to: fwd ? sg.b : sg.a, d: curve ? `C${r2(p0.x + t0.x)} ${r2(p0.y + t0.y)} ${r2(p1.x + t1.x)} ${r2(p1.y + t1.y)} ${P(p1)}` : `L${P(p1)}` };
  };
  const fills = [];
  for (let r = 0; r < rc && i + 8 <= bytes.length; r++) {
    const wind = u32(), loops = u32();
    let d = '';
    for (let l = 0; l < loops && i + 4 <= bytes.length; l++) {
      const n = u32(), idx = [];
      for (let k = 0; k < n && i + 4 <= bytes.length; k++) idx.push(u32());
      const segs = idx.map((x) => S[x]).filter(Boolean);
      if (!segs.length) continue;
      // arranque: el vértice del primer segmento que no comparte el segundo
      let cur = segs.length > 1 && (segs[0].b === segs[1].a || segs[0].b === segs[1].b) ? segs[0].a : segs[0].b;
      d += `M${P(V[cur])}`;
      for (const sg of segs) { if (sg.a !== cur && sg.b !== cur) { cur = sg.a; d += `M${P(V[cur])}`; } const st = step(sg, cur); d += st.d; cur = st.to; }
      d += 'Z';
    }
    if (d) fills.push({ d, rule: wind === 1 ? 'evenodd' : 'nonzero' });
  }
  // todos los segmentos encadenados (para contornos de trazos abiertos)
  let open = '', cur = -1;
  for (const sg of S) { if (sg.a !== cur && sg.b !== cur) { cur = sg.a; open += `M${P(V[cur])}`; } const st = step(sg, cur); open += st.d; cur = st.to; }
  return { fills, open };
}

// ---------------------------------------------------------------- efectos de Figma -> filtro SVG
// Vale para <g filter="url(#id)"> dentro de un SVG y para filter:url(#id) sobre HTML (Chrome). k = escala.
// Drop/Inner shadow, Layer blur (FOREGROUND_BLUR), Noise, Texture (GRAIN) y Glass. Background blur no existe en Roblox.
const FE_BLEND = { MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay', DARKEN: 'darken', LIGHTEN: 'lighten', COLOR_DODGE: 'color-dodge',
  COLOR_BURN: 'color-burn', HARD_LIGHT: 'hard-light', SOFT_LIGHT: 'soft-light', DIFFERENCE: 'difference', EXCLUSION: 'exclusion', HUE: 'hue',
  SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity', LINEAR_BURN: 'multiply', LINEAR_DODGE: 'screen' };
export function fxFilter(effects, k, id, w, h, opts = {}) {
  const es = (effects || []).filter((e) => e.visible !== false);
  const warns = [];
  let f = '', n = 0, pad = 0, cur = 'SourceGraphic', used = false, noiseRes = null;
  const R = () => `${id}_${n++}`;
  const col = (e, a) => { const c = e || { r: 0, g: 0, b: 0, a: 0.25 }; return `flood-color="${hex(c)}" flood-opacity="${r4(clamp01((c.a ?? 1) * (a ?? 1)))}"`; };
  // Texture (GRAIN): deforma bordes con ruido
  for (const e of es.filter((x) => x.type === 'GRAIN')) {
    const sz = Math.max(0.5, (e.noiseSize?.x || 2) * k), amt = Math.max(0.5, (e.radius || 2) * k), t = R(), o = R();
    f += `<feTurbulence type="fractalNoise" baseFrequency="${r4(0.5 / sz)}" numOctaves="2" seed="${e.seed || 0}" result="${t}"/>`
      + `<feDisplacementMap in="${cur}" in2="${t}" scale="${r2(amt * 2)}" xChannelSelector="R" yChannelSelector="G" result="${o}"/>`;
    cur = o; used = true;
    if (e.clipToShape) { const c2 = R(); f += `<feComposite in="${cur}" in2="SourceAlpha" operator="in" result="${c2}"/>`; cur = c2; } else pad = Math.max(pad, amt + 1);
  }
  const A = R();
  f += `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="${A}"/>`;
  const grow = (src, sp) => { if (Math.abs(sp) < 0.01) return src; const m = R(); f += `<feMorphology in="${src}" operator="${sp > 0 ? 'dilate' : 'erode'}" radius="${r2(Math.abs(sp))}" result="${m}"/>`; return m; };
  const behind = [];
  for (const e of es.filter((x) => x.type === 'DROP_SHADOW')) {
    const sp = (e.spread || 0) * k, bl = (e.radius || 0) * k, ox = (e.offset?.x || 0) * k, oy = (e.offset?.y || 0) * k;
    const src = grow(A, sp), b = R(), o = R(), sh = R();          // grow() escribe en f: llamarlo antes del f +=
    f += `<feGaussianBlur in="${src}" stdDeviation="${r2(bl / 2)}" result="${b}"/><feOffset in="${b}" dx="${r2(ox)}" dy="${r2(oy)}" result="${o}"/>`
      + `<feFlood ${col(e.color)}/><feComposite in2="${o}" operator="in" result="${sh}"/>`;
    behind.push(sh); used = true;
    pad = Math.max(pad, Math.max(Math.abs(ox), Math.abs(oy)) + bl * 1.3 + Math.max(0, sp) + 1);
  }
  const over = (res, mode) => { const b = R(); f += `<feBlend in="${res}" in2="${cur}" mode="${mode || 'normal'}" result="${b}"/>`; cur = b; used = true; };
  for (const e of es.filter((x) => x.type === 'INNER_SHADOW')) {
    const sp = (e.spread || 0) * k, bl = (e.radius || 0) * k, ox = (e.offset?.x || 0) * k, oy = (e.offset?.y || 0) * k;
    const src = grow(A, -sp), o = R(), b = R(), m = R(), sh = R();
    f += `<feOffset in="${src}" dx="${r2(ox)}" dy="${r2(oy)}" result="${o}"/><feGaussianBlur in="${o}" stdDeviation="${r2(bl / 2)}" result="${b}"/>`
      + `<feComposite in="${A}" in2="${b}" operator="out" result="${m}"/><feFlood ${col(e.color)}/><feComposite in2="${m}" operator="in" result="${sh}"/>`;
    over(sh, FE_BLEND[e.blendMode]);
  }
  // Noise: granos del color (mono), de dos colores (dúo) o de colores (multi), con densidad
  for (const e of es.filter((x) => x.type === 'NOISE')) {
    const sz = Math.max(0.3, (e.noiseSize?.x || 1) * k), dens = clamp01(e.density ?? 0.5), op = e.opacity ?? 1;
    const steps = 40, on = Math.max(1, Math.round(dens * steps)), table = (inv) => Array.from({ length: steps }, (_, i) => ((i >= steps - on) !== inv ? 1 : 0)).join(' ');
    const t = R(), st = R(), d1 = R(), c1 = R(), res = R();
    f += `<feTurbulence type="fractalNoise" baseFrequency="${r4(1.1 / sz)}" numOctaves="1" seed="${e.seed || 1}" stitchTiles="stitch" result="${t}"/>`
      + `<feComponentTransfer in="${t}" result="${st}"><feFuncA type="linear" slope="3" intercept="-1"/></feComponentTransfer>`;
    if (e.noiseType === 'MULTITONE') {
      f += `<feColorMatrix in="${st}" type="saturate" values="4" result="${c1}"/><feComponentTransfer in="${c1}" result="${d1}"><feFuncA type="discrete" tableValues="${table(false)}"/></feComponentTransfer>`
        + `<feComposite in="${d1}" in2="${A}" operator="in" result="${res}"/>`;
    } else {
      f += `<feComponentTransfer in="${st}" result="${d1}"><feFuncA type="discrete" tableValues="${table(false)}"/></feComponentTransfer>`
        + `<feFlood ${col(e.color, op)}/><feComposite in2="${d1}" operator="in" result="${c1}"/>`;
      if (e.noiseType === 'DUOTONE' && e.secondaryColor) {
        const d2 = R(), c2 = R(), mg = R();
        f += `<feComponentTransfer in="${st}" result="${d2}"><feFuncA type="discrete" tableValues="${table(true)}"/></feComponentTransfer>`
          + `<feFlood ${col(e.secondaryColor, op)}/><feComposite in2="${d2}" operator="in" result="${c2}"/><feMerge result="${mg}"><feMergeNode in="${c2}"/><feMergeNode in="${c1}"/></feMerge>`
          + `<feComposite in="${mg}" in2="${A}" operator="in" result="${res}"/>`;
      } else f += `<feComposite in="${c1}" in2="${A}" operator="in" result="${res}"/>`;
    }
    noiseRes = res;
    over(res, FE_BLEND[e.blendMode]);
  }
  // Glass: bisel con brillo especular (la refracción de lo de detrás no existe en Roblox: detrás está el juego en vivo)
  for (const e of es.filter((x) => x.type === 'GLASS')) {
    const depth = Math.max(1, (e.refractionRadius || e.bevelSize || 10) * k * 0.4), inten = clamp01(e.specularIntensity ?? 0.5);
    const gb = R(), sp = R(), gs = R(), rim = R(), rr = R();
    f += `<feGaussianBlur in="${A}" stdDeviation="${r2(depth)}" result="${gb}"/>`
      + `<feSpecularLighting in="${gb}" surfaceScale="${r2(depth * 1.5)}" specularConstant="${r2(0.5 + inten * 1.5)}" specularExponent="16" lighting-color="#ffffff" result="${sp}">`
      + `<feDistantLight azimuth="${r2(e.specularAngle ?? -45)}" elevation="30"/></feSpecularLighting><feComposite in="${sp}" in2="${A}" operator="in" result="${gs}"/>`
      + `<feComposite in="${A}" in2="${gb}" operator="out" result="${rim}"/><feFlood flood-color="#ffffff" flood-opacity="${r4(0.25 + inten * 0.35)}"/><feComposite in2="${rim}" operator="in" result="${rr}"/>`;
    over(gs, 'screen'); over(rr, 'screen');
    warns.push('Glass: se simula el bisel y el brillo; la refracción/escarcha de lo que hay detrás no es posible en Roblox');
  }
  let out = R();
  f += opts.noiseOnly && noiseRes ? `<feMerge result="${out}"><feMergeNode in="${noiseRes}"/></feMerge>`
    : `<feMerge result="${out}">${behind.map((b) => `<feMergeNode in="${b}"/>`).join('')}${opts.onlyBehind ? '' : `<feMergeNode in="${cur}"/>`}</feMerge>`;
  for (const e of es.filter((x) => x.type === 'FOREGROUND_BLUR')) {
    let r = (e.radius || 0) * k;
    if (e.blurOpType === 'PROGRESSIVE') { r = ((e.startRadius || 0) * k + r) / 2; warns.push('Desenfoque progresivo -> desenfoque uniforme medio'); }
    const b = R(); f += `<feGaussianBlur in="${out}" stdDeviation="${r2(r / 2)}" result="${b}"/>`; out = b; used = true;
    pad = Math.max(pad, r * 1.3 + 1);
  }
  for (const e of es) {
    if (e.type === 'BACKGROUND_BLUR') warns.push('Background blur: Roblox no puede difuminar lo que hay detrás de un Frame (se deja el fondo como está)');
    else if (e.type === 'REPEAT' || e.type === 'SYMMETRY' || e.type === 'CUSTOM') warns.push(`Efecto ${e.type} ignorado`);
  }
  const m = Math.ceil(pad) + 4;
  return { used, pad: Math.ceil(pad), warns,
    svg: used ? `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${r2(w + m * 2)}" height="${r2(h + m * 2)}" color-interpolation-filters="sRGB">${f}</filter>` : '' };
}

// ---------------------------------------------------------------- conversor
export async function convertFigma(message, opts = {}) {
  const warn = new Set();
  const blobs = message.blobs || [];
  const images = opts.images || null;           // Map hashHex -> {bytes}
  const map = buildTree(message);
  resolveInstances(map, warn);
  const jobs = [];                              // rasterizados pendientes
  const savedImages = new Set();

  // raíces: lo que cuelga de una página (no interna); si se pide un nodo concreto, ese
  let roots = [];
  if (opts.rootId) { const r = map.get(opts.rootId); if (r) roots = [r]; }
  else for (const n of map.values()) {
    if (SKIP.has(n.c.type)) continue;
    const p = n.parent;
    if (!p || (p.c.type === 'CANVAS' && !p.c.internalOnly)) roots.push(n);
  }
  roots = roots.filter((n) => n.c.visible !== false).sort((a, b) => ((a.c.parentIndex?.position || '') < (b.c.parentIndex?.position || '') ? -1 : 1));
  if (!roots.length) throw new Error('no hay capas visibles en lo copiado');

  // modo pantalla: un único frame con proporción de pantalla -> sus hijos van al escenario escalados
  const stageW = opts.stageW || 1280, stageH = opts.stageH || 720;
  let mode = 'nodes', s = opts.scale || 1, bgHex = null;
  if (roots.length === 1 && CONTAINERS.has(roots[0].c.type) && roots[0].kids.length) {
    const g = local(roots[0].c);
    if (g.w >= 640 && Math.abs(g.w / g.h - stageW / stageH) < 0.08) { mode = 'screen'; s = stageW / g.w; }
  }
  // escala: las UIs de Roblox se diseñan en Figma a 1920×1080 => ×(720/1080) por defecto (igual para todo lo que se pegue);
  // "1:1" sin escalar; "fit" encaja lo pegado en el escenario. Si aun así no cabe, se encaja.
  if (mode === 'nodes' && !opts.scale) {
    const gs = roots.map((r) => local(r.c));
    const bw = Math.max(...gs.map((g) => g.x + g.w)) - Math.min(...gs.map((g) => g.x)), bh = Math.max(...gs.map((g) => g.y + g.h)) - Math.min(...gs.map((g) => g.y));
    const sm = opts.scaleMode || '1080';
    if (sm === 'native') s = 1;
    else if (sm === 'fit') { mode = 'fit'; s = Math.min(stageW / bw, stageH / bh); }
    else { mode = 'design'; s = stageH / (opts.designH || 1080); }
    if (bw * s > stageW + 0.5 || bh * s > stageH + 0.5) { mode = 'fit'; s = Math.min(stageW / bw, stageH / bh); }
  }

  const has = (n, pred) => pred(n) || n.kids.some((k) => k.c.visible !== false && has(k, pred));
  const hasImagePaint = (c) => visiblePaints(c.fillPaints).some((p) => p.type === 'IMAGE' || p.type === 'VIDEO');
  const isIconUnit = (n) => {
    const c = n.c;
    if (!(CONTAINERS.has(c.type) || c.type === 'BOOLEAN_OPERATION')) return false;
    if (c.type === 'BOOLEAN_OPERATION') return true;
    if (!has(n, (x) => VECTORISH.has(x.c.type))) return false;
    if (has(n, (x) => x.c.type === 'TEXT' || hasImagePaint(x.c))) return false;
    if (!n.kids.length) return false;
    const ok = (x) => (VECTORISH.has(x.c.type) || SHAPES.has(x.c.type) || CONTAINERS.has(x.c.type)) && x.kids.every(ok);
    return n.kids.every(ok) && (c.size?.x || 0) * s <= 512 && (c.size?.y || 0) * s <= 512;
  };

  function uniqueNames(list) {
    const used = {};
    for (const n of list) {
      if (n.ClassName.startsWith('UI')) continue;
      const base = n.Name || n.ClassName;
      if (used[base]) { used[base]++; n.Name = base + used[base]; } else used[base] = 1;
    }
    return list;
  }
  // etiquetas en el nombre de la capa: "Tienda [scroll]", "Nombre [textbox]", "Arte [flatten]", "Guía [ignore]"… (se quitan del Name)
  const TAG_RE = /\s*\[([a-z0-9 _-]{2,20})\]\s*/gi;
  const tagsOf = (c) => new Set([...String(c.name || '').matchAll(TAG_RE)].map((m) => m[1].toLowerCase().replace(/[\s_-]+/g, '')));
  const cleanName = (s) => String(s || '').replace(TAG_RE, ' ').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80) || 'Layer';
  const stackOn = (c) => c.stackMode === 'HORIZONTAL' || c.stackMode === 'VERTICAL' || c.stackMode === 'GRID';
  // grupos modernos de Figma: FRAME con resizeToFit y sin pintura (no recortan ni tienen fondo)
  const isGroupish = (c) => c.type === 'GROUP' || (c.type === 'FRAME' && c.resizeToFit && !stackOn(c) && !visiblePaints(c.fillPaints).length && !visiblePaints(c.strokePaints).length);

  // ---------- prototipo de Figma -> interacciones rbxui (clic = abrir / alternar / cerrar ventana)
  const CLICKS = new Set(['ON_CLICK', 'ON_PRESS', 'MOUSE_UP', 'MOUSE_DOWN']);
  const HOVERS = new Set(['ON_HOVER', 'MOUSE_ENTER', 'MOUSE_IN']);
  const protoTargets = new Set();
  const masterOf = (c) => (c.type === 'INSTANCE' && c.symbolData?.symbolID ? map.get(key(c.symbolData.symbolID)) || null : null);
  function protoOf(c) {
    const own = (c.prototypeInteractions || []).filter((x) => !x.isDeleted);
    return own.length ? own : (masterOf(c)?.c.prototypeInteractions || []).filter((x) => !x.isDeleted);
  }
  function interactionsOf(c) {
    const out = [];
    let press = false, hover = false;
    for (const it of protoOf(c)) {
      const ev = it.event?.interactionType;
      if (HOVERS.has(ev)) hover = true;
      if (!CLICKS.has(ev)) continue;
      press = true;
      for (const a of it.actions || []) {
        const ct = a.connectionType || (a.transitionNodeID ? 'INTERNAL_NODE' : 'NONE');
        if (ct === 'BACK' || ct === 'CLOSE') { out.push({ trigger: 'click', action: 'close' }); continue; }
        if (ct === 'URL') { warn.add(`"${cleanName(c.name)}": enlace a una web ignorado (Roblox no abre URLs)`); continue; }
        if (ct !== 'INTERNAL_NODE' || !a.transitionNodeID) continue;
        const nav = a.navigationType || 'NAVIGATE';
        if (nav === 'SCROLL_TO' || nav === 'SWAP_STATE') continue;     // cambiar de variante = efecto del botón
        const t = map.get(key(a.transitionNodeID));
        if (!t) { warn.add(`"${cleanName(c.name)}": el destino de su prototipo no viene en lo copiado (cópialo también)`); continue; }
        protoTargets.add(key(a.transitionNodeID));
        out.push({ trigger: 'click', action: nav === 'OVERLAY' ? 'toggle' : 'open', target: cleanName(t.c.name),
          animation: !a.transitionType || a.transitionType === 'INSTANT_TRANSITION' ? 'none' : 'pop' });
      }
    }
    return { list: out, button: press || hover };
  }
  // componente de una instancia -> atributos (para localizarla desde scripts)
  function componentAttrs(c) {
    const m = masterOf(c);
    if (!m) return null;
    const set = m.parent && (m.parent.c.type === 'COMPONENT_SET' || m.parent.c.isStateGroup) ? m.parent : null;
    return set ? { FigmaComponent: cleanName(set.c.name), FigmaVariant: String(m.c.name || '') } : { FigmaComponent: cleanName(m.c.name) };
  }
  // restricciones de Figma -> AnchorPoint + UDim2 con escala (la capa se queda pegada al borde / centro al cambiar la pantalla)
  function axisConv(con, x, w, P) {
    switch (con) {
      case 'MAX': case 'FIXED_MAX': return { a: 1, ps: 1, po: r2(x + w - P), ss: 0, so: r2(w) };
      case 'CENTER': return { a: 0.5, ps: 0.5, po: r2(x + w / 2 - P / 2), ss: 0, so: r2(w) };
      case 'STRETCH': return { a: 0, ps: 0, po: r2(x), ss: 1, so: r2(w - P) };
      case 'SCALE': return { a: 0, ps: r4(x / (P || 1)), po: 0, ss: r4(w / (P || 1)), so: 0 };
      default: return null;
    }
  }
  function constrain(nodes, c, PW, PH) {
    const hc = c.horizontalConstraint, vc = c.verticalConstraint;
    for (const nd of nodes) {
      const p = nd.props;
      if (!p || !Array.isArray(p.Position) || !Array.isArray(p.Size) || p.Position[0] || p.Position[2] || p.Size[0] || p.Size[2]) continue;
      const H = axisConv(hc, p.Position[1], p.Size[1], PW), V = axisConv(vc, p.Position[3], p.Size[3], PH);
      if (!H && !V) continue;
      const h0 = H || { a: 0, ps: 0, po: p.Position[1], ss: 0, so: p.Size[1] }, v0 = V || { a: 0, ps: 0, po: p.Position[3], ss: 0, so: p.Size[3] };
      p.Position = [h0.ps, h0.po, v0.ps, v0.po];
      p.Size = [h0.ss, h0.so, v0.ss, v0.so];
      if (h0.a || v0.a) p.AnchorPoint = [h0.a, v0.a];
    }
  }
  // scroll de Figma (o etiqueta [scroll] / [scrollx] / [scrollxy])
  const scrollOf = (c, tags) => (tags.has('scrollx') ? 'X' : tags.has('scrollxy') ? 'XY' : tags.has('scroll') || tags.has('scrolly') ? 'Y'
    : { HORIZONTAL: 'X', VERTICAL: 'Y', BOTH: 'XY' }[c.scrollDirection] || null);
  // lo que Roblox no puede pintar tal cual -> se hornea el fondo a PNG (los hijos siguen siendo nativos)
  const liveFx = (c) => (c.effects || []).filter((e) => e.visible !== false);
  function needsBake(c) {
    const ps = visiblePaints(c.fillPaints);
    if (ps.some((p) => BLEND[p.blendMode])) return true;
    if (ps.some((p) => p.type.startsWith('GRADIENT') && p.type !== 'GRADIENT_LINEAR')) return true;
    const imgs = ps.filter((p) => p.type === 'IMAGE');
    if (imgs.length && (ps.length > 1 || imgs.some((p) => p.imageScaleMode === 'TILE' || p.paintFilter || ((p.imageScaleMode === 'STRETCH' || p.imageScaleMode === 'CROP') && !isIdentity(p.transform))))) return true;
    if (ps.some((p) => p.type === 'NOISE' || p.type === 'PATTERN')) return true;
    // borde con fusión (SOFT_LIGHT, OVERLAY…), degradado o imagen: UIStroke no puede
    if ((c.strokeWeight || 0) > 0 && visiblePaints(c.strokePaints).some((p) => BLEND[p.blendMode] || p.type !== 'SOLID')) return true;
    // borde discontinuo o con grosor distinto por lado: UIStroke es uno solo y continuo
    if (visiblePaints(c.strokePaints).length && (((c.strokeWeight || 0) > 0 && c.dashPattern?.length) || sideWeights(c))) return true;
    if (liveFx(c).some((e) => e.type !== 'BACKGROUND_BLUR' && !(e.type === 'DROP_SHADOW' && (e.radius || 0) <= 0.5))) return true;   // (modo plano)
    if (c.rectangleCornerRadiiIndependent) { const rs = [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomLeftCornerRadius, c.rectangleBottomRightCornerRadius].map((x) => x || 0); if (Math.max(...rs) - Math.min(...rs) > 0.5) return true; }
    return false;
  }
  // Capas editables (por defecto): solo se hornea la pieza entera cuando lleva algo que Roblox no puede ni aproximar por capas
  // (desenfoque de capa, ruido, textura/grano, cristal, sombra interior, borde discontinuo/por lado/imagen, radios distintos).
  function needsFlat(c) {
    if (liveFx(c).some((e) => ['FOREGROUND_BLUR', 'NOISE', 'GRAIN', 'GLASS', 'INNER_SHADOW'].includes(e.type))) return true;
    const sps = visiblePaints(c.strokePaints);
    if ((c.strokeWeight || 0) > 0 && sps.some((p) => p.type === 'IMAGE' || (p.type.startsWith('GRADIENT') && p.type !== 'GRADIENT_LINEAR'))) return true;
    if (sps.length && (((c.strokeWeight || 0) > 0 && c.dashPattern?.length) || sideWeights(c))) return true;
    if (c.rectangleCornerRadiiIndependent) { const rs = [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomLeftCornerRadius, c.rectangleBottomRightCornerRadius].map((x) => x || 0); if (Math.max(...rs) - Math.min(...rs) > 0.5) return true; }
    return false;
  }
  const bakeWhole = (c) => (opts.flat ? needsBake(c) : needsFlat(c));
  // Roblox no tiene modos de fusión. Una pintura con fusión se vuelve una capa NORMAL de luces (blanco) y sombras (negro) con su
  // transparencia: OVERLAY/SOFT_LIGHT = blanco donde es clara y negro donde es oscura; MULTIPLY… = sombras; SCREEN… = luces.
  // Así no depende del color de debajo: cambias el color de la pieza y la textura sigue viéndose bien.
  const NEUTRAL = { OVERLAY: 'split2', HARD_LIGHT: 'split2', SOFT_LIGHT: 'split1', MULTIPLY: 'dark', DARKEN: 'dark', LINEAR_BURN: 'dark', COLOR_BURN: 'dark',
    SCREEN: 'light', LIGHTEN: 'light', LINEAR_DODGE: 'light', COLOR_DODGE: 'light', DIFFERENCE: 'split2', EXCLUSION: 'split1', HUE: 'split1', SATURATION: 'split1',
    COLOR: 'split1', LUMINOSITY: 'split2' };
  // OVERLAY(C,T) con T = 0.5 + d: capa blanca de alfa d·w o negra de alfa |d|·b da el mismo color en un canal C;
  // la fusión va canal a canal, así que el factor es la media de los tres canales de lo que hay debajo
  function nfac1(mode, C) {
    C = Math.min(0.95, Math.max(0.05, C));
    if (mode === 'split1') return { w: 2 * (Math.sqrt(C) - C) / (1 - C), b: 2 * (1 - C) };
    return { w: C < 0.5 ? 2 * C / (1 - C) : 2, b: C < 0.5 ? 2 : 2 * (1 - C) / C };
  }
  const modeOf = (p, lb) => (BLEND[p.blendMode] ? NEUTRAL[p.blendMode] || 'split2' : lb ? NEUTRAL[lb] || 'split2' : null);
  const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  // luminosidad media de una pintura (lo que queda «debajo» de las pinturas con fusión)
  // color medio de una pintura (lo que queda «debajo» de las pinturas con fusión)
  const GRAY = { r: 0.5, g: 0.5, b: 0.5 };
  const paintRgb = (p) => (p.type === 'SOLID' ? p.color : p.type.startsWith('GRADIENT') && p.stops?.length ? { ...avgColor(p), all: p.stops.map((x) => x.color), ...(p.type === 'GRADIENT_LINEAR' ? { grad: p } : {}) } : GRAY);
  const nzOf = (mode, op, bl) => ({ mode, op, base: nzBase(bl), tint: tintOf(mode, bl), bl });
  const nzBase = (bl) => ({ r: r4(bl.r), g: r4(bl.g), b: r4(bl.b), ...(bl.all ? { all: bl.all.map((x) => ({ r: r4(x.r), g: r4(x.g), b: r4(x.b) })) } : {}) });
  // color de relleno visible de una capa (para las hermanas que tiene encima), o null
  const fillRgb = (c) => { const ps = visiblePaints(c.fillPaints).filter((q) => !BLEND[q.blendMode] && (q.type === 'SOLID' || q.type.startsWith('GRADIENT')) && (q.opacity ?? 1) > 0.5); return ps.length ? paintRgb(ps[ps.length - 1]) : null; };
  // Las fusiones son LINEALES en la capa de arriba (T) dentro de cada mitad: sobre un color liso C,
  //   blend(C, T) = mezcla(C, blend(C,1), 2T-1) si T >= 0.5 · mezcla(C, blend(C,0), 1-2T) si T < 0.5
  // => luces = capa de color blend(C,1) y sombras = capa blend(C,0), con alfa = distancia a 0.5·2. Exacto sobre fondo liso.
  const softD = (C) => (C <= 0.25 ? ((16 * C - 12) * C + 4) * C : Math.sqrt(C));
  const BLEND_CH = { split2: (C, T) => (C < 0.5 ? 2 * C * T : 1 - 2 * (1 - C) * (1 - T)),
    split1: (C, T) => (T <= 0.5 ? C - (1 - 2 * T) * C * (1 - C) : C + (2 * T - 1) * (softD(C) - C)),
    dark: (C, T) => C * T, light: (C, T) => 1 - (1 - C) * (1 - T) };
  const blendRgb = (mode, B, T) => { const f = BLEND_CH[mode] || BLEND_CH.split2; return { r: clamp01(f(B.r, T.r)), g: clamp01(f(B.g, T.g)), b: clamp01(f(B.b, T.b)) }; };
  // ¿lo de debajo es (casi) un color liso conocido? tinte exacto; si es desconocido (GRAY) o un degradado muy variado, capa gris neutra
  const tintable = (B) => B !== GRAY && (!B.all || ['r', 'g', 'b'].every((k) => Math.max(...B.all.map((x) => x[k])) - Math.min(...B.all.map((x) => x[k])) < 0.2));
  const tintOf = (mode, B) => (!(mode === 'split1' || mode === 'split2') ? null
    : tintable(B) ? { l: hex(blendRgb(mode, B, { r: 1, g: 1, b: 1 })), d: hex(blendRgb(mode, B, { r: 0, g: 0, b: 0 })) }
    : B.grad ? { l: '#FFFFFF', d: '#FFFFFF', grad: true } : null);
  // debajo hay un degradado lineal: el tinte va en un UIGradient con la misma dirección, blend(color del degradado, 1 ó 0) muestreado
  function tintGrad(mode, B, T, mirror) {
    const g = B?.grad && uiGradient(B.grad);
    if (!g) return [];
    const cs = g.props.Color.map(([t, h]) => [t, fromHex(h)]), N = 10, col = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N; let j = 0; while (j < cs.length - 2 && cs[j + 1][0] < t) j++;
      const [t0, c0] = cs[j], [t1, c1] = cs[j + 1], u = t1 > t0 ? clamp01((t - t0) / (t1 - t0)) : 0;
      const C = { r: c0.r + (c1.r - c0.r) * u, g: c0.g + (c1.g - c0.g) * u, b: c0.b + (c1.b - c0.b) * u };
      col.push([r4(t), hex(blendRgb(mode, C, { r: T, g: T, b: T }))]);
    }
    return [{ ClassName: 'UIGradient', Name: 'UIGradient', props: { Color: col, Rotation: mirror ? r2(180 - g.props.Rotation) : g.props.Rotation } }];
  }
  function neutralColor(col, mode, alpha, base = GRAY) {
    const l = lumOf(col), a0 = clamp01((col.a ?? 1) * alpha);
    if (tintable(base)) return { hex: hex(blendRgb(mode, base, col)), a: r4(a0) };   // color exacto de la fusión
    if (mode === 'dark') return { hex: '#000000', a: r4((1 - l) * a0) };
    if (mode === 'light') return { hex: '#FFFFFF', a: r4(l * a0) };
    const f = nfac(mode, base), d = l - 0.5;
    return d >= 0 ? { hex: '#FFFFFF', a: r4(clamp01(d * f.w) * a0) } : { hex: '#000000', a: r4(clamp01(-d * f.b) * a0) };
  }
  const fromHex = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
  // lo que hay debajo de la textura (en formato fills.js): degradado lineal, color, o desconocido
  function baseFor(bl, mirror) {
    if (!bl || bl === GRAY) return null;
    if (bl.grad) {
      const g = uiGradient(bl.grad);
      if (g) return { grad: { stops: g.props.Color.map(([t, h]) => [t, fromHex(h)]), rot: mirror ? r2(180 - g.props.Rotation) : g.props.Rotation } };
    }
    if (bl.all && !tintable(bl)) return null;
    return { solid: { r: bl.r, g: bl.g, b: bl.b } };
  }
  // degradado lineal con fusión -> UIGradient de blanco/negro con transparencias (sobre un fondo blanco)
  function neutralGradient(p, mode, extra, mirror, base) {
    const g = uiGradient(p);
    if (!g) return null;
    const tr = g.props.Transparency || g.props.Color.map((k) => [k[0], 0]);
    const ns = g.props.Color.map(([t, hx], i) => [t, neutralColor({ ...fromHex(hx), a: 1 - (tr[i]?.[1] ?? 0) }, mode, extra, base)]);
    g.props.Color = ns.map(([t, nc]) => [t, nc.hex]);
    g.props.Transparency = ns.map(([t, nc]) => [t, r4(1 - nc.a)]);
    if (mirror) g.props.Rotation = r2(180 - g.props.Rotation);
    return g;
  }
  const sha = (x) => crypto.createHash('sha1').update(x).digest('hex');
  // una sola pintura (sin su fusión) a PNG del tamaño de la pieza, recortada a su forma; nz = neutralizar (luces/sombras)
  function paintPng(c, p, W, H, mirror, nz) {
    const lay = cssPaint({ ...p, blendMode: 'NORMAL', opacity: 1 }, W, H, s, images);
    if (!lay) return null;
    const k = Math.min(1, 512 / Math.max(W, H, 1));
    const html = `<div id="cap" style="display:inline-block;zoom:${r4(k)}"><div style="position:relative;width:${r2(W)}px;height:${r2(H)}px;border-radius:${radiusCss(c, W, H, s)};`
      + `overflow:hidden;isolation:isolate;${mirror ? 'transform:scaleX(-1);' : ''}">${lay}</div></div>`;
    const nzj = nz && { mode: nz.mode, op: nz.op, base: nz.base, tint: nz.tint };
    const rel = `${IMG_REL}/${sha(html + JSON.stringify(nzj || 0) + (nz ? "n4" : ""))}.png`;
    jobs.push({ kind: 'html', markup: html, rel, neutral: nzj || null });
    return rel;
  }
  // textura en mosaico: la tesela (neutralizada si lleva fusión) + su tamaño en px de diseño
  function tileLayer(p, hh, bytes, op, nz, mirror) {
    const b = Buffer.from(bytes), d = imageDims(b);
    const k = (p.scale || 1) * s, tw = r2((d.w || p.originalImageWidth || 64) * k), th = r2((d.h || p.originalImageHeight || 64) * k);
    let rel;
    const filt = imgFilterCss(p.paintFilter), fk = filt ? '_f' + sha(filt).slice(0, 6) : '';
    if (nz) {
      rel = `${IMG_REL}/${hh}${fk}_${nz.mode}_${Math.round(nz.op * 100)}_${sha(JSON.stringify(nz.base || 0)).slice(0, 8)}${nz.tint ? 't' : ''}_n4.png`;
      if (!savedImages.has(rel)) { savedImages.add(rel); jobs.push({ kind: 'img', data: `data:${d.mime};base64,${b.toString('base64')}`, rel, filter: filt, neutral: { mode: nz.mode, op: nz.op, base: nz.base, tint: nz.tint } }); }
    } else if (filt) {
      rel = `${IMG_REL}/${hh}${fk}.png`;
      if (!savedImages.has(rel)) { savedImages.add(rel); jobs.push({ kind: 'img', data: `data:${d.mime};base64,${b.toString('base64')}`, rel, filter: filt }); }
    } else rel = saveImage(hh, bytes, false);
    const tile = (name, img, p2, kids) => ({ ClassName: 'ImageLabel', Name: name, props: { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: img, ScaleType: 'Tile', TileSize: [0, tw, 0, th],
      ...(!nz && op < 0.999 ? { ImageTransparency: r4(1 - op) } : {}), ...(p2 || {}) }, ...(kids?.length ? { children: kids } : {}), attributes: { FigmaImage: hh } });
    if (nz?.tint) return [tile('Texture Light', rel, { ImageColor3: nz.tint.l }, tintGrad(nz.mode, nz.bl, 1, mirror)),
      tile('Texture Shade', darkRel(rel), { ImageColor3: nz.tint.d }, tintGrad(nz.mode, nz.bl, 0, mirror))];
    return [tile('Texture', rel)];
  }
  // relleno de Figma -> fondo nativo del nodo + capas hijas (colores, degradados, imágenes y texturas separadas y editables)
  function fillLayers(c, props, mods, extra, leafAlpha, corner, mirror, W, H, lb, under = GRAY) {
    let base = false, bl = under;
    const withCorner = () => (corner ? [JSON.parse(JSON.stringify(corner))] : []);
    const frame = (name, p2, kids) => extra.push({ ClassName: 'Frame', Name: name, props: { Size: [1, 0, 1, 0], BorderSizePixel: 0, ...p2 }, children: [...withCorner(), ...(kids || [])] });
    const image = (name, rel, p2, kids = []) => rel && extra.push({ ClassName: 'ImageLabel', Name: name, props: { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: rel, ScaleType: 'Stretch', ...(p2 || {}) },
      children: corner || kids.length ? [...withCorner(), ...kids] : undefined });
    const nzImage = (name, nz, make, op) => {
      const rel = make(nz);
      if (!rel) return;
      if (nz?.tint) { image(name + ' Light', rel, { ImageColor3: nz.tint.l }, tintGrad(nz.mode, nz.bl, 1, mirror)); image(name + ' Shade', darkRel(rel), { ImageColor3: nz.tint.d }, tintGrad(nz.mode, nz.bl, 0, mirror)); }
      else image(name, rel, nz || op >= 0.999 ? {} : { ImageTransparency: r4(1 - op) });
    };
    // cada capa creada por una pintura lleva su origen en Figma (el editor las muestra como la pila «Relleno», no como capas sueltas)
    const PAINT_LABEL = { SOLID: 'Solid', GRADIENT_LINEAR: 'Linear', GRADIENT_RADIAL: 'Radial', GRADIENT_ANGULAR: 'Angular', GRADIENT_DIAMOND: 'Diamond', IMAGE: 'Image', NOISE: 'Noise', PATTERN: 'Pattern' };
    visiblePaints(c.fillPaints).forEach((p, i) => {
      const n0 = extra.length;
      paintLayer(p, i);
      for (const x of extra.slice(n0)) x.attributes = { FigmaFill: i + 1, FigmaPaint: p.imageScaleMode === 'TILE' ? 'Texture' : PAINT_LABEL[p.type] || p.type,
        ...(BLEND[p.blendMode] ? { FigmaBlend: p.blendMode } : {}), ...(/ Light$/.test(x.Name) ? { FigmaPart: 'light' } : / Shade$/.test(x.Name) ? { FigmaPart: 'shade' } : {}), ...(x.attributes || {}) };
    });
    // pintura de imagen -> receta (null = transformación que no se puede expresar: girada, más pequeña que la pieza…)
    function imageSpec(p, hh, bytes, op, i, mirror) {
      const d = imageDims(Buffer.from(bytes)), T = p.transform || ID, sm = p.imageScaleMode || 'FILL';
      let mode, crop = null;
      if (sm === 'TILE') mode = 'Tile';
      else if (p.rotation) return null;
      else if (sm === 'FIT') mode = 'Fit';
      else if (sm === 'FILL') mode = 'Crop';
      else if (isIdentity(T)) mode = 'Stretch';
      else {
        if (Math.abs(T.m01) > 1e-4 || Math.abs(T.m10) > 1e-4 || T.m00 <= 0 || T.m11 <= 0) return null;
        const x0 = T.m02, y0 = T.m12, x1 = T.m02 + T.m00, y1 = T.m12 + T.m11;
        if (x0 < -0.02 || y0 < -0.02 || x1 > 1.02 || y1 > 1.02) return null;
        const cx0 = clamp01(x0), cy0 = clamp01(y0);
        crop = [r4(cx0), r4(cy0), r4(clamp01(x1) - cx0), r4(clamp01(y1) - cy0)];
        if (crop[0] < 0.002 && crop[1] < 0.002 && crop[2] > 0.996 && crop[3] > 0.996) crop = null;
        mode = 'Stretch';
      }
      const f = p.paintFilter, filter = f && (f.exposure || f.contrast || f.saturation)
        ? { ...(f.exposure ? { exposure: r4(f.exposure) } : {}), ...(f.contrast ? { contrast: r4(f.contrast) } : {}), ...(f.saturation ? { saturation: r4(f.saturation) } : {}) } : null;
      if (f && (f.temperature || f.tint || f.highlights || f.shadows || f.vibrance)) warn.add('Ajustes de imagen de temperatura/tinte/luces/sombras: se ignoran (solo exposición, contraste y saturación)');
      return { fill: i + 1, paint: mode === 'Tile' ? 'Texture' : 'Image', blend: BLEND[p.blendMode] ? p.blendMode : lb || 'NORMAL',
        src: saveImage(hh, bytes, false), srcW: d.w || p.originalImageWidth || 64, srcH: d.h || p.originalImageHeight || 64,
        mode, scale: r4(p.scale || 1), k: r4(s), crop, opacity: r4(op), filter, mirror: !!mirror };
    }
    function paintLayer(p, i) {
      const mode = modeOf(p, lb), op = (p.opacity ?? 1) * leafAlpha;
      const hh = p.type === 'IMAGE' && p.image?.hash ? Buffer.from(p.image.hash).toString('hex') : '';
      if (p.type === 'SOLID' || p.type === 'GRADIENT_LINEAR') {
        const tp = base ? {} : props, tm = base ? [] : mods;
        if (p.type === 'SOLID') {
          const nc = mode ? neutralColor(p.color, mode, op, bl) : { hex: hex(p.color), a: clamp01((p.color.a ?? 1) * op) };
          tp.BackgroundColor3 = nc.hex;
          if (1 - nc.a > 0.001 || base) tp.BackgroundTransparency = r4(1 - nc.a);
        } else {
          tp.BackgroundColor3 = '#FFFFFF';
          const gr = mode ? neutralGradient(p, mode, leafAlpha, mirror, bl) : uiGradient(p);
          if (!mode && leafAlpha < 1) tp.BackgroundTransparency = r4(1 - leafAlpha);
          if (gr && !mode && mirror) gr.props.Rotation = r2(180 - gr.props.Rotation);
          if (gr) tm.push(gr);
        }
        if (base) frame(mode ? (p.type === 'SOLID' ? 'Tint' : 'Shade') : 'Fill' + (i + 1), tp, tm);
        base = true;
        if (!mode && op > 0.5) bl = paintRgb(p);
        return;
      }
      if (p.type === 'IMAGE') {
        // textura/imagen -> ImageLabel(s) con máscara compartida + tinte (receta en attributes.FigmaSpec)
        const spec = hh && images && images.has(hh) ? imageSpec(p, hh, images.get(hh), op, i, mirror) : null;
        if (spec) {
          const out = FL.layersFor(spec, maskJobs(spec, jobs), baseFor(bl, mirror), corner);
          for (const x of out) if (x.props.Image === spec.src) x.attributes.FigmaImage = hh;
          extra.push(...out);
          return;
        }
        if (hh && !(images && images.has(hh))) {
          warn.add('Alguna imagen de Figma no se pudo descargar: queda un hueco "figma-image" (pega encima un PNG o arrastra el .fig)');
          image('Image', `figma-image:${hh}`, { ScaleType: 'Crop' });
          return;
        }
        const bytes = images.get(hh), plain = !p.paintFilter && (isIdentity(p.transform) || !['STRETCH', 'CROP'].includes(p.imageScaleMode));
        if (p.imageScaleMode === 'TILE') { extra.push(...tileLayer(p, hh, bytes, op, mode ? nzOf(mode, op, bl) : null, mirror)); return; }
        if (!mode && plain) {
          const node = { ClassName: 'ImageLabel', Name: 'Image', props: { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: saveImage(hh, bytes, mirror),
            ScaleType: { FILL: 'Crop', FIT: 'Fit', STRETCH: 'Stretch', CROP: 'Crop' }[p.imageScaleMode] || 'Crop', ...(op < 0.999 ? { ImageTransparency: r4(1 - op) } : {}) },
            children: corner ? withCorner() : undefined, attributes: { FigmaImage: hh } };
          extra.push(node); return;
        }
        nzImage('Image', mode ? nzOf(mode, op, bl) : null, (nz) => paintPng(c, p, W, H, mirror, nz), op);
        return;
      }
      // degradado radial / angular / diamante, ruido, patrón: la pintura sola a PNG (neutralizada si lleva fusión)
      nzImage(p.type.startsWith('GRADIENT') ? 'Gradient' : 'Pattern', mode ? nzOf(mode, op, bl) : null, (nz) => paintPng(c, p, W, H, mirror, nz), op);
    }
    if (!base) props.BackgroundTransparency = 1;
    return bl;
  }
  // sombra paralela difuminada -> solo la sombra a PNG, como capa detrás (la pieza sigue nativa)
  function shadowPng(c, g, e) {
    const W = g.w, H = g.h;
    const F = fxFilter([{ ...e, visible: true }], s, 'sh' + jobs.length, W, H, { onlyBehind: true });
    if (!F.used) return null;
    const pad = Math.ceil(F.pad + 2), k = Math.min(1, 512 / Math.max(W + pad * 2, H + pad * 2, 1));
    const html = `<div id="cap" style="display:inline-block;padding:${pad}px;zoom:${r4(k)}"><svg width="0" height="0" style="position:absolute">${F.svg}</svg>`
      + `<div style="width:${r2(W)}px;height:${r2(H)}px;border-radius:${radiusCss(c, W, H, s)};background:#000;filter:url(#${F.svg.match(/id="([^"]+)"/)[1]})"></div></div>`;
    const rel = `${IMG_REL}/${sha(html)}.png`;
    jobs.push({ kind: 'html', markup: html, rel });
    return { rel, pad };
  }
  // ¿un grupo con fusión de capa se puede neutralizar forma a forma? (solo formas con relleno, sin texto, vectores ni efectos)
  const blendable = (n) => n.kids.every((k) => k.c.visible === false || ((SHAPES.has(k.c.type) || CONTAINERS.has(k.c.type)) && !k.c.mask && !liveFx(k.c).length
    && !(k.c.type === 'ELLIPSE' && k.c.arcData && (Math.abs((k.c.arcData.endingAngle || 0) - (k.c.arcData.startingAngle || 0) - 2 * Math.PI) > 0.01 || k.c.arcData.innerRadius > 0)) && blendable(k)));
  // máscara «suave»: alfa con degradado/imagen/transparencia o de luminancia -> no es un simple recorte de forma
  const softMask = (c) => !c.maskIsOutline && (c.maskType === 'LUMINANCE' || visiblePaints(c.fillPaints).some((p) => p.type !== 'SOLID'
    || (p.opacity ?? 1) < 0.99 || (p.color?.a ?? 1) < 0.99) || (c.maskType !== 'OUTLINE' && (c.opacity ?? 1) < 0.99));
  // capas de CSS mask-image con las pinturas de la máscara (arriba primero)
  function maskCss(c, w, h, imgUrl) {
    const ls = visiblePaints(c.fillPaints).map((p) => {
      if (p.type === 'SOLID') { const col = rgbaCss({ ...p.color, a: (p.color?.a ?? 1) * (p.opacity ?? 1) }); return `linear-gradient(${col},${col}) 0 0/100% 100% no-repeat`; }
      const d = cssPaint({ ...p, blendMode: 'NORMAL' }, w, h, 1, images, imgUrl);
      const m = d && /background:(.*?);(?:mix|opacity|filter|")/.exec(d);
      if (!m) return null;
      return /url\(/.test(m[1]) ? m[1] : `${m[1]} 0 0/100% 100% no-repeat`;
    }).filter(Boolean).reverse();
    if (!ls.length) return '';
    return `mask:${ls.join(',')};mask-mode:${c.maskType === 'LUMINANCE' ? 'luminance' : 'alpha'};`;
  }
  // máscara rectangular / redondeada / elíptica -> marco que recorta (ClipsDescendants; CanvasGroup si el radio se ve) con las capas dentro
  function clipUnit(n, run, m, mirror, lb, base) {
    const c = m.c;
    if (softMask(c)) { warn.add(`Máscara "${cleanName(c.name)}" ${c.maskType === 'LUMINANCE' ? 'de luminancia' : 'con degradado/transparencia'} -> imagen (Roblox solo recorta formas)`); return null; }
    if (mirror || !(SHAPES.has(c.type) || (c.type === 'FRAME' && !m.kids.length))) return null;
    if (c.type === 'ELLIPSE' && c.arcData && (Math.abs((c.arcData.endingAngle || 0) - (c.arcData.startingAngle || 0) - 2 * Math.PI) > 0.01 || c.arcData.innerRadius > 0)) return null;
    let q = local(c);
    if (Math.abs(q.rot) > 0.05 || q.flip) return null;
    if (n.c.type === 'GROUP' && !kidsInOwnSpace(n)) { const pg = local(n.c); q = { ...q, x: q.x - pg.x, y: q.y - pg.y }; }
    const rad = c.type === 'ELLIPSE' ? 0 : Math.max(c.cornerRadius || 0, ...(c.rectangleCornerRadiiIndependent ? [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomLeftCornerRadius, c.rectangleBottomRightCornerRadius].map((x) => x || 0) : [0])) * s;
    const round = c.type === 'ELLIPSE' || rad > 4;
    const inner = convKids(n, run, mirror, lb, { noConstrain: true, base });
    for (const x of inner) { const P = x.props?.Position; if (Array.isArray(P) && !P[0] && !P[2]) { P[1] = r2(P[1] - q.x * s); P[3] = r2(P[3] - q.y * s); } }
    return [{ ClassName: round ? 'CanvasGroup' : 'Frame', Name: cleanName(c.name) + 'Clip',
      props: { Position: [0, r2(q.x * s), 0, r2(q.y * s)], Size: [0, r2(q.w * s), 0, r2(q.h * s)], BackgroundTransparency: 1, ClipsDescendants: true },
      children: [...(round ? [{ ClassName: 'UICorner', Name: 'UICorner', props: { CornerRadius: c.type === 'ELLIPSE' ? [0.5, 0] : [0, r2(Math.min(rad, q.w * s / 2, q.h * s / 2))] } }] : []), ...uniqueNames(inner)] }];
  }
  // radio CSS de un nodo (k = escala; W/H ya escalados)
  const radiusCss = (c, W, H, k = 1) => (c.type === 'ELLIPSE' ? '50%' : c.rectangleCornerRadiiIndependent
    ? [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomRightCornerRadius, c.rectangleBottomLeftCornerRadius].map((x) => `${r2(Math.min((x || 0) * k, Math.min(W, H) / 2))}px`).join(' ')
    : `${r2(Math.min((c.cornerRadius || 0) * k, Math.min(W, H) / 2))}px`);
  // borde: un anillo por pintura (máscara content-box XOR) con su fusión, como en Figma
  function ringsHtml(c, W, H, k, urlFn) {
    const sides = sideWeights(c);
    const sw = (sides ? Math.max(...sides) : c.strokeWeight || 0) * k, al = c.strokeAlign || 'CENTER';
    if (sw <= 0) return { html: '', off: 0 };
    const offOf = (w) => (al === 'INSIDE' ? 0 : al === 'OUTSIDE' ? w : w / 2);
    // grosor por lado: anillo con relleno distinto en cada lado (arriba, derecha, abajo, izquierda)
    if (sides) {
      const [t, r, b, l] = sides.map((x) => x * k), o = [t, r, b, l].map(offOf);
      const html = visiblePaints(c.strokePaints).map((p) => {
        const lay = cssPaint({ ...p, blendMode: 'NORMAL' }, W + o[1] + o[3], H + o[0] + o[2], k, images, urlFn);
        return lay ? `<div style="position:absolute;top:${r2(-o[0])}px;right:${r2(-o[1])}px;bottom:${r2(-o[2])}px;left:${r2(-o[3])}px;padding:${r2(t)}px ${r2(r)}px ${r2(b)}px ${r2(l)}px;box-sizing:border-box;`
          + `border-radius:${radiusCss(c, W, H, k)};-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;`
          + `${BLEND[p.blendMode] ? `mix-blend-mode:${BLEND[p.blendMode]};` : ''}">${lay}</div>` : '';
      }).join('');
      return { html, off: Math.max(...o) };
    }
    // discontinuo: rectángulo SVG con stroke-dasharray
    if (c.dashPattern?.length) {
      const off = offOf(sw), p = visiblePaints(c.strokePaints).find((q) => q.type === 'SOLID' || q.type.startsWith('GRADIENT'));
      if (!p) return { html: '', off: 0 };
      const col = p.type === 'SOLID' ? p.color : avgColor(p), bw = W + off * 2, bh = H + off * 2;
      const rx = c.type === 'ELLIPSE' ? '50%' : r2(Math.max(0, Math.min((c.cornerRadius || 0) * k + off - sw / 2, Math.min(bw, bh) / 2)));
      const shape = c.type === 'ELLIPSE' ? `<ellipse cx="${r2(bw / 2)}" cy="${r2(bh / 2)}" rx="${r2((bw - sw) / 2)}" ry="${r2((bh - sw) / 2)}"`
        : `<rect x="${r2(sw / 2)}" y="${r2(sw / 2)}" width="${r2(bw - sw)}" height="${r2(bh - sw)}" rx="${rx}"`;
      const cap = { ROUND: 'round', SQUARE: 'square' }[c.strokeCap] || 'butt';
      return { off, html: `<svg style="position:absolute;left:${r2(-off)}px;top:${r2(-off)}px;overflow:visible;${BLEND[p.blendMode] ? `mix-blend-mode:${BLEND[p.blendMode]};` : ''}" width="${r2(bw)}" height="${r2(bh)}">`
        + `${shape} fill="none" stroke="${hex(col)}" stroke-opacity="${r4(clamp01((col.a ?? 1) * (p.opacity ?? 1)))}" stroke-width="${r2(sw)}" stroke-linecap="${cap}"`
        + ` stroke-dasharray="${c.dashPattern.map((v) => r2(v * k)).join(' ')}"/></svg>` };
    }
    const off = al === 'INSIDE' ? 0 : al === 'OUTSIDE' ? sw : sw / 2;
    const html = visiblePaints(c.strokePaints).map((p) => {
      const lay = cssPaint({ ...p, blendMode: 'NORMAL' }, W + off * 2, H + off * 2, k, images, urlFn);
      if (!lay) return '';
      const rr = c.type === 'ELLIPSE' ? '50%' : `${r2(Math.min((c.cornerRadius || 0) * k, Math.min(W, H) / 2) + (c.cornerRadius ? off : 0))}px`;
      return `<div style="position:absolute;inset:${r2(-off)}px;border-radius:${rr};padding:${r2(sw)}px;box-sizing:border-box;`
        + `-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;`
        + `${BLEND[p.blendMode] ? `mix-blend-mode:${BLEND[p.blendMode]};` : ''}">${lay}</div>`;
    }).join('');
    return { html, off };
  }
  // fondo + contorno + sombras de un nodo, pintado en Chrome => { rel, pad } (pad = px de diseño alrededor)
  function bake(c, W, H, mirror) {
    const rad = radiusCss(c, W, H, s);
    const layers = visiblePaints(c.fillPaints).map((p) => cssPaint(p, W, H, s, images)).filter(Boolean).join('');
    if (visiblePaints(c.fillPaints).some((p) => p.type === 'IMAGE' && !(images && images.has(Buffer.from(p.image?.hash || []).toString('hex'))))) warn.add('Alguna imagen de Figma no se pudo descargar: esa capa sale sin ella');
    const outer = [], inner = [];
    let pad = 2;
    const { html: rings, off } = ringsHtml(c, W, H, s);
    pad += off;
    const F = fxFilter(c.effects, s, 'fx' + jobs.length, W, H);
    F.warns.forEach((x) => warn.add(x));
    pad = Math.ceil(Math.max(pad, F.pad + 2 + (outer.length ? pad : 0)));
    const k = Math.min(1, 512 / Math.max(W + pad * 2, H + pad * 2, 1));
    const html = `<div id="cap" style="display:inline-block;padding:${pad}px;zoom:${r4(k)}">${F.used ? `<svg width="0" height="0" style="position:absolute">${F.svg}</svg>` : ''}`
      + `<div style="position:relative;width:${r2(W)}px;height:${r2(H)}px;border-radius:${rad};isolation:isolate;box-shadow:${outer.join(',') || 'none'};${F.used ? `filter:url(#${'fx' + jobs.length});` : ''}${mirror ? 'transform:scaleX(-1);' : ''}">`
      + `<div style="position:absolute;inset:0;border-radius:${rad};overflow:hidden;isolation:isolate">${layers}</div>`
      + rings + (inner.length ? `<div style="position:absolute;inset:0;border-radius:${rad};box-shadow:${inner.join(',')}"></div>` : '') + '</div></div>';
    const rel = `${IMG_REL}/${crypto.createHash('sha1').update(html).digest('hex')}.png`;
    jobs.push({ kind: 'html', markup: html, rel });
    return { rel, pad };
  }

  // fondo desde las pinturas: la de abajo como fondo; las demás, capas hijas encima
  function fillProps(c, props, mods, extra, leafAlpha, corner, mirror) {
    const ps = visiblePaints(c.fillPaints);
    const paintable = ps.filter((p) => p.type === 'SOLID' || p.type.startsWith('GRADIENT'));
    const imgs = ps.filter((p) => p.type === 'IMAGE');
    if (!paintable.length) props.BackgroundTransparency = 1;
    paintable.forEach((p, i) => {
      const target = i === 0 ? { props, mods } : { props: { Size: [1, 0, 1, 0], BorderSizePixel: 0 }, mods: [] };
      if (p.type === 'SOLID') {
        target.props.BackgroundColor3 = hex(p.color);
        const t = 1 - clamp01((p.color.a ?? 1) * (p.opacity ?? 1) * leafAlpha);
        if (t > 0.001 || i > 0) target.props.BackgroundTransparency = r4(t);
      } else if (p.type === 'GRADIENT_LINEAR') {
        target.props.BackgroundColor3 = '#FFFFFF';
        if (leafAlpha < 1) target.props.BackgroundTransparency = r4(1 - leafAlpha);
        const g = uiGradient(p);
        if (g && mirror) g.props.Rotation = r2(180 - g.props.Rotation);
        if (g) target.mods.push(g);
      } else {
        const a = avgColor(p);
        target.props.BackgroundColor3 = hex(a);
        target.props.BackgroundTransparency = r4(1 - clamp01(a.a * (p.opacity ?? 1) * leafAlpha));
        warn.add(`Degradado ${p.type.replace('GRADIENT_', '').toLowerCase()} -> color medio (Roblox solo tiene lineal)`);
      }
      if (i > 0) {
        if (corner) target.mods.push(corner);
        extra.push({ ClassName: 'Frame', Name: 'Fill' + (i + 1), props: target.props, children: target.mods.length ? target.mods : undefined });
      }
    });
    for (const p of imgs) {
      const hh = p.image?.hash ? Buffer.from(p.image.hash).toString('hex') : '';
      const scale = { FILL: 'Crop', FIT: 'Fit', TILE: 'Tile', STRETCH: 'Stretch', CROP: 'Crop' }[p.imageScaleMode] || 'Crop';
      let img = hh ? `figma-image:${hh}` : '';
      if (hh && images && images.has(hh)) img = saveImage(hh, images.get(hh), mirror);
      else if (hh) warn.add('Alguna imagen de Figma no se pudo descargar: queda un hueco "figma-image" (pega encima un PNG o arrastra el .fig)');
      extra.push({ ClassName: 'ImageLabel', Name: 'Image', props: { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: img, ScaleType: scale,
        ...((p.opacity ?? 1) < 1 ? { ImageTransparency: r4(1 - p.opacity) } : {}) }, children: corner ? [corner] : undefined, attributes: hh ? { FigmaImage: hh } : undefined });
    }
  }
  function saveImage(hh, bytes, mirror) {
    const b = Buffer.from(bytes), d = imageDims(b);
    const big = Math.max(d.w, d.h) > 1024 || d.ext === 'webp' || mirror;   // Roblox: máx. 1024 px; espejo = PNG volteado
    const rel = `${IMG_REL}/${hh}${mirror ? '_m' : ''}.${big ? 'png' : d.ext}`;
    if (!savedImages.has(rel)) {
      savedImages.add(rel);
      if (big) jobs.push({ kind: 'img', data: `data:${d.mime};base64,${b.toString('base64')}`, rel, mirror });
      else { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), b); }
    }
    return rel;
  }
  function cornerOf(c, w, h) {
    let r = c.cornerRadius || 0;
    if (c.rectangleCornerRadiiIndependent) {
      const rs = [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomLeftCornerRadius, c.rectangleBottomRightCornerRadius].map((x) => x || 0);
      r = Math.max(...rs);
      if (rs.some((x) => Math.abs(x - r) > 0.5)) warn.add('Esquinas con radios distintos -> se usa el mayor (UICorner es uno solo)');
    }
    if (c.type === 'ELLIPSE') return { ClassName: 'UICorner', Name: 'UICorner', props: { CornerRadius: [0.5, 0] } };
    if (r <= 0.01) return null;
    return { ClassName: 'UICorner', Name: 'UICorner', props: { CornerRadius: [0, r2(Math.min(r * s, Math.min(w, h) / 2))] } };
  }
  // borde -> UIStroke: sólido = su color; con fusión = blanco/negro semitransparente; degradado lineal = UIStroke + UIGradient
  function strokeOf(c, contextual, hasCorner, lb, under = GRAY) {
    const sps = visiblePaints(c.strokePaints).filter((p) => p.type === 'SOLID' || p.type.startsWith('GRADIENT'));
    const sp = opts.flat ? sps[0] : sps[sps.length - 1];
    const wgt = c.strokeWeight || 0;
    if (!sp || wgt <= 0.01) return null;
    const align = c.strokeAlign || 'CENTER';
    const props = { ApplyStrokeMode: contextual ? 'Contextual' : 'Border',
      Thickness: r2(wgt * s * (contextual ? (align === 'CENTER' ? 0.5 : align === 'INSIDE' ? 0.35 : 1) : 1)),
      LineJoinMode: hasCorner || c.strokeJoin === 'ROUND' ? 'Round' : c.strokeJoin === 'BEVEL' ? 'Bevel' : 'Miter' };
    if (!contextual && align !== 'OUTSIDE') props.BorderStrokePosition = align === 'INSIDE' ? 'Inner' : 'Center';
    const mode = opts.flat ? null : modeOf(sp, lb);
    let kids;
    // borde sólido con fusión: color exacto sobre el fondo (UIGradient si el fondo es un degradado) + receta para el editor
    const sblend = BLEND[sp.blendMode] ? sp.blendMode : lb;
    if (!opts.flat && sp.type === 'SOLID' && sblend && sblend !== 'NORMAL') {
      const rec = { color: hex(sp.color), opacity: r4(clamp01((sp.color.a ?? 1) * (sp.opacity ?? 1))), blend: sblend };
      const r = FL.blendOver(sblend, baseFor(under, false), rec.color);
      if (r) {
        props.Color = r.color;
        if (1 - rec.opacity > 0.001) props.Transparency = r4(1 - rec.opacity);
        return { ClassName: 'UIStroke', Name: 'UIStroke', props, ...(r.gradient ? { children: [{ ClassName: 'UIGradient', Name: 'UIGradient', props: r.gradient }] } : {}),
          attributes: { FigmaStroke: JSON.stringify(rec) } };
      }
    }
    if (sp.type === 'SOLID' || (sp.type !== 'GRADIENT_LINEAR') || opts.flat) {
      const col = sp.type === 'SOLID' ? sp.color : avgColor(sp);
      const nc = mode ? neutralColor(col, mode, sp.opacity ?? 1, under) : { hex: hex(col), a: clamp01((col.a ?? 1) * (sp.opacity ?? 1)) };
      props.Color = nc.hex;
      if (1 - nc.a > 0.001) props.Transparency = r4(1 - nc.a);
    } else {
      props.Color = '#FFFFFF';
      const gr = mode ? neutralGradient(sp, mode, 1, false, under) : uiGradient(sp);
      if (gr) kids = [gr];
    }
    return { ClassName: 'UIStroke', Name: 'UIStroke', props, ...(kids ? { children: kids } : {}) };
  }
  // sombra paralela nítida -> copia detrás desplazada
  function shadowsOf(c, node, g) {
    if ((c.effects || []).some((x) => x.visible !== false && x.type === 'BACKGROUND_BLUR')) warn.add('Background blur: Roblox no puede difuminar lo que hay detrás de un Frame (se deja el fondo como está)');
    // la primera de la lista queda encima (Figma pinta las sombras en orden inverso)
    return (c.effects || []).filter((x) => x.type === 'DROP_SHADOW' && x.visible !== false).reverse().map((e, i) => shadowOf(e, node, g, i, c));
  }
  function shadowOf(e, node, g, i, c) {
    const blur = (e.radius || 0) * s, spread = (e.spread || 0) * s, ox = (e.offset?.x || 0) * s, oy = (e.offset?.y || 0) * s;
    if (!opts.flat && c && blur > 0.5 && node.ClassName !== 'TextLabel') {
      const r = shadowPng(c, g, e);
      if (r) return { ClassName: 'ImageLabel', Name: node.Name + 'Shadow' + (i ? i + 1 : ''), props: { BackgroundTransparency: 1, Image: r.rel, ScaleType: 'Stretch',
        Position: [0, r2(g.x - r.pad), 0, r2(g.y - r.pad)], Size: [0, r2(g.w + r.pad * 2), 0, r2(g.h + r.pad * 2)], ...(g.rot && Math.abs(g.rot) > 0.05 ? { Rotation: r2(g.rot) } : {}) } };
    }
    const a = clamp01((e.color?.a ?? 0.25) * (blur > 6 ? 0.55 : 1));
    if (blur > 6) warn.add('Sombras difuminadas -> copia sólida más transparente (Roblox no difumina)');
    const sh = JSON.parse(JSON.stringify(node));
    sh.Name = node.Name + 'Shadow' + (i ? i + 1 : '');
    delete sh.interactions; delete sh.buttonFx; delete sh.attributes;
    const p = sh.props;
    p.Position = [0, r2(g.x + ox - spread), 0, r2(g.y + oy - spread)];
    p.Size = [0, r2(g.w + spread * 2), 0, r2(g.h + spread * 2)];
    if (sh.ClassName === 'TextLabel') {
      // texto: misma caja desplazada; el spread engorda el contorno (el "borde negro que baja")
      p.Position = [0, r2(g.x + ox), 0, r2(g.y + oy)];
      p.Size = [0, r2(g.w), 0, r2(g.h)];
      const sc = hex(e.color || { r: 0, g: 0, b: 0 });
      p.TextColor3 = sc; p.TextTransparency = r4(1 - a);
      const st = (sh.children || []).find((m) => m.ClassName === 'UIStroke');
      const thick = r2((st ? +st.props.Thickness || 0 : 0) + Math.max(0, spread));
      sh.children = [...(sh.children || []).filter((m) => m.ClassName === 'UIGradient' ? false : m.ClassName !== 'UIStroke')];
      if (thick > 0) sh.children.push({ ClassName: 'UIStroke', Name: 'UIStroke', props: { ApplyStrokeMode: 'Contextual', Thickness: thick, Color: sc, LineJoinMode: 'Round', ...(a < 1 ? { Transparency: r4(1 - a) } : {}) } });
    } else {
      sh.ClassName = 'Frame';
      p.BackgroundColor3 = hex(e.color || { r: 0, g: 0, b: 0 }); p.BackgroundTransparency = r4(1 - a);
      delete p.Text; delete p.Image; delete p.ClipsDescendants;
      sh.children = (sh.children || []).filter((m) => m.ClassName === 'UICorner');
    }
    if (!sh.children?.length) delete sh.children;
    return sh;
  }

  // ---------- texto
  const FONT_MAP = { montserrat: 'Montserrat', gotham: 'GothamSSm', 'gotham ssm': 'GothamSSm', 'gotham rounded': 'GothamSSm', 'fredoka one': 'FredokaOne', fredoka: 'FredokaOne',
    'lilita one': 'FredokaOne', 'titan one': 'LuckiestGuy', 'luckiest guy': 'LuckiestGuy', bangers: 'Bangers', roboto: 'Roboto', 'roboto mono': 'RobotoMono',
    'roboto condensed': 'RobotoCondensed', oswald: 'Oswald', nunito: 'Nunito', 'nunito sans': 'Nunito', arimo: 'Arimo', arial: 'Arimo', helvetica: 'Arimo',
    'helvetica neue': 'Arimo', 'press start 2p': 'PressStart2P', 'source sans pro': 'SourceSansPro', 'source sans 3': 'SourceSansPro', inter: 'BuilderSans',
    'builder sans': 'BuilderSans', 'sf pro': 'BuilderSans', 'sf pro display': 'BuilderSans', 'sf pro text': 'BuilderSans', poppins: 'Montserrat',
    ubuntu: 'Ubuntu', 'titillium web': 'TitilliumWeb', 'permanent marker': 'PermanentMarker', creepster: 'Creepster', 'denk one': 'DenkOne',
    'amatic sc': 'AmaticSC', jura: 'Jura', merriweather: 'Merriweather', 'indie flower': 'IndieFlower', kalam: 'Kalam', michroma: 'Michroma',
    sarpanch: 'Sarpanch', 'special elite': 'SpecialElite', 'patrick hand': 'PatrickHand', 'josefin sans': 'JosefinSans', 'space grotesk': 'BuilderSans' };
  const WEIGHTS_CSS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 };
  const weightOf = (style = '') => {
    const st = style.toLowerCase().replace(/[\s_-]+/g, '');
    if (/thin|hairline/.test(st)) return 'Thin';
    if (/extralight|ultralight/.test(st)) return 'ExtraLight';
    if (/semibold|demibold/.test(st)) return 'SemiBold';
    if (/extrabold|ultrabold/.test(st)) return 'ExtraBold';
    if (/black|heavy/.test(st)) return 'Heavy';
    if (/bold/.test(st)) return 'Bold';
    if (/medium/.test(st)) return 'Medium';
    if (/light/.test(st)) return 'Light';
    return 'Regular';
  };
  // fuente de Figma -> familia integrada de Roblox o, si no la hay, la misma fuente de la Creator Store (rbxassetid://id)
  const ASSET_BY_NAME = Object.fromEntries(Object.entries(RJ.ASSET_FONTS).map(([id, nm]) => [nm.toLowerCase(), `rbxassetid://${id}`]));
  const BUILTIN = new Set(['montserrat', 'roboto', 'roboto mono', 'roboto condensed', 'oswald', 'nunito', 'arimo', 'bangers', 'creepster', 'denk one', 'merriweather',
    'permanent marker', 'titillium web', 'ubuntu', 'amatic sc', 'jura', 'kalam', 'michroma', 'sarpanch', 'special elite', 'patrick hand', 'josefin sans',
    'indie flower', 'luckiest guy', 'press start 2p', 'fredoka one', 'source sans pro', 'source sans 3', 'inconsolata']);
  const fontFace = (fn) => {
    const fam = String(fn?.family || 'Inter'), lc = fam.toLowerCase();
    const mapped = (BUILTIN.has(lc) && FONT_MAP[lc]) || ASSET_BY_NAME[lc] || FONT_MAP[lc];
    if (!mapped) warn.add(`Fuente "${fam}" no existe en Roblox -> BuilderSans`);
    return { family: mapped || 'BuilderSans', weight: weightOf(fn?.style), style: /italic|oblique/i.test(fn?.style || '') ? 'Italic' : 'Normal' };
  };
  const caseOf = (txt, tc) => (tc === 'UPPER' ? txt.toUpperCase() : tc === 'LOWER' ? txt.toLowerCase() : tc === 'TITLE' ? txt.replace(/\b\w/g, (m) => m.toUpperCase()) : txt);
  const escXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');


  // ---------- texto con efectos que Roblox no tiene
  const textFxKind = (c) => {
    const es = liveFx(c).filter((e) => e.type !== 'BACKGROUND_BLUR');
    if (!es.length || es.every((e) => e.type === 'DROP_SHADOW' && (e.radius || 0) <= 0.5)) return 'native';
    if (es.every((e) => e.type === 'DROP_SHADOW')) return 'glow';          // sombra/halo difuminado: se hornea solo el halo
    return 'image';                                                         // blur/noise/grain/glass/inner: el texto entero a PNG
  };
  function bakeText(n, g, onlyBehind) {
    const c = n.c, W = g.w, H = g.h;
    const fam = String(c.fontName?.family || 'Inter'), wt = WEIGHTS_CSS[weightOf(c.fontName?.style)] || 400, ital = /italic|oblique/i.test(c.fontName?.style || '');
    const fsz = (c.fontSize || 12) * s;
    const ps = visiblePaints(c.fillPaints), top = ps[ps.length - 1];
    let color = 'transparent', clipBg = '';
    if (top?.type === 'SOLID') color = rgbaCss(top.color, top.opacity ?? 1);
    else if (top?.type?.startsWith('GRADIENT')) { clipBg = cssPaint(top, W, H, s, images)?.match(/background:([^;]*);/)?.[1] || ''; color = 'transparent'; }
    const sp = visiblePaints(c.strokePaints).find((p) => p.type === 'SOLID');
    const sw = sp ? (c.strokeWeight || 0) * s : 0;
    const strokeCss = sw ? `-webkit-text-stroke:${r2(c.strokeAlign === 'OUTSIDE' ? sw * 2 : c.strokeAlign === 'INSIDE' ? sw : sw)}px ${rgbaCss(sp.color, sp.opacity ?? 1)};paint-order:stroke fill;` : '';
    const lh = c.lineHeight;
    const lhCss = lh ? (lh.units === 'PIXELS' ? `${r2(lh.value * s)}px` : lh.units === 'PERCENT' ? `${r4(lh.value / 100)}` : `${r4(lh.value)}`) : 'normal';
    const ls = c.letterSpacing ? (c.letterSpacing.units === 'PERCENT' ? (c.letterSpacing.value / 100) * fsz : c.letterSpacing.value * s) : 0;
    const txt = caseOf(c.textData?.characters || '', c.textCase).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const xa = { CENTER: 'center', RIGHT: 'flex-end' }[c.textAlignHorizontal] || 'flex-start', ya = { CENTER: 'center', BOTTOM: 'flex-end' }[c.textAlignVertical] || 'flex-start';
    const id = 'tx' + jobs.length;
    const F = fxFilter(c.effects, s, id, W, H, { onlyBehind });
    F.warns.forEach((x) => warn.add(x));
    const pad = Math.ceil(F.pad + sw + 4);
    const k = Math.min(1, 512 / Math.max(W + pad * 2, H + pad * 2, 1));
    const font = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:ital,wght@${ital ? 1 : 0},${wt}&display=block`;
    const inner = `<span style="${clipBg ? `background:${clipBg};-webkit-background-clip:text;background-clip:text;` : ''}">${txt}</span>`;
    const html = `<link rel="stylesheet" href="${font}"><div id="cap" style="display:inline-block;padding:${pad}px;zoom:${r4(k)}">${F.used ? `<svg width="0" height="0" style="position:absolute">${F.svg}</svg>` : ''}`
      + `<div style="width:${r2(W)}px;height:${r2(H)}px;display:flex;align-items:${ya};justify-content:${xa};text-align:${xa === 'center' ? 'center' : xa === 'flex-end' ? 'right' : 'left'};`
      + `font-family:'${fam}','Inter','Montserrat',sans-serif;font-weight:${wt};font-style:${ital ? 'italic' : 'normal'};font-size:${r2(fsz)}px;line-height:${lhCss};letter-spacing:${r2(ls)}px;`
      + `color:${color};${strokeCss}white-space:${c.textAutoResize === 'WIDTH_AND_HEIGHT' ? 'pre' : 'pre-wrap'};${F.used ? `filter:url(#${id});` : ''}${g.mirror ? 'transform:scaleX(-1);' : ''}">${inner}</div></div>`;
    const rel = `${IMG_REL}/${crypto.createHash('sha1').update(html).digest('hex')}.png`;
    jobs.push({ kind: 'html', markup: html, rel });
    const rot = g.rot && Math.abs(g.rot) > 0.05 ? { Rotation: r2(g.rot) } : {};
    return { ClassName: 'ImageLabel', Name: cleanName(c.name) + (onlyBehind ? 'Glow' : ''), props: { BackgroundTransparency: 1, Image: rel, ScaleType: 'Stretch',
      Position: [0, r2(g.x - pad), 0, r2(g.y - pad)], Size: [0, r2(W + pad * 2), 0, r2(H + pad * 2)], ...rot }, attributes: { FigmaText: c.textData?.characters || '' } };
  }
  function textNode(n, g) {
    const c = n.c;
    const ps = visiblePaints(c.fillPaints);
    const top = ps[ps.length - 1];
    const fs0 = (c.fontSize || 12) * s;
    const props = { BackgroundTransparency: 1, Position: [0, r2(g.x), 0, r2(g.y)], Size: [0, r2(g.w), 0, r2(g.h)],
      TextSize: Math.max(1, Math.round(fs0 * 1.14)), FontFace: fontFace(c.fontName),
      TextXAlignment: { CENTER: 'Center', RIGHT: 'Right' }[c.textAlignHorizontal] || 'Left',
      TextYAlignment: { CENTER: 'Center', BOTTOM: 'Bottom' }[c.textAlignVertical] || 'Top',
      // una línea en Figma => sin ajuste (la fuente de Roblox puede ser más ancha y partiría el texto)
      TextWrapped: c.textAutoResize !== 'WIDTH_AND_HEIGHT' && (c.derivedTextData?.derivedLines?.length ?? 2) > 1 };
    // una sola línea en una caja de su altura: centrada en vertical. Arriba, la diferencia de métrica entre la fuente de Figma
    // y la de Roblox (y el ×1.14) la descuadra hacia abajo; centrada queda donde en Figma.
    const oneLine = c.textAutoResize === 'WIDTH_AND_HEIGHT' || (c.derivedTextData?.derivedLines?.length ?? 2) <= 1;
    // Figma guarda dónde dibuja cada línea (baselines: lineY + lineHeight): la caja se ajusta a esa franja y se centra ahí,
    // así el texto queda donde en Figma aunque la caja sea más alta o la fuente de Roblox mida distinto
    // (con UIPadding: la caja no cambia de tamaño, así no descuadra auto-layouts)
    const mods = [];
    const bls = c.derivedTextData?.baselines;
    if (bls?.length) {
      const ly0 = Math.min(...bls.map((b) => b.lineY || 0)), ly1 = Math.max(...bls.map((b) => (b.lineY || 0) + (b.lineHeight || 0)));
      const pt = ly0 * s, pb = g.h - ly1 * s;
      if (ly1 - ly0 > 1 && pt > -0.5 && pb > -0.5) {
        props.TextYAlignment = 'Center';
        if (pt > 0.5 || pb > 0.5) mods.push({ ClassName: 'UIPadding', Name: 'UIPadding', props: { PaddingTop: [0, r2(Math.max(0, pt))], PaddingBottom: [0, r2(Math.max(0, pb))] } });
      }
    } else if (oneLine && g.h <= fs0 * 1.5) props.TextYAlignment = 'Center';
    if (g.rot && Math.abs(g.rot) > 0.05) props.Rotation = r2(g.rot);
    const op = c.opacity ?? 1;
    if (!top) props.TextTransparency = 1;
    else if (top.type === 'SOLID') {
      props.TextColor3 = hex(top.color);
      const t = 1 - clamp01((top.color.a ?? 1) * (top.opacity ?? 1) * op);
      if (t > 0.001) props.TextTransparency = r4(t);
    } else if (top.type === 'GRADIENT_LINEAR') {
      props.TextColor3 = '#FFFFFF';
      if (op < 1) props.TextTransparency = r4(1 - op);
      const gr = uiGradient(top); if (gr) mods.push(gr);
    } else props.TextColor3 = hex(avgColor(top));
    // estilos mezclados -> RichText
    const td = c.textData || {};
    let txt = caseOf(td.characters || '', c.textCase);
    const ids = td.characterStyleIDs || [], table = new Map((td.styleOverrideTable || []).map((o) => [o.styleID, o]));
    const italic = (fn) => /italic|oblique/i.test(fn?.style || '');
    if (ids.some((x) => x && table.has(x))) {
      const chars = [...txt];
      let out = '', cur = null, buf = '';
      // tramo con estilo propio -> [apertura, cierre] RichText (color, tamaño, peso, fuente, cursiva, subrayado, tachado)
      const open = (o) => {
        if (!o) return ['', ''];
        const a = [], pre = [], post = [];
        const p = visiblePaints(o.fillPaints).pop();
        if (p && p.type === 'SOLID') a.push(`color="${hex(p.color)}"`);
        if (o.fontSize) a.push(`size="${Math.round(o.fontSize * s * 1.14)}"`);
        if (o.fontName) a.push(`weight="${weightOf(o.fontName.style)}"`);
        if (o.fontName?.family && o.fontName.family !== c.fontName?.family) {
          const ff = fontFace(o.fontName);
          if (!/^rbxasset/.test(ff.family)) a.push(`family="rbxasset://fonts/families/${ff.family}.json"`);
        }
        if (o.fontName && italic(o.fontName) && !italic(c.fontName)) { pre.push('<i>'); post.unshift('</i>'); }
        if (o.textDecoration === 'UNDERLINE') { pre.push('<u>'); post.unshift('</u>'); }
        if (o.textDecoration === 'STRIKETHROUGH') { pre.push('<s>'); post.unshift('</s>'); }
        const f = a.length ? `<font ${a.join(' ')}>` : '';
        return [f + pre.join(''), post.join('') + (f ? '</font>' : '')];
      };
      const flush = () => { if (!buf) return; const [o1, c1] = open(cur ? table.get(cur) : null); out += o1 + escXml(buf) + c1; buf = ''; };
      chars.forEach((ch, i) => { const id = ids[i] || 0; if (id !== cur) { flush(); cur = id; } buf += ch; });
      flush();
      txt = out; props.RichText = true;
    }
    // subrayado / tachado de todo el texto
    const deco = { UNDERLINE: 'u', STRIKETHROUGH: 's' }[c.textDecoration];
    if (deco) { if (!props.RichText) { txt = escXml(txt); props.RichText = true; } txt = `<${deco}>${txt}</${deco}>`; }
    if (c.textTruncation === 'ENDING') props.TextTruncate = 'AtEnd';
    if (c.maxLines === 1) props.TextWrapped = false;   // «Max lines: 1» = una línea con puntos suspensivos
    if ((c.paragraphSpacing || 0) > 0.5 && txt.includes('\n')) warn.add('Espaciado entre párrafos ignorado (Roblox no lo tiene)');
    props.Text = txt;
    const lh = c.lineHeight;
    if (lh && txt.includes('\n')) {
      const mult = lh.units === 'PIXELS' ? lh.value / ((c.fontSize || 12) * 1.2) : lh.units === 'PERCENT' ? lh.value / 100 : lh.value / 1.2;
      if (isFinite(mult) && Math.abs(mult - 1) > 0.05) props.LineHeight = r2(Math.max(1, Math.min(3, mult)));
    }
    if (c.letterSpacing && Math.abs(c.letterSpacing.value) > 0.01 && (c.letterSpacing.units !== 'PERCENT' || Math.abs(c.letterSpacing.value) > 1)) warn.add('Interletraje (letter spacing) ignorado: Roblox no lo tiene');
    const st = strokeOf(c, true, false); if (st) mods.push(st);
    // [textbox] / [input]: caja de texto editable; lo escrito en Figma pasa a ser el texto de ayuda
    const tg = tagsOf(c);
    if (tg.has('textbox') || tg.has('input')) {
      const plain = String(td.characters || '');
      Object.assign(props, { Text: '', PlaceholderText: plain, PlaceholderColor3: props.TextColor3 || '#FFFFFF', ClearTextOnFocus: false, RichText: false });
      delete props.TextTruncate;
      return { ClassName: 'TextBox', Name: cleanName(c.name), props, ...(mods.length ? { children: mods } : {}) };
    }
    return { ClassName: 'TextLabel', Name: cleanName(c.name), props, ...(mods.length ? { children: mods } : {}) };
  }

  // ---------- SVG de un subárbol (vectores / iconos)
  function pathsOf(c, paints, geo, w, h, defs, isStroke) {
    let out = '';
    for (const p of paints) {
      let fill;
      if (p.type === 'SOLID') fill = `fill="${hex(p.color)}" fill-opacity="${r4(clamp01((p.color.a ?? 1) * (p.opacity ?? 1)))}"`;
      else if (p.type === 'GRADIENT_LINEAR') {
        const id = 'g' + defs.length;
        const { a, b } = linearHandles(p);
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(a.x * w)}" y1="${r2(a.y * h)}" x2="${r2(b.x * w)}" y2="${r2(b.y * h)}">`
          + (p.stops || []).map((st) => `<stop offset="${r4(st.position)}" stop-color="${hex(st.color)}" stop-opacity="${r4((st.color.a ?? 1) * (p.opacity ?? 1))}"/>`).join('') + '</linearGradient>');
        fill = `fill="url(#${id})"`;
      } else if (p.type.startsWith('GRADIENT')) { const m = avgColor(p); fill = `fill="${hex(m)}" fill-opacity="${r4(m.a * (p.opacity ?? 1))}"`; }
      else continue;
      const g = geo || [];
      const net = !g.length && c.vectorData && typeof c.vectorData.vectorNetworkBlob === 'number' ? networkOf(c) : null;
      if (g.length) {
        for (const f of g) {
          const bl = blobs[f.commandsBlob]?.bytes;
          const d = bl ? blobPath(bl) : null;
          if (d) out += `<path d="${d}" ${fill} fill-rule="${f.windingRule === 'ODD' ? 'evenodd' : 'nonzero'}"/>`;
        }
      } else if (net) {
        // sin regiones Figma rellena igualmente los lazos cerrados de la red
        if (!isStroke) for (const fp of net.fills.length ? net.fills : net.open ? [{ d: net.open, rule: 'nonzero' }] : []) out += `<path d="${fp.d}" ${fill} fill-rule="${fp.rule}"/>`;
        else if (c.strokeWeight) {
          const stroke = fill.replace(/^fill=/, 'stroke=').replace(/fill-opacity=/, 'stroke-opacity=');
          const cap = { ROUND: 'round', SQUARE: 'square' }[c.strokeCap] || 'butt', join = { ROUND: 'round', BEVEL: 'bevel' }[c.strokeJoin] || 'miter';
          out += `<path d="${net.fills.length ? net.fills.map((x) => x.d).join('') : net.open}" fill="none" ${stroke} stroke-width="${r2(c.strokeWeight)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${dashAttr(c)}/>`;
        }
      } else if (!isStroke) {
        if (c.type === 'ELLIPSE') out += `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${fill}/>`;
        else if (SHAPES.has(c.type) || CONTAINERS.has(c.type)) out += `<rect width="${w}" height="${h}" rx="${Math.min(c.cornerRadius || 0, Math.min(w, h) / 2)}" ${fill}/>`;
      } else if (c.strokeWeight) {
        const sw = c.strokeWeight;
        if (c.type === 'LINE') out += `<line x1="0" y1="0" x2="${w}" y2="0" stroke="${fill.match(/"(#[0-9A-F]+)"/)?.[1] || '#000'}" stroke-width="${sw}"${dashAttr(c)}/>`;
        else if (c.type === 'ELLIPSE') out += `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="${fill.match(/"(#[0-9A-F]+)"/)?.[1] || '#000'}" stroke-width="${sw}"${dashAttr(c)}/>`;
        else out += `<rect width="${w}" height="${h}" rx="${c.cornerRadius || 0}" fill="none" stroke="${fill.match(/"(#[0-9A-F]+)"/)?.[1] || '#000'}" stroke-width="${sw}"${dashAttr(c)}/>`;
      }
    }
    return out;
  }
  // red vectorial escalada del espacio normalizado al tamaño del nodo
  function networkOf(c) {
    const bl = blobs[c.vectorData.vectorNetworkBlob]?.bytes;
    const ns = c.vectorData.normalizedSize, w = c.size?.x || 1, h = c.size?.y || 1;
    return bl ? networkPaths(bl, ns?.x ? w / ns.x : 1, ns?.y ? h / ns.y : 1) : null;
  }
  function svgFx(c, defs) {
    const F = fxFilter(c.effects, 1, 'f' + defs.length, c.size?.x || 0, c.size?.y || 0);
    F.warns.forEach((x) => warn.add(x));
    if (!F.used) return '';
    defs.push(F.svg);
    return ` filter="url(#${F.svg.match(/id="([^"]+)"/)[1]})"`;
  }
  function svgOf(n, isRoot, defs) {
    const c = n.c;
    if (c.visible === false || c.mask) return '';
    const w = c.size?.x || 0, h = c.size?.y || 0;
    let inner = '';
    if (c.type !== 'GROUP' && c.type !== 'BOOLEAN_OPERATION' || c.fillGeometry?.length) inner += pathsOf(c, visiblePaints(c.fillPaints), c.fillGeometry, w, h, defs, false);
    if (c.type !== 'BOOLEAN_OPERATION') {
      const own = kidsInOwnSpace(n) || c.type !== 'GROUP';
      const kidsSvg = n.kids.map((k) => svgOf(k, false, defs)).join('');
      if (own) inner += kidsSvg;
      else { const t = c.transform || ID; const iv = invert(t); inner += `<g transform="matrix(${iv.m00} ${iv.m10} ${iv.m01} ${iv.m11} ${iv.m02} ${iv.m12})">${kidsSvg}</g>`; }
    } else if (!c.fillGeometry?.length && n.kids.length) {
      // booleana sin geometría horneada: se compone con los hijos (unión / resta con máscara), pintados con la pintura de la booleana
      const paintKid = (k) => { const m = cloneNode(k); const fix = (x) => { if (VECTORISH.has(x.c.type) || SHAPES.has(x.c.type)) { x.c.fillPaints = c.fillPaints; x.c.strokePaints = []; } x.kids.forEach(fix); }; fix(m); return m; };
      const kids = n.kids.filter((k) => k.c.visible !== false).map(paintKid);
      if (c.booleanOperation === 'SUBTRACT' && kids.length > 1) {
        const id = 'm' + defs.length;
        const white = (k) => { const m = cloneNode(k); const fix = (x) => { x.c.fillPaints = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true }]; x.c.effects = []; x.kids.forEach(fix); }; fix(m); return m; };
        defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000"><rect x="-10000" y="-10000" width="20000" height="20000" fill="#fff"/>${kids.slice(1).map((k) => svgOf(white(k), false, defs)).join('')}</mask>`);
        inner += `<g mask="url(#${id})">${svgOf(kids[0], false, defs)}</g>`;
      } else {
        if (c.booleanOperation === 'INTERSECT' || c.booleanOperation === 'XOR') warn.add(`Operación booleana ${c.booleanOperation} aproximada como unión`);
        inner += kids.map((k) => svgOf(k, false, defs)).join('');
      }
    }
    inner += pathsOf(c, visiblePaints(c.strokePaints), c.strokeGeometry, w, h, defs, true);
    if (CONTAINERS.has(c.type) && c.type !== 'GROUP' && c.frameMaskDisabled === false && !isRoot) {
      const id = 'c' + defs.length; defs.push(`<clipPath id="${id}"><rect width="${w}" height="${h}" rx="${c.cornerRadius && c.cornerRadius < 1e6 ? c.cornerRadius : 0}"/></clipPath>`);
      inner = `<g clip-path="url(#${id})">${inner}</g>`;
    }
    const t = c.transform || ID;
    const tr = isRoot ? '' : ` transform="matrix(${r4(t.m00)} ${r4(t.m10)} ${r4(t.m01)} ${r4(t.m11)} ${r4(t.m02)} ${r4(t.m12)})"`;
    const op = (c.opacity ?? 1) < 1 ? ` opacity="${r4(c.opacity)}"` : '';
    const fx = svgFx(c, defs);
    return `<g${tr}${op}>${fx ? `<g${fx}>${inner}</g>` : inner}</g>`;
  }
  function iconNode(n, g, name) {
    const c = n.c;
    const w = c.size?.x || 1, h = c.size?.y || 1;
    const pad = Math.ceil(Math.max(2, extentOf(n)));
    const defs = [];
    let body = svgOf(n, true, defs);
    if (g.mirror) body = `<g transform="translate(${r2(w)} 0) scale(-1 1)">${body}</g>`;
    const vw = w + pad * 2, vh = h + pad * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vw)}" height="${r2(vh)}" viewBox="${-pad} ${-pad} ${r2(vw)} ${r2(vh)}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>`;
    const sha = crypto.createHash('sha1').update(svg).digest('hex');
    const rel = `${IMG_REL}/${sha}.png`;
    jobs.push({ svg, rel, w: vw * s, h: vh * s });
    const btn = BUTTON_RE.test(c.name || '');
    const props = { BackgroundTransparency: 1, Position: [0, r2(g.x - pad * s), 0, r2(g.y - pad * s)], Size: [0, r2(vw * s), 0, r2(vh * s)], Image: rel, ScaleType: 'Stretch' };
    if (g.rot && Math.abs(g.rot) > 0.05) props.Rotation = r2(g.rot);
    const out = { ClassName: btn ? 'ImageButton' : 'ImageLabel', Name: name, props };
    if (btn) out.buttonFx = { hover: 1.06, press: 0.9 };
    return out;
  }
  // cuánto se sale el dibujo de su caja: contornos + sombras/brillos
  const extentOf = (n) => Math.max(visiblePaints(n.c.strokePaints).length ? (n.c.strokeWeight || 0) * 1.5 : 0,
    fxFilter(n.c.effects, 1, 'x', n.c.size?.x || 0, n.c.size?.y || 0).pad + 1, ...n.kids.map(extentOf), 0);


  // ================================================================ render de escena (HTML fiel a Figma)
  // Sirve para hornear lo que Roblox no sabe componer: capas enmascaradas y capas con fusión (OVERLAY, SOFT_LIGHT…).
  // Posiciones con left/top (sin contexto de apilamiento) => las fusiones atraviesan grupos como en Figma (pass-through).
  // Máscaras: la capa máscara no se pinta; las hermanas que tiene encima llevan clip-path con su forma (en su espacio local).
  const rootsSet = new Set(roots);
  const isTop = (x) => rootsSet.has(x) || !x.parent || x.parent.c.type === 'CANVAS' || x.parent.c.type === 'DOCUMENT';
  function relT(n) {                                   // transformación respecto a la caja del padre
    const t = n.c.transform || ID, par = n.parent;
    if (par && par.c.type === 'GROUP' && !kidsInOwnSpace(par)) return mul(invert(par.c.transform || ID), t);
    return t;
  }
  const absCache = new Map();
  function absT(n) {                                   // respecto a la esquina de su raíz pegada
    if (absCache.has(n)) return absCache.get(n);
    const t = isTop(n) ? ID : mul(absT(n.parent), relT(n));
    absCache.set(n, t);
    return t;
  }
  const rootOf = (n) => { let x = n; while (!isTop(x)) x = x.parent; return x; };
  function absBox(n, pad = 0) {
    const T = absT(n), w = n.c.size?.x || 0, h = n.c.size?.y || 0;
    const q = [apply(T, 0, 0), apply(T, w, 0), apply(T, 0, h), apply(T, w, h)];
    const x0 = Math.min(...q.map((v) => v.x)) - pad, y0 = Math.min(...q.map((v) => v.y)) - pad;
    return { x: x0, y: y0, w: Math.max(...q.map((v) => v.x)) + pad - x0, h: Math.max(...q.map((v) => v.y)) + pad - y0 };
  }
  const inter = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y; return w > 0 && h > 0 ? { x, y, w, h } : null; };
  const unionBox = (bs) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)); return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }; };
  const clipsKids = (c) => CONTAINERS.has(c.type) && !isGroupish(c) && c.frameMaskDisabled !== true && c.type !== 'SECTION';
  function clipOfAncestors(P) {
    let r = null;
    for (let a = P; a; a = a.parent) { if (clipsKids(a.c)) { const b = absBox(a); r = r ? inter(r, b) : b; if (!r) return null; } if (isTop(a)) break; }
    return r;
  }
  function shapePathLocal(c) {
    const w = c.size?.x || 0, h = c.size?.y || 0;
    if (c.fillGeometry?.length) { const ds = c.fillGeometry.map((f) => blobs[f.commandsBlob]?.bytes).filter(Boolean).map(blobPath).filter(Boolean); if (ds.length) return ds.join(''); }
    if (c.vectorData && typeof c.vectorData.vectorNetworkBlob === 'number') { const net = networkOf(c); const d = net && (net.fills.length ? net.fills.map((x) => x.d).join('') : net.open); if (d) return d; }
    if (c.type === 'ELLIPSE') return ellipsePath(w, h);
    const r = c.cornerRadius || 0;
    return rrectPath(w, h, c.rectangleCornerRadiiIndependent
      ? [c.rectangleTopLeftCornerRadius, c.rectangleTopRightCornerRadius, c.rectangleBottomRightCornerRadius, c.rectangleBottomLeftCornerRadius] : [r, r, r, r]);
  }
  const imgUrl = (hh) => `http://img.local/${hh}`;
  let svgSeq = 0;
  const uniqIds = (svg) => { const pfx = `v${svgSeq++}_`; return svg.replace(/id="([^"]+)"/g, `id="${pfx}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pfx}$1)`); };
  function textHtml(c, w, h, fonts) {
    const fam = String(c.fontName?.family || 'Inter'), wt = WEIGHTS_CSS[weightOf(c.fontName?.style)] || 400, ital = /italic|oblique/i.test(c.fontName?.style || '');
    fonts.add(JSON.stringify([fam, ital ? 1 : 0, wt]));
    const fsz = c.fontSize || 12;
    const ps = visiblePaints(c.fillPaints), top = ps[ps.length - 1];
    let color = 'transparent', clipBg = '';
    if (top?.type === 'SOLID') color = rgbaCss(top.color, top.opacity ?? 1);
    else if (top?.type?.startsWith('GRADIENT')) clipBg = cssPaint(top, w, h, 1, images)?.match(/background:([^;]*);/)?.[1] || '';
    const sp = visiblePaints(c.strokePaints).find((q) => q.type === 'SOLID');
    const sw = sp ? c.strokeWeight || 0 : 0;
    const strokeCss = sw ? `-webkit-text-stroke:${r2(c.strokeAlign === 'OUTSIDE' ? sw * 2 : sw)}px ${rgbaCss(sp.color, sp.opacity ?? 1)};paint-order:stroke fill;` : '';
    const lh = c.lineHeight;
    const lhCss = !lh ? 'normal' : lh.units === 'PIXELS' ? `${r2(lh.value)}px` : lh.units === 'PERCENT' ? `${r4(lh.value / 100)}` : `${r4(lh.value)}`;
    const ls = c.letterSpacing ? (c.letterSpacing.units === 'PERCENT' ? (c.letterSpacing.value / 100) * fsz : c.letterSpacing.value) : 0;
    const xa = { CENTER: 'center', RIGHT: 'flex-end' }[c.textAlignHorizontal] || 'flex-start', ya = { CENTER: 'center', BOTTOM: 'flex-end' }[c.textAlignVertical] || 'flex-start';
    const one = c.textAutoResize === 'WIDTH_AND_HEIGHT' || (c.derivedTextData?.derivedLines?.length ?? 2) <= 1;
    return `<div style="position:absolute;inset:0;display:flex;align-items:${ya};justify-content:${xa};text-align:${xa === 'center' ? 'center' : xa === 'flex-end' ? 'right' : 'left'};`
      + `font-family:'${fam}','Inter',sans-serif;font-weight:${wt};font-style:${ital ? 'italic' : 'normal'};font-size:${r2(fsz)}px;line-height:${lhCss};letter-spacing:${r2(ls)}px;`
      + `color:${color};${strokeCss}white-space:${one ? 'pre' : 'pre-wrap'};">`
      + `<span style="${clipBg ? `background:${clipBg};-webkit-background-clip:text;background-clip:text;color:transparent;` : ''}">${escXml(caseOf(c.textData?.characters || '', c.textCase))}</span></div>`;
  }
  // F(n) -> 'full' | 'nofx' (pinturas sin efectos) | 'kids' (solo estructura: posición, recorte, opacidad) | 'none'
  function htmlNode(n, F, defs, fonts, clipD, docRoot) {
    const c = n.c;
    if (c.visible === false || SKIP.has(c.type)) return '';
    const mode = F(n);
    if (mode === 'none') return '';
    const w = c.size?.x || 0, h = c.size?.y || 0;
    const t = n === docRoot ? ID : relT(n);
    const plain = Math.abs(t.m00 - 1) < 1e-4 && Math.abs(t.m11 - 1) < 1e-4 && Math.abs(t.m01) < 1e-4 && Math.abs(t.m10) < 1e-4;
    let st = `position:absolute;width:${r2(w)}px;height:${r2(h)}px;` + (plain ? `left:${r4(t.m02)}px;top:${r4(t.m12)}px;`
      : `left:0;top:0;transform-origin:0 0;transform:matrix(${r4(t.m00)},${r4(t.m10)},${r4(t.m01)},${r4(t.m11)},${r4(t.m02)},${r4(t.m12)});`);
    if (clipD) st += `clip-path:path('${clipD}');`;
    if ((c.opacity ?? 1) < 1) st += `opacity:${r4(c.opacity)};`;
    const full = mode === 'full', paints = full || mode === 'nofx';
    if (full && BLEND[c.blendMode]) st += `mix-blend-mode:${BLEND[c.blendMode]};`;
    const partialArc = c.type === 'ELLIPSE' && c.arcData && (Math.abs((c.arcData.endingAngle || 0) - (c.arcData.startingAngle || 0) - 2 * Math.PI) > 0.01 || c.arcData.innerRadius > 0);
    if (VECTORISH.has(c.type) || partialArc) {
      if (!paints) return '';
      const d2 = [];
      const body = svgOf(n, true, d2);
      return `<div style="${st}">${uniqIds(`<svg width="${r2(w)}" height="${r2(h)}" style="position:absolute;left:0;top:0;overflow:visible">${d2.length ? `<defs>${d2.join('')}</defs>` : ''}${body}</svg>`)}</div>`;
    }
    if (full) {
      const Fx = fxFilter(c.effects, 1, 'h' + defs.length, w, h);
      if (Fx.used) { defs.push(Fx.svg); st += `filter:url(#${Fx.svg.match(/id="([^"]+)"/)[1]});`; }
    }
    let inner = '';
    if (paints && c.type === 'TEXT') inner += textHtml(c, w, h, fonts);
    else if (paints && !isGroupish(c)) {
      const layers = visiblePaints(c.fillPaints).map((q) => cssPaint(q, w, h, 1, images, imgUrl)).filter(Boolean).join('');
      if (layers) inner += `<div style="position:absolute;inset:0;border-radius:${radiusCss(c, w, h)};overflow:hidden;isolation:isolate">${layers}</div>`;
      inner += ringsHtml(c, w, h, 1, imgUrl).html;
    }
    if (n.kids.length && c.type !== 'TEXT') {
      let kh = '', maskD = null, soft = null, sh = '';
      for (const k of n.kids) {
        if (k.c.visible === false) continue;
        if (k.c.mask) {
          maskD = transformPath(shapePathLocal(k.c), relT(k));
          const T = relT(k);
          // máscara suave sin giro: capa CSS mask del tamaño de la máscara; lo de encima va dentro, desplazado
          if (softMask(k.c) && Math.abs(T.m01) < 1e-4 && Math.abs(T.m10) < 1e-4 && T.m00 > 0 && T.m11 > 0) {
            const mw = (k.c.size?.x || 0) * T.m00, mh = (k.c.size?.y || 0) * T.m11, css = maskCss(k.c, mw, mh, imgUrl);
            if (css) soft = `<div style="position:absolute;left:${r4(T.m02)}px;top:${r4(T.m12)}px;width:${r2(mw)}px;height:${r2(mh)}px;${css}">`
              + `<div style="position:absolute;left:${r4(-T.m02)}px;top:${r4(-T.m12)}px;width:${r2(w)}px;height:${r2(h)}px">`;
          }
          continue;
        }
        const one = htmlNode(k, F, defs, fonts, maskD ? transformPath(maskD, invert(relT(k))) : null, docRoot);
        if (soft) sh += one; else kh += one;
      }
      if (soft) kh += soft + sh + '</div></div>';
      inner += `<div style="position:absolute;inset:0;${clipsKids(c) ? `overflow:hidden;border-radius:${radiusCss(c, w, h)};` : ''}">${kh}</div>`;
    }
    return `<div style="${st}">${inner}</div>`;
  }
  const fontLinks = (fonts) => {
    const fam = {};
    for (const f of fonts) { const [nm, it, wt] = JSON.parse(f); (fam[nm] ||= new Set()).add(`${it},${wt}`); }
    return Object.entries(fam).map(([nm, set]) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(nm).replace(/%20/g, '+')}:ital,wght@${[...set].sort().join(';')}&display=block">`).join('');
  };
  const SCENE_M = 300;                                   // margen alrededor de la raíz (sombras que se salen)
  function sceneDoc(root, F, zoom) {
    svgSeq = 0;
    const defs = [], fonts = new Set();
    const body = htmlNode(root, F, defs, fonts, null, root);
    const w = root.c.size?.x || 0, h = root.c.size?.y || 0;
    return `<!doctype html><html><head><meta charset="utf-8">${fontLinks(fonts)}</head><body style="margin:0;background:transparent">`
      + `<svg width="0" height="0" style="position:absolute"><defs>${defs.join('')}</defs></svg>`
      + `<div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(${r4(zoom)})">`
      + `<div style="position:absolute;left:${SCENE_M}px;top:${SCENE_M}px;width:${r2(w)}px;height:${r2(h)}px">${body}</div></div></body></html>`;
  }
  const orderCache = new Map();
  function dfsOrder(root) {
    if (orderCache.has(root)) return orderCache.get(root);
    const m = new Map(); let i = 0;
    const w = (x) => { m.set(x, i++); x.kids.forEach(w); };
    w(root); orderCache.set(root, m);
    return m;
  }
  // unidad = capas que Roblox no puede componer solas -> una imagen:
  //  - máscara: las capas que la máscara recorta (normales: render aislado)
  //  - fusión de capa (OVERLAY, SOFT_LIGHT…): "desfusionado": se pinta la escena sin y con la capa y se despeja
  //    una imagen normal que, puesta encima de lo de debajo, da el mismo color que en Figma
  function unitNode(P, run, maskNode, mirror) {
    const root = rootOf(P);
    const blendIn = run.some((x) => has(x, (y) => !!BLEND[y.c.blendMode]));
    let rect = maskNode ? absBox(maskNode) : unionBox(run.map((x) => absBox(x, extentOf(x) + 1)));
    const anc = clipOfAncestors(P);
    if (anc) rect = inter(rect, anc);
    if (!rect || rect.w < 0.5 || rect.h < 0.5) return [];
    const order = dfsOrder(root);
    const unit = new Set();
    const addAll = (x) => { unit.add(x); x.kids.forEach(addAll); };
    run.forEach(addAll);
    const first = Math.min(...run.map((x) => order.get(x)));
    const up = new Set();
    for (let a = P; a; a = a.parent) { up.add(a); if (a === root) break; }
    const FR = blendIn
      ? (x) => (up.has(x) ? 'nofx' : unit.has(x) ? 'full' : order.get(x) < first ? 'full' : 'none')
      : (x) => (unit.has(x) ? 'full' : up.has(x) ? 'kids' : 'none');
    const FB = blendIn ? (x) => (up.has(x) ? 'nofx' : unit.has(x) ? 'none' : order.get(x) < first ? 'full' : 'none') : null;
    const zoom = Math.min(s, 512 / Math.max(rect.w, rect.h, 1));
    const html = sceneDoc(root, FR, zoom), htmlB = FB ? sceneDoc(root, FB, zoom) : null;
    const rel = `${IMG_REL}/${crypto.createHash('sha1').update(html + (htmlB || '')).digest('hex')}.png`;
    const W = root.c.size?.x || 0, H = root.c.size?.y || 0;
    jobs.push({ kind: 'scene', html, htmlB, rel, images,
      clip: { x: (rect.x + SCENE_M) * zoom, y: (rect.y + SCENE_M) * zoom, w: rect.w * zoom, h: rect.h * zoom },
      vw: Math.ceil((W + SCENE_M * 2) * zoom) + 2, vh: Math.ceil((H + SCENE_M * 2) * zoom) + 2 });
    const pb = P === root ? { x: 0, y: 0 } : absBox(P);
    let x = rect.x - pb.x;
    if (mirror) x = (P.c.size?.x || 0) - x - rect.w;    // el padre en espejo refleja la posición de sus hijos en Roblox
    const name = maskNode ? cleanName(maskNode.c.name) + 'Masked' : cleanName(run[0].c.name);
    return [{ ClassName: 'ImageLabel', Name: name, props: { BackgroundTransparency: 1, Image: rel, ScaleType: 'Stretch',
      Position: [0, r2(x * s), 0, r2((rect.y - pb.y) * s)], Size: [0, r2(rect.w * s), 0, r2(rect.h * s)] } }];
  }
  // hijos de un contenedor: las máscaras recortan todo lo que tienen encima; las capas con fusión se hornean contra lo de debajo
  function convKids(n, kids, mirror, lb, extra = {}) {   // extra.base = color de lo que queda debajo
    const out = [];
    // lo que hay debajo de cada capa = la última hermana opaca que cubre su centro (si ninguna, lo del padre)
    const pbase = extra.base || GRAY, unders = [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i], q = local(k.c), cx = q.x + q.w / 2, cy = q.y + q.h / 2;
      const hit = unders.findLast((u) => cx >= u.x && cx <= u.x + u.w && cy >= u.y && cy <= u.y + u.h);
      extra = { ...extra, base: hit ? hit.rgb : pbase };
      if (k.c.visible !== false && !k.c.mask && !BLEND[k.c.blendMode] && (SHAPES.has(k.c.type) || CONTAINERS.has(k.c.type))) { const f = fillRgb(k.c); if (f) unders.push({ ...q, rgb: f }); }
      if (k.c.mask) {
        const run = kids.slice(i + 1).filter((x) => x.c.visible !== false);
        if (run.length) out.push(...((!opts.flat && clipUnit(n, run, k, mirror, lb, extra.base)) || unitNode(n, run, k, mirror)));
        break;
      }
      if (BLEND[k.c.blendMode]) {
        if (!opts.flat && blendable(k) && (SHAPES.has(k.c.type) || CONTAINERS.has(k.c.type)) && !liveFx(k.c).length) { out.push(...conv(k, n, mirror, { ...extra, blend: k.c.blendMode })); continue; }
        out.push(...unitNode(n, [k], null, mirror)); continue;
      }
      out.push(...conv(k, n, mirror, { ...extra, blend: lb }));
    }
    return out;
  }

  // ---------- auto-layout de Figma -> UIListLayout / UIGridLayout + UIPadding (+ UIFlexItem)
  // Cada hijo ocupa su hueco exacto de Figma; si genera varias capas (sombra, halo) o un PNG con margen (iconos),
  // va dentro de un Frame transparente del tamaño del hueco para que la lista mida lo mismo que Figma.
  function autoLayout(n, kids, mirror, tags, lb, base) {
    const c = n.c;
    if (!stackOn(c) || tags.has('absolute') || tags.has('nolayout') || opts.autoLayout === false) return null;
    const nm = cleanName(c.name);
    if (mirror) { warn.add(`Auto-layout "${nm}" en espejo -> posiciones fijas`); return null; }
    const flow = [], abs = [];
    for (const k of kids) (k.c.stackPositioning === 'ABSOLUTE' ? abs : flow).push(k);
    if (flow.some((k) => k.c.mask || BLEND[k.c.blendMode] || Math.abs(local(k.c).rot) > 0.05)) {
      warn.add(`Auto-layout "${nm}": tiene máscaras, fusiones de capa o capas giradas -> posiciones fijas`);
      return null;
    }
    const S = (v) => r2((v || 0) * s);
    const pl = c.stackHorizontalPadding ?? c.stackPadding ?? 0, pt = c.stackVerticalPadding ?? c.stackPadding ?? 0;
    const pr = c.stackPaddingRight ?? pl, pb = c.stackPaddingBottom ?? pt;
    const horiz = c.stackMode === 'HORIZONTAL';
    let lay, order = flow;
    if (c.stackMode === 'GRID') {
      const gs = flow.map((k) => local(k.c));
      if (!gs.length || gs.some((q) => Math.abs(q.w - gs[0].w) > 0.5 || Math.abs(q.h - gs[0].h) > 0.5)) {
        warn.add(`Cuadrícula "${nm}": celdas de distinto tamaño -> posiciones fijas (UIGridLayout usa una sola)`);
        return null;
      }
      const cols = new Set(gs.map((q) => Math.round(q.x))).size;
      order = flow.map((k, i) => [k, gs[i]]).sort((a, b) => (Math.round(a[1].y) - Math.round(b[1].y)) || a[1].x - b[1].x).map((x) => x[0]);
      lay = { ClassName: 'UIGridLayout', Name: 'UIGridLayout', props: { CellSize: [0, S(gs[0].w), 0, S(gs[0].h)],
        CellPadding: [0, S(c.gridColumnGap ?? c.stackSpacing), 0, S(c.gridRowGap ?? c.stackCounterSpacing ?? c.stackSpacing)],
        FillDirection: 'Horizontal', FillDirectionMaxCells: cols, SortOrder: 'LayoutOrder' } };
    } else {
      const J = c.stackPrimaryAlignItems || 'MIN', A = c.stackCounterAlignItems || 'MIN';
      const main = { MIN: horiz ? 'Left' : 'Top', CENTER: 'Center', MAX: horiz ? 'Right' : 'Bottom' };
      const cross = { MIN: horiz ? 'Top' : 'Left', CENTER: 'Center', MAX: horiz ? 'Bottom' : 'Right', BASELINE: horiz ? 'Bottom' : 'Left' };
      const flex = { SPACE_BETWEEN: 'SpaceBetween', SPACE_EVENLY: 'SpaceEvenly', SPACE_EVENLY_CSS: 'SpaceEvenly', SPACE_AROUND: 'SpaceAround' }[J];
      const props = { FillDirection: horiz ? 'Horizontal' : 'Vertical', SortOrder: 'LayoutOrder', Padding: [0, flex ? 0 : S(c.stackSpacing)] };
      if (horiz) { props.HorizontalAlignment = main[J] || 'Left'; props.VerticalAlignment = cross[A] || 'Top'; }
      else { props.VerticalAlignment = main[J] || 'Top'; props.HorizontalAlignment = cross[A] || 'Left'; }
      if (flex) props[horiz ? 'HorizontalFlex' : 'VerticalFlex'] = flex;
      if (c.stackWrap === 'WRAP') {
        props.Wraps = true;
        if (c.stackCounterSpacing != null && Math.abs(c.stackCounterSpacing - (c.stackSpacing || 0)) > 0.5) warn.add(`Auto-layout "${nm}": separación entre filas distinta a la de elementos (Roblox usa una sola)`);
      }
      lay = { ClassName: 'UIListLayout', Name: 'UIListLayout', props };
    }
    const mods = [lay];
    if (pl || pt || pr || pb) mods.push({ ClassName: 'UIPadding', Name: 'UIPadding', props: { PaddingLeft: [0, S(pl)], PaddingRight: [0, S(pr)], PaddingTop: [0, S(pt)], PaddingBottom: [0, S(pb)] } });
    const items = [];
    order.forEach((k, i) => {
      const outs = conv(k, n, false, { inLayout: true, blend: lb, base });
      if (!outs.length) return;
      const q = local(k.c), bx = { x: q.x * s, y: q.y * s, w: q.w * s, h: q.h * s };
      const main = outs[outs.length - 1], p = main.props || {};
      const near = (a, b) => Math.abs(a - b) < 0.6;
      let item;
      if (outs.length === 1 && Array.isArray(p.Position) && near(p.Position[1], bx.x) && near(p.Position[3], bx.y) && near(p.Size[1], bx.w) && near(p.Size[3], bx.h)) {
        item = main; delete p.Position;
      } else {
        item = { ClassName: 'Frame', Name: main.Name, props: { BackgroundTransparency: 1, Size: [0, r2(bx.w), 0, r2(bx.h)] },
          children: outs.map((o) => { if (o.props?.Position) { o.props.Position[1] = r2(o.props.Position[1] - bx.x); o.props.Position[3] = r2(o.props.Position[3] - bx.y); } return o; }) };
      }
      item.props.LayoutOrder = i + 1;
      if (c.stackReverseZIndex) item.props.ZIndex = order.length - i + 1;
      const grow = (k.c.stackChildPrimaryGrow || 0) > 0, stretch = k.c.stackChildAlignSelf === 'STRETCH';
      if (lay.ClassName === 'UIListLayout' && (grow || stretch)) {
        (item.children ||= []).push({ ClassName: 'UIFlexItem', Name: 'UIFlexItem', props: { ...(grow ? { FlexMode: 'Fill' } : {}), ...(stretch ? { ItemLineAlignment: 'Stretch' } : {}) } });
      }
      items.push(item);
    });
    const auto = [];
    if (/^RESIZE_TO_FIT/.test(c.stackPrimarySizing || '')) auto.push(horiz ? 'X' : 'Y');
    if (/^RESIZE_TO_FIT/.test(c.stackCounterSizing || '')) auto.push(horiz ? 'Y' : 'X');
    return { mods, items: uniqueNames(items), abs: abs.flatMap((k) => conv(k, n, mirror, { blend: lb, base })), autoSize: auto.length === 2 ? 'XY' : auto[0] || null, pad: { r: S(pr), b: S(pb) } };
  }
  // extensión del contenido de Figma (para el CanvasSize de un scroll)
  const kidsExtent = (kids) => { let w = 0, h = 0; for (const k of kids) { const q = local(k.c); w = Math.max(w, (q.x + q.w) * s); h = Math.max(h, (q.y + q.h) * s); } return { w, h }; };
  // hijos de un contenedor ya convertido: fondos propios (bg) + contenido (auto-layout o posiciones fijas) + scroll
  // -> { kids, mods, props } para el nodo
  function containerKids(n, kids, mirror, tags, bg, g, lb, base) {
    const c = n.c;
    const dir = scrollOf(c, tags);
    const fixed = dir ? kids.filter((k) => k.c.scrollBehavior === 'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME') : [];
    const flowKids = fixed.length ? kids.filter((k) => !fixed.includes(k)) : kids;
    const L = autoLayout(n, flowKids, mirror, tags, lb, base);
    const wrapContent = () => ({ ClassName: 'Frame', Name: 'Content', props: { BackgroundTransparency: 1, Size: [1, 0, 1, 0] }, children: [...L.mods, ...L.items] });
    if (!dir) {
      if (!L) return { kids: [...bg, ...convKids(n, flowKids, mirror, lb, { base })], mods: [], props: {} };
      if (!bg.length && !L.abs.length) return { kids: L.items, mods: L.mods, props: L.autoSize ? { AutomaticSize: L.autoSize } : {} };
      return { kids: [...bg, wrapContent(), ...L.abs], mods: [], props: {} };
    }
    // scroll: el fondo queda fuera; el contenido va dentro de un ScrollingFrame del tamaño del marco
    const ext = kidsExtent(flowKids);
    if (L) { ext.w += L.pad.r; ext.h += L.pad.b; }
    const sp = { BackgroundTransparency: 1, Size: [1, 0, 1, 0], ScrollingDirection: dir, ScrollBarThickness: 4, ScrollBarImageColor3: '#FFFFFF',
      ScrollBarImageTransparency: 0.4, ElasticBehavior: 'WhenScrollable',
      CanvasSize: [dir === 'Y' ? 1 : 0, dir === 'Y' ? 0 : r2(Math.max(ext.w, g.w)), dir === 'X' ? 1 : 0, dir === 'X' ? 0 : r2(Math.max(ext.h, g.h))] };
    let inner;
    if (!L) inner = convKids(n, flowKids, mirror, lb, { base });
    else if (L.abs.length) inner = [wrapContent(), ...L.abs];
    else { inner = [...L.mods, ...L.items]; sp.AutomaticCanvasSize = dir; }
    const sf = { ClassName: 'ScrollingFrame', Name: 'Scroll', props: sp, children: inner };
    return { kids: [...bg, sf, ...convKids(n, fixed, mirror, lb, { base })], mods: [], props: { ClipsDescendants: true } };
  }
  // [flatten] / [image] / [png]: toda la capa (con sus hijos) a una sola imagen, pintada como en Figma
  function flattenNode(n, parent, pmirror) {
    if (parent) return unitNode(parent, [n], null, pmirror);
    const out = unitNode(n, [n], null, false), q = local(n.c);
    for (const x of out) { x.props.Position[1] = r2(x.props.Position[1] + q.x * s); x.props.Position[3] = r2(x.props.Position[3] + q.y * s); }
    return out;
  }
  const toButton = (node) => {
    if (/Button$/.test(node.ClassName)) return true;
    if (node.ClassName === 'Frame') { node.ClassName = 'TextButton'; node.props.Text = ''; return true; }
    if (node.ClassName === 'ImageLabel') { node.ClassName = 'ImageButton'; return true; }
    if (node.ClassName === 'TextLabel') { node.ClassName = 'TextButton'; return true; }
    return false;
  };

  // ---------- nodo
  // límites de tamaño y proporción de Figma (auto-layout: min/max ancho-alto, «aspect ratio») -> UISizeConstraint / UIAspectRatioConstraint
  function conv(n, parent, pmirror = false, ctx = {}) {
    const outs = conv0(n, parent, pmirror, ctx), c = n.c;
    const mn = c.minSize?.value, mx = c.maxSize?.value, ar = c.targetAspectRatio?.value;
    if (!outs.length || !(mn || mx || ar)) return outs;
    const main = [...outs].reverse().find((o) => o.ClassName !== 'UICorner' && !/Shadow|Glow$/.test(o.Name || '')) || outs[outs.length - 1];
    const kids = (main.children ||= []);
    if (mn || mx) {
      const V = (v, d) => [v && v.x > 0 ? r2(v.x * s) : d, v && v.y > 0 ? r2(v.y * s) : d];
      kids.unshift({ ClassName: 'UISizeConstraint', Name: 'UISizeConstraint', props: { MinSize: V(mn, 0), MaxSize: V(mx, 1e9) } });
    }
    // (las imágenes traen la proporción siempre: solo cuenta donde el tamaño cambia, dentro de un auto-layout)
    if (ar && ar.x > 0 && ar.y > 0 && ctx.inLayout) kids.unshift({ ClassName: 'UIAspectRatioConstraint', Name: 'UIAspectRatioConstraint', props: { AspectRatio: r4(ar.x / ar.y) } });
    return outs;
  }
  function conv0(n, parent, pmirror = false, ctx = {}) {
    const c = n.c;
    if (c.visible === false || SKIP.has(c.type)) return [];
    if (c.mask) return [];                          // una máscara sola no se pinta (convKids recorta lo de encima)
    const tags = tagsOf(c);
    if (tags.has('ignore') || tags.has('skip')) return [];
    let g = local(c);
    // hijos de grupos guardados en el espacio del padre del grupo
    if (parent && parent.c.type === 'GROUP' && !kidsInOwnSpace(parent)) { const pg = local(parent.c); g = { ...g, x: g.x - pg.x, y: g.y - pg.y }; }
    // padre en espejo: la capa se refleja dentro de él (x y rotación) y su contenido se voltea una vez más
    if (pmirror && parent) { g = { ...g, x: (parent.c.size?.x || 0) - g.x - g.w, rot: -g.rot }; }
    const mirror = g.flip !== pmirror;
    g = { x: g.x * s, y: g.y * s, w: g.w * s, h: g.h * s, rot: g.rot, mirror };
    const name = cleanName(c.name);
    const proto = interactionsOf(c);
    const out = tags.has('flatten') || tags.has('image') || tags.has('png') || tags.has('raster') || (opts.flattenAll && !parent) ? flattenNode(n, parent, pmirror)
      : convBody(n, g, mirror, name, tags, ctx.blend || null, ctx.base || GRAY);
    const node = out[out.length - 1];
    if (node) {
      const wantBtn = proto.button || tags.has('button') || tags.has('btn');
      if (wantBtn && !toButton(node)) warn.add(`"${name}": un ${node.ClassName} no puede ser botón en Roblox (quita la opacidad de grupo)`);
      if (/Button$/.test(node.ClassName) && wantBtn) node.buttonFx = node.buttonFx || { hover: 1.06, press: 0.9 };
      if (proto.list.length) node.interactions = proto.list;
      if (tags.has('hidden') || tags.has('hide')) node.props.Visible = false;
      const ca = componentAttrs(c);
      if (ca) node.attributes = { ...(node.attributes || {}), ...ca };
      node._fk = key(c.guid);
    }
    // restricciones respecto al marco padre (no dentro de auto-layout, grupos, scroll ni espejo)
    if (parent && !ctx.inLayout && !ctx.noConstrain && !pmirror && !isGroupish(parent.c) && CONTAINERS.has(parent.c.type) && !scrollOf(parent.c, tagsOf(parent.c))
      && !(stackOn(parent.c) && c.stackPositioning !== 'ABSOLUTE' && opts.autoLayout !== false)) {
      constrain(out, c, (parent.c.size?.x || 0) * s, (parent.c.size?.y || 0) * s);
    }
    return out;
  }
  function convBody(n, g, mirror, name, tags, lb, under = GRAY) {
    const c = n.c;
    let node, glow = null;
    if (c.type === 'TEXT') {
      const kind = textFxKind(c);
      // texto en espejo: Roblox no puede voltear texto (y un espejo vertical = horizontal + 180°, saldría boca abajo) -> imagen, igual que en Figma
      if (kind === 'image' || mirror) node = bakeText(n, g, false);
      else { node = textNode(n, g); if (kind === 'glow') glow = bakeText(n, g, true); }
    }
    else if (VECTORISH.has(c.type) || isIconUnit(n) || (c.type === 'ELLIPSE' && (Math.abs(g.w - g.h) > 0.5 || c.arcData && (Math.abs((c.arcData.endingAngle || 0) - (c.arcData.startingAngle || 0) - 2 * Math.PI) > 0.01 || c.arcData.innerRadius > 0)))) node = iconNode(n, g, name);
    else if (!isGroupish(c) && c.type !== 'SECTION' && !tags.has('native') && bakeWhole(c)) {
      // fondo horneado (fusiones, texturas, sombras difuminadas…); los hijos siguen nativos encima
      const kids = n.kids.filter((k) => k.c.visible !== false);
      const op = c.opacity ?? 1;
      const btn = BUTTON_RE.test(c.name || '');
      const { rel, pad } = bake(c, g.w, g.h, mirror);
      const rot = g.rot && Math.abs(g.rot) > 0.05 ? { Rotation: r2(g.rot) } : {};
      const bg = { BackgroundTransparency: 1, Image: rel, ScaleType: 'Stretch' };
      if (!kids.length) {
        node = { ClassName: btn ? 'ImageButton' : 'ImageLabel', Name: name, props: { ...bg, ...(op < 0.98 ? { ImageTransparency: r4(1 - op) } : {}),
          Position: [0, r2(g.x - pad), 0, r2(g.y - pad)], Size: [0, r2(g.w + pad * 2), 0, r2(g.h + pad * 2)], ...rot } };
      } else {
        const props = { Position: [0, r2(g.x), 0, r2(g.y)], Size: [0, r2(g.w), 0, r2(g.h)], BackgroundTransparency: 1, ...rot };
        if (op < 0.98 && !btn) props.GroupTransparency = r4(1 - op);
        if (btn) props.Text = '';
        if (c.frameMaskDisabled === false && pad <= 2) props.ClipsDescendants = true;
        const K = containerKids(n, kids, mirror, tags, [{ ClassName: 'ImageLabel', Name: 'Background', props: { ...bg, Position: [0, -pad, 0, -pad], Size: [1, pad * 2, 1, pad * 2] } }], g, lb, fillRgb(c) || under);
        Object.assign(props, K.props);
        node = { ClassName: btn ? 'TextButton' : op < 0.98 ? 'CanvasGroup' : 'Frame', Name: name, props, children: [...K.mods, ...uniqueNames(K.kids)] };
      }
      if (btn) node.buttonFx = { hover: 1.06, press: 0.9 };
      return [node];
    } else {
      const kids = n.kids.filter((k) => k.c.visible !== false);
      const op = c.opacity ?? 1;
      const group = op < 0.98 && kids.length;
      const btn = BUTTON_RE.test(c.name || '') && !isGroupish(c);
      const props = { Position: [0, r2(g.x), 0, r2(g.y)], Size: [0, r2(g.w), 0, r2(g.h)] };
      if (g.rot && Math.abs(g.rot) > 0.05) props.Rotation = r2(g.rot);
      const mods = [], extra = [];
      const corner = cornerOf(c, g.w, g.h);
      if (corner) mods.push(corner);
      if (isGroupish(c) || c.type === 'SECTION') props.BackgroundTransparency = 1;
      let own = under;
      if (opts.flat) fillProps(c, props, mods, extra, group ? 1 : op, corner, mirror);
      else if (!(isGroupish(c) || c.type === 'SECTION')) own = fillLayers(c, props, mods, extra, group ? 1 : op, corner, mirror, g.w, g.h, lb, under);
      const st = isGroupish(c) ? null : strokeOf(c, false, !!corner, lb, own); if (st) mods.push(st);
      if (CONTAINERS.has(c.type) && !isGroupish(c) && c.frameMaskDisabled !== true && kids.length && c.type !== 'SECTION') props.ClipsDescendants = true;
      if (group) props.GroupTransparency = r4(1 - op);
      const cls = btn ? 'TextButton' : group ? 'CanvasGroup' : 'Frame';
      if (btn) props.Text = '';
      if (group && btn) warn.add(`"${name}": botón semitransparente -> opacidad aplicada solo al fondo`);
      const K = containerKids(n, kids, mirror, tags, extra, g, lb, own);
      mods.push(...K.mods); Object.assign(props, K.props);
      const children = uniqueNames(K.kids);
      node = { ClassName: btn && group ? 'TextButton' : cls, Name: name, props, children: [...mods, ...children] };
      if (btn && group) { delete props.GroupTransparency; props.BackgroundTransparency = r4(Math.max(props.BackgroundTransparency || 0, 1 - op)); }
      if (btn) node.buttonFx = { hover: 1.06, press: 0.9 };
      if (!node.children.length) delete node.children;
    }
    if (glow) return [glow, node];
    const shs = /^Image/.test(node.ClassName) ? [] : shadowsOf(c, node, g);
    return [...shs, node];
  }

  // ---------- raíces
  let out = [], bbox;
  if (mode === 'screen') {
    const r = roots[0];
    const ps = visiblePaints(r.c.fillPaints);
    if (ps.length && ps[ps.length - 1].type === 'SOLID') bgHex = hex(ps[ps.length - 1].color);
    out = uniqueNames(convKids(r, r.kids.filter((k) => k.c.visible !== false), false));
    bbox = { w: stageW, h: stageH };
  } else {
    const gs = roots.map((r) => local(r.c));
    const ux = Math.min(...gs.map((g) => g.x)), uy = Math.min(...gs.map((g) => g.y));
    bbox = { w: r2((Math.max(...gs.map((g) => g.x + g.w)) - ux) * s), h: r2((Math.max(...gs.map((g) => g.y + g.h)) - uy) * s) };
    for (const r of roots) {
      const ns = conv(r, null);
      for (const x of ns) { const p = x.props.Position; p[1] = r2(p[1] - ux * s); p[3] = r2(p[3] - uy * s); }
      out.push(...ns);
    }
    out = uniqueNames(out);
  }
  // destinos de prototipo: empiezan ocultos (se abren con su botón), salvo la primera pantalla copiada
  const firstKey = mode === 'screen' ? null : key(roots[0].c.guid);
  let hidden = 0;
  const fin = (l) => {
    for (const x of l) {
      if (x._fk && protoTargets.has(x._fk) && x._fk !== firstKey && x.props && x.props.Visible !== false) { x.props.Visible = false; hidden++; }
      delete x._fk;
      if (x.children) fin(x.children);
    }
  };
  fin(out);
  if (hidden) warn.add(`${hidden} ventana(s) del prototipo empiezan ocultas: se abren con su botón`);
  const imgs = await rasterize(jobs);
  let count = 0; const walk = (l) => { for (const x of l) { count++; if (x.children) walk(x.children); } }; walk(out);
  return { mode, scale: r4(s), bbox, background: bgHex, nodes: out, warn: [...warn], rendered: imgs, images: savedImages.size, count, ...(opts.debug ? { jobs } : {}) };
}

// comandos de trazado de Figma: 0 separador, 1 M, 2 L, 3 Z, 4 C (float32 LE)
function blobPath(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0; const out = [];
  const f = () => { const v = dv.getFloat32(i, true); i += 4; return r2(v); };
  while (i < bytes.length) {
    const cmd = bytes[i++];
    if (cmd === 0) continue;
    if (cmd === 1) out.push(`M${f()} ${f()}`);
    else if (cmd === 2) out.push(`L${f()} ${f()}`);
    else if (cmd === 3) out.push('Z');
    else if (cmd === 4) out.push(`C${f()} ${f()} ${f()} ${f()} ${f()} ${f()}`);
    else if (cmd === 5) out.push(`Q${f()} ${f()} ${f()} ${f()}`);
    else break;
  }
  return out.length ? out.join('') : null;
}

// Varios canales (y varias paradas si debajo hay un degradado): una sola capa gris tiene que parecerse a la fusión en todos.
// Se iguala el cambio de LUMINOSIDAD (lo que se ve como textura/brillo), pesando cada canal por cuánto lo mueve la fusión;
// la media simple de factores oscurecía/texturizaba de más los colores saturados. Con un solo canal = nfac1.
const LUMW = [0.2126, 0.7152, 0.0722];
function nfac(mode, B) {
  let nw = 0, dw = 0, nb = 0, db = 0;
  for (const col of B.all?.length ? B.all : [B]) [col.r, col.g, col.b].forEach((x, i) => {
    const C = Math.min(0.97, Math.max(0.03, x)), L = LUMW[i];
    const gw = mode === 'split1' ? 2 * (Math.sqrt(C) - C) : 2 * Math.min(C, 1 - C), gb = mode === 'split1' ? 2 * C * (1 - C) : 2 * Math.min(C, 1 - C);
    nw += L * gw; dw += L * (1 - C); nb += L * gb; db += L * C;
  });
  return { w: nw / dw, b: nb / db };
}
// pintura con fusión -> capa normal de luces (blanco) y sombras (negro) con alfa; ver NEUTRAL en convertFigma
const darkRel = (rel) => rel.replace(/\.png$/, '_d.png');
async function neutralize(page, rel, nz) {
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, rel)).toString('base64');
  if (nz.tint) {   // tinte exacto: dos máscaras blancas; el color lo pone ImageColor3 (luces = blend(C,1), sombras = blend(C,0))
    const [lb, db] = await page.evaluate(async ([src, op]) => {
      const im = new Image(); im.src = src; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
      const out = [];
      for (const light of [true, false]) {
        const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3] / 255, l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          const al = light ? Math.max(0, 2 * l - 1) : Math.max(0, 1 - 2 * l);
          d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(Math.min(1, al * a * op) * 255);
        }
        const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
        c2.getContext('2d').putImageData(img, 0, 0);
        out.push(c2.toDataURL('image/png').split(',')[1]);
      }
      return out;
    }, [src, nz.op ?? 1]);
    fs.writeFileSync(path.join(ROOT, rel), Buffer.from(lb, 'base64'));
    fs.writeFileSync(path.join(ROOT, darkRel(rel)), Buffer.from(db, 'base64'));
    return;
  }
  const b64 = await page.evaluate(async ([src, mode, op, f]) => {
    const im = new Image(); im.src = src; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
    const img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255; if (!a) continue;
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      let v, al;
      if (mode === 'dark') { v = 0; al = 1 - l; } else if (mode === 'light') { v = 255; al = l; } else if (l >= 0.5) { v = 255; al = Math.min(1, (l - 0.5) * f.w); } else { v = 0; al = Math.min(1, (0.5 - l) * f.b); }
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(Math.min(1, al * a * op) * 255);
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png').split(',')[1];
  }, [src, nz.mode, nz.op ?? 1, nfac(nz.mode, nz.base || { r: 0.5, g: 0.5, b: 0.5 })]);
  fs.writeFileSync(path.join(ROOT, rel), Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------- texturas: máscaras sin color, compartidas (ver fills.js)
// misma imagen + recorte + ajustes + espejo = mismo PNG para todas las piezas (el color va en ImageColor3/UIGradient)
export function maskRel(spec, kind) {
  const f = FL.filterCss(spec.filter), crop = spec.crop || null, m = !!spec.mirror;
  if (kind === 'orig' && !f && !crop && !m) return spec.src;
  const base = path.basename(spec.src).replace(/\.[^.]+$/, '');
  return `${IMG_REL}/${base}_${crypto.createHash('sha1').update(JSON.stringify([f, crop, m])).digest('hex').slice(0, 8)}_${kind}.png`;
}
export function maskJobs(spec, jobs) {
  const out = {};
  for (const k of FL.kindsOf(spec.blend)) {
    const rel = out[k] = maskRel(spec, k);
    if (rel !== spec.src) jobs.push({ kind: 'mask', src: spec.src, rel, filter: FL.filterCss(spec.filter), crop: spec.crop || null, mirror: !!spec.mirror, part: k });
  }
  return out;
}
// el editor cambia una receta (fusión, ajustes, imagen…) -> máscaras nuevas
export async function fillMasks(spec) {
  if (!spec?.src || /\.\./.test(spec.src) || /^[\\/]/.test(spec.src) || !fs.existsSync(path.join(ROOT, spec.src))) throw new Error('imagen de la textura no encontrada: ' + spec?.src);
  const jobs = [], masks = maskJobs(spec, jobs);
  await rasterize(jobs);
  return masks;
}

// ---------------------------------------------------------------- SVG -> PNG (Chrome headless, una sola sesión)
export async function rasterize(jobs) {
  const todo = jobs.filter((j, i) => !fs.existsSync(path.join(ROOT, j.rel)) && jobs.findIndex((x) => x.rel === j.rel) === i);
  if (!todo.length) return 0;
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const browser = await require('./browser.cjs').launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2 });
    // imágenes de Figma servidas por URL virtual en los renders de escena
    const store = new Map();
    for (const j of todo) if (j.images) for (const [k, v] of j.images) store.set(k, v);
    await page.route('http://img.local/**', (route) => {
      const hh = route.request().url().split('/').pop(), b = store.get(hh);
      if (!b) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: Buffer.from(b), contentType: imageDims(Buffer.from(b)).mime });
    });
    const loadAll = async () => page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set();
      for (const el of document.querySelectorAll('*')) for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?(.*?)"?\)/g)) urls.add(m[1]);
      await Promise.all([...urls].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));
    });
    for (const j of todo) {
      if (j.kind === 'scene') {
        await page.setViewportSize({ width: Math.max(16, j.vw), height: Math.max(16, j.vh) });
        const shot = async (html) => {
          await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
          await loadAll();
          return page.screenshot({ clip: { x: j.clip.x, y: j.clip.y, width: Math.max(1, j.clip.w), height: Math.max(1, j.clip.h) }, omitBackground: true });
        };
        const R = await shot(j.html);
        if (!j.htmlB) { fs.writeFileSync(path.join(ROOT, j.rel), R); continue; }
        const B = await shot(j.htmlB);
        // desfusionado: imagen L tal que "L encima de B" = R (alfa mínimo si el fondo es opaco)
        const b64 = await page.evaluate(async ([r64, b64in]) => {
          const load = (b) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + b; });
          const [ri, bi] = await Promise.all([load(r64), load(b64in)]);
          const W = ri.width, H = ri.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          const cx = cv.getContext('2d', { willReadFrequently: true });
          cx.drawImage(bi, 0, 0); const Bd = cx.getImageData(0, 0, W, H).data;
          cx.clearRect(0, 0, W, H); cx.drawImage(ri, 0, 0);
          const img = cx.getImageData(0, 0, W, H), Rd = img.data;
          for (let i = 0; i < Rd.length; i += 4) {
            const ba = Bd[i + 3] / 255, ra = Rd[i + 3] / 255;
            let la = 0;
            if (ba < 0.996) la = Math.max(0, Math.min(1, (ra - ba) / (1 - ba)));
            if (ba >= 0.996 || la < 1) {
              for (let k = 0; k < 3; k++) {
                const bc = Bd[i + k] / 255, rc = Rd[i + k] / 255;
                const need = rc > bc + 1e-3 ? (rc - bc) / Math.max(1e-3, 1 - bc) : rc < bc - 1e-3 ? (bc - rc) / Math.max(1e-3, bc) : 0;
                if (ba >= 0.996 && need > la) la = Math.min(1, need);
              }
            }
            if (la < 0.006) { Rd[i] = Rd[i + 1] = Rd[i + 2] = Rd[i + 3] = 0; continue; }
            for (let k = 0; k < 3; k++) {
              const lc = (Rd[i + k] * ra - (1 - la) * Bd[i + k] * ba) / la;
              Rd[i + k] = Math.max(0, Math.min(255, Math.round(lc)));
            }
            Rd[i + 3] = Math.round(la * 255);
          }
          cx.putImageData(img, 0, 0);
          return cv.toDataURL('image/png').split(',')[1];
        }, [R.toString('base64'), B.toString('base64')]);
        fs.writeFileSync(path.join(ROOT, j.rel), Buffer.from(b64, 'base64'));
        continue;
      }
      if (j.kind !== 'scene') await page.setViewportSize({ width: 1100, height: 1100 });
      if (j.kind === 'mask') {
        const buf = fs.readFileSync(path.join(ROOT, j.src)), d = imageDims(buf);
        const b64 = await page.evaluate(async ([src, filter, crop, mirror, part]) => {
          const im = new Image(); im.src = src; await im.decode();
          const W = im.naturalWidth, H = im.naturalHeight;
          const [sx, sy, sw, sh] = crop ? [crop[0] * W, crop[1] * H, crop[2] * W, crop[3] * H] : [0, 0, W, H];
          const k = Math.min(1, 1024 / Math.max(sw, sh, 1));
          const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
          const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
          if (mirror) { cx.translate(cv.width, 0); cx.scale(-1, 1); }
          if (filter) cx.filter = filter;
          cx.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
          if (part !== 'orig') {
            const img = cx.getImageData(0, 0, cv.width, cv.height), p = img.data;
            for (let i = 0; i < p.length; i += 4) {
              const a = p[i + 3] / 255, l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
              const al = part === 'hi' ? Math.max(0, 2 * l - 1) : part === 'lo' ? Math.max(0, 1 - 2 * l) : part === 'lum' ? l : 1 - l;
              p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = Math.round(al * a * 255);
            }
            cx.putImageData(img, 0, 0);
          }
          return cv.toDataURL('image/png').split(',')[1];
        }, [`data:${d.mime || 'image/png'};base64,${buf.toString('base64')}`, j.filter || '', j.crop, !!j.mirror, j.part]);
        fs.writeFileSync(path.join(ROOT, j.rel), Buffer.from(b64, 'base64'));
        continue;
      }
      if (j.kind === 'img') {
        const b64 = await page.evaluate(async ([src, mirror, filter]) => {
          const im = new Image(); im.src = src; await im.decode();
          const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
          const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
          const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high';
          if (mirror) { cx.translate(cv.width, 0); cx.scale(-1, 1); }
          if (filter) cx.filter = filter;
          cx.drawImage(im, 0, 0, cv.width, cv.height);
          return cv.toDataURL('image/png').split(',')[1];
        }, [j.data, !!j.mirror, j.filter || '']);
        fs.writeFileSync(path.join(ROOT, j.rel), Buffer.from(b64, 'base64'));
        if (j.neutral) await neutralize(page, j.rel, j.neutral);
        continue;
      }
      if (j.kind === 'html') {
        await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${j.markup}</body></html>`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => {
          const urls = new Set();
          for (const el of document.querySelectorAll('*')) for (const m of getComputedStyle(el).backgroundImage.matchAll(/url\("?(.*?)"?\)/g)) urls.add(m[1]);
          await Promise.all([...urls].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));
        });
        await page.locator('#cap').screenshot({ path: path.join(ROOT, j.rel), omitBackground: true });
        if (j.neutral) await neutralize(page, j.rel, j.neutral);
        continue;
      }
      // tamaño final en Roblox (px de diseño) a 2x, con tope de 1024 px (límite de subida)
      const k = Math.min(1, 512 / Math.max(j.w, j.h, 1));
      const w = Math.max(1, j.w * k), h = Math.max(1, j.h * k);
      const svg = j.svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${w}" height="${h}"`);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
      await page.locator('svg').screenshot({ path: path.join(ROOT, j.rel), omitBackground: true });
    }
  } finally { await browser.close(); }
  return todo.length;
}

// ---------------------------------------------------------------- entradas
export async function fromClipboardHtml(html, opts) {
  const { bytes, meta } = parseClipboardHtml(html);
  const { message, version } = decodeFig(bytes);
  const images = await fetchImages(imageHashes(message), meta?.imageHashes || {});
  return { ...(await convertFigma(message, { ...opts, images })), meta: { ...meta, imageHashes: undefined }, version };
}
// figmeta.imageHashes = { sha1: URL firmada de S3 (caduca) } -> se descargan y se guardan en out/figma/cache/
async function fetchImages(hashes, urls) {
  const map = new Map(), dir = path.join(ROOT, 'out', 'figma', 'cache');
  fs.mkdirSync(dir, { recursive: true });
  await Promise.all([...hashes].map(async (hh) => {
    const f = path.join(dir, hh);
    if (fs.existsSync(f)) { map.set(hh, fs.readFileSync(f)); return; }
    if (!urls[hh]) return;
    try {
      const r = await fetch(urls[hh], { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return;
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(f, b); map.set(hh, b);
    } catch { /* sin red o URL caducada: la capa queda como hueco */ }
  }));
  return map;
}

// .fig = ZIP con canvas.fig + images/<sha1>
export function readZip(buf) {
  const b = Buffer.from(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('no es un ZIP');
  const n = b.readUInt16LE(eocd + 10);
  let off = b.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let k = 0; k < n; k++) {
    const method = b.readUInt16LE(off + 10), csize = b.readUInt32LE(off + 20), nl = b.readUInt16LE(off + 28), el = b.readUInt16LE(off + 30), cl = b.readUInt16LE(off + 32);
    const lho = b.readUInt32LE(off + 42), name = b.slice(off + 46, off + 46 + nl).toString('utf8');
    const lnl = b.readUInt16LE(lho + 26), lel = b.readUInt16LE(lho + 28);
    const data = b.slice(lho + 30 + lnl + lel, lho + 30 + lnl + lel + csize);
    files.set(name, method === 8 ? zlib.inflateRawSync(data) : data);
    off += 46 + nl + el + cl;
  }
  return files;
}
export function openFig(buf) {
  const b = Buffer.from(buf);
  let canvas = b, images = new Map();
  if (b.readUInt32LE(0) === 0x04034b50) {
    const files = readZip(b);
    canvas = files.get('canvas.fig');
    if (!canvas) throw new Error('el .fig no trae canvas.fig');
    for (const [name, data] of files) { const m = /^images\/([0-9a-f]{40})$/.exec(name); if (m) images.set(m[1], data); }
  }
  const { message, version } = decodeFig(new Uint8Array(canvas));
  return { message, version, images };
}
// frames de primer nivel de cada página (para elegir cuál importar)
export function listFrames(message) {
  const map = buildTree(message);
  const out = [];
  for (const n of map.values()) {
    if (n.c.type !== 'CANVAS' || n.c.internalOnly) continue;
    for (const k of n.kids) if (!SKIP.has(k.c.type) && k.c.visible !== false) out.push({ id: key(k.c.guid), page: n.c.name, name: k.c.name, type: k.c.type, w: r2(k.c.size?.x || 0), h: r2(k.c.size?.y || 0) });
  }
  return out;
}
