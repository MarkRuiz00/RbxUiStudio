// RbxUI -> Figma: descripción de nodos (la genera tofigma.js en el navegador) -> mensaje kiwi de Figma ->
//   · portapapeles (text/html con (figmeta)/(figma)): se pega en Figma con Ctrl+V, imágenes incluidas (Image.dataBlob)
//   · archivo .fig (ZIP con canvas.fig + images/<sha1>): se arrastra a Figma y crea un archivo nuevo
// El esquema kiwi va en figschema.json (solo los campos que se usan): Figma lee los campos por nombre.
//
// Nodo de la descripción:
//   { type: 'FRAME'|'TEXT'|'RECTANGLE'|'ELLIPSE', name, x, y, w, h, rot (grados, horario, sobre el centro), visible, opacity,
//     fills: [Paint], strokes: [Paint], strokeWeight, strokeAlign: 'INSIDE'|'OUTSIDE'|'CENTER', radius | radii: [tl,tr,br,bl], clip,
//     text: { characters, family, style, size, alignH, alignV, autoResize, lineHeight (%), truncate, maxLines },
//     layout: { mode, spacing, padding: [l,t,r,b], primary, counter, wrap, hugPrimary, hugCounter }, grow, absolute, children }
//   x, y relativos al padre. Paint:
//     { type:'SOLID', color:{r,g,b}, opacity } | { type:'GRADIENT_LINEAR', stops:[{position, color:{r,g,b,a}}], transform:[m00,m01,m02,m10,m11,m12] }
//     | { type:'IMAGE', hash (sha1 hex), scaleMode:'STRETCH'|'FIT'|'FILL'|'TILE', scale, imgW, imgH, opacity }
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { schemaFromDefs, encodeFig, buildClipboardHtml } from './figkiwi.mjs';
import { derivedTextData, textStyles } from './figtext.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = schemaFromDefs(JSON.parse(fs.readFileSync(path.join(HERE, 'figschema.json'), 'utf8')));
const VERSION = 106;
const SESSION = 4242;
const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

// posiciones entre hermanos (índice fraccionario de Figma): cadenas ASCII crecientes de ancho fijo
function positions(n) {
  const B = 94, w = Math.max(1, Math.ceil(Math.log(n + 1) / Math.log(B)));
  return Array.from({ length: n }, (_, i) => { let s = '', v = i + 1; for (let k = 0; k < w; k++) { s = String.fromCharCode(33 + (v % B)) + s; v = Math.floor(v / B); } return s; });
}
const col = (c, a = 1) => ({ r: +c.r || 0, g: +c.g || 0, b: +c.b || 0, a: c.a ?? a });
function paint(p, blobOf) {
  const base = { opacity: p.opacity ?? 1, visible: p.visible !== false, blendMode: p.blend || 'NORMAL' };
  if (p.type === 'SOLID') return { type: 'SOLID', color: col(p.color, 1), ...base };
  if (p.type === 'GRADIENT_LINEAR') {
    const [m00, m01, m02, m10, m11, m12] = p.transform || [1, 0, 0, 0, 1, 0];
    return { type: 'GRADIENT_LINEAR', stops: p.stops.map((s) => ({ color: col(s.color), position: s.position })), transform: { m00, m01, m02, m10, m11, m12 }, ...base };
  }
  if (p.type === 'IMAGE') {
    const blob = blobOf ? blobOf(p.hash) : undefined;
    const img = { hash: Uint8Array.from(Buffer.from(p.hash, 'hex')), name: '', ...(blob != null && blob >= 0 ? { dataBlob: blob } : {}) };
    return { type: 'IMAGE', image: img, imageThumbnail: { ...img }, imageScaleMode: p.scaleMode || 'FILL', scale: p.scale ?? 1, rotation: 0, transform: ID,
      originalImageWidth: p.imgW || 0, originalImageHeight: p.imgH || 0, ...base };
  }
  return null;
}
// versiones de maquetación de texto de Figma (oct. 2026): con versiones viejas descarta los glifos y no los rehace
const TEXT_VERSIONS = { textUserLayoutVersion: 5, textExplicitLayoutVersion: 1, textBidiVersion: 1 };
// árbol de descripción -> nodeChanges (el padre antes que sus hijos). texts = lista donde se apuntan los TEXT con medidas
function toChanges(roots, parentGuid, blobOf, texts = null) {
  let local = 1;
  const out = [];
  const walk = (d, parent, pos) => {
    const guid = { sessionID: SESSION, localID: local++ };
    const rot = ((d.rot || 0) * Math.PI) / 180, c = Math.cos(rot), s = Math.sin(rot);
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;                     // giro sobre el centro, como Roblox
    const tx = cx - (c * d.w / 2 - s * d.h / 2), ty = cy - (s * d.w / 2 + c * d.h / 2);
    const n = { guid, phase: 'CREATED', parentIndex: { guid: parent, position: pos }, type: d.type === 'RECTANGLE' ? 'ROUNDED_RECTANGLE' : d.type, name: d.name || d.type,
      visible: d.visible !== false, opacity: d.opacity ?? 1, size: { x: Math.max(0.01, d.w), y: Math.max(0.01, d.h) },
      transform: { m00: c, m01: -s, m02: tx, m10: s, m11: c, m12: ty },
      fillPaints: (d.fills || []).map((p) => paint(p, blobOf)).filter(Boolean), strokePaints: (d.strokes || []).map((p) => paint(p, blobOf)).filter(Boolean),
      strokeWeight: d.strokeWeight ?? 1, strokeAlign: d.strokeAlign || 'INSIDE', strokeJoin: 'MITER' };
    if (d.radii) Object.assign(n, { rectangleTopLeftCornerRadius: d.radii[0], rectangleTopRightCornerRadius: d.radii[1], rectangleBottomRightCornerRadius: d.radii[2],
      rectangleBottomLeftCornerRadius: d.radii[3], rectangleCornerRadiiIndependent: true });
    else if (d.radius) Object.assign(n, { cornerRadius: d.radius, rectangleTopLeftCornerRadius: d.radius, rectangleTopRightCornerRadius: d.radius,
      rectangleBottomLeftCornerRadius: d.radius, rectangleBottomRightCornerRadius: d.radius });
    if (d.type === 'FRAME') n.frameMaskDisabled = !d.clip;
    if (d.text) {
      const t = d.text;
      Object.assign(n, { textData: { characters: String(t.characters ?? ''), ...(textStyles(d) || {}) }, fontSize: t.size || 14, fontName: { family: t.family || 'Inter', style: t.style || 'Regular', postscript: '' },
        textAlignHorizontal: t.alignH || 'LEFT', textAlignVertical: t.alignV || 'TOP', textAutoResize: t.autoResize || 'NONE',
        lineHeight: { value: t.lineHeight || 100, units: 'PERCENT' }, letterSpacing: { value: 0, units: 'PERCENT' } });
      if (t.truncate) Object.assign(n, { textTruncation: 'ENDING', ...(t.maxLines ? { maxLines: t.maxLines } : {}) });
      if (texts && t.layout) texts.push([n, d]);
    }
    if (d.layout) {
      const L = d.layout, fit = 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE';
      Object.assign(n, { stackMode: L.mode, stackSpacing: L.spacing || 0, stackHorizontalPadding: L.padding?.[0] || 0, stackVerticalPadding: L.padding?.[1] || 0,
        stackPaddingRight: L.padding?.[2] || 0, stackPaddingBottom: L.padding?.[3] || 0, stackPrimaryAlignItems: L.primary || 'MIN', stackCounterAlignItems: L.counter || 'MIN',
        stackPrimarySizing: L.hugPrimary ? fit : 'FIXED', stackCounterSizing: L.hugCounter ? fit : 'FIXED',
        ...(L.wrap ? { stackWrap: 'WRAP', stackCounterSpacing: L.spacing || 0 } : {}) });
    }
    if (d.grow) n.stackChildPrimaryGrow = 1;
    if (d.absolute) n.stackPositioning = 'ABSOLUTE';
    out.push(n);
    const kids = d.children || [], ps = positions(kids.length);
    kids.forEach((k, i) => walk(k, guid, ps[i]));
  };
  const ps = positions(roots.length);
  roots.forEach((r, i) => walk(r, parentGuid, ps[i]));
  return out;
}
const DOC = { guid: { sessionID: 0, localID: 0 }, phase: 'CREATED', type: 'DOCUMENT', name: 'Document', visible: true, opacity: 1, transform: ID };
const PAGE = { guid: { sessionID: 0, localID: 1 }, phase: 'CREATED', parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page 1',
  visible: true, opacity: 1, transform: ID };

// descripción -> text/html para el portapapeles (Ctrl+V en Figma). images = { sha1hex: base64 } (van dentro, en blobs).
// Los TEXT llevan sus glifos (figtext.mjs): al pegar, Figma no maqueta los textos que no los traen.
export async function toClipboard(roots, images = {}) {
  const order = Object.keys(images), texts = [];
  const nodes = toChanges(roots, PAGE.guid, (h) => order.indexOf(h), texts);
  const blobs = order.map((h) => ({ bytes: new Uint8Array(Buffer.from(images[h], 'base64')) }));
  const addBlob = (b) => blobs.push({ bytes: new Uint8Array(b) }) - 1;
  for (const [n, d] of texts) {
    const dt = await derivedTextData(d, addBlob).catch(() => null);
    if (dt) Object.assign(n, { derivedTextData: dt, ...TEXT_VERSIONS });
  }
  const pasteID = (Math.random() * 2e9) | 0;
  const message = { type: 'NODE_CHANGES', sessionID: 0, ackID: 0, pasteID, pasteFileKey: 'RbxUiStudio', pasteIsPartiallyOutsideEnclosingFrame: false,
    pastePageId: PAGE.guid, isCut: false, pasteEditorType: 'DESIGN', nodeChanges: [DOC, PAGE, ...nodes], blobs };
  const meta = { fileKey: 'RbxUiStudio', pasteID, dataType: 'scene', editorType: 'design', environment: 'www.figma.com' };
  return buildClipboardHtml(encodeFig(S, message, VERSION), meta);
}

// ZIP sin comprimir (los PNG ya van comprimidos)
const CRC_T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = zlib.crc32 || ((b) => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; });
function zipStored(entries) {
  const parts = [], cen = []; let off = 0;
  for (const [name, data] of entries) {
    const nb = Buffer.from(name), h = Buffer.alloc(30), crc = crc32(data);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nb, data); cen.push(c, nb); off += 30 + nb.length + data.length;
  }
  const cb = Buffer.concat(cen), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cb, e]);
}
// PNG liso (miniatura por defecto: Figma rechaza el .fig sin thumbnail.png)
function solidPng(W, H, [r, g, b]) {
  const row = Buffer.alloc(1 + W * 3); for (let x = 0; x < W; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: H }, () => row));
  const chunk = (t, d) => { const c = Buffer.alloc(12 + d.length); c.writeUInt32BE(d.length, 0); c.write(t, 4, 'ascii'); d.copy(c, 8); c.writeUInt32BE(crc32(c.subarray(4, 8 + d.length)), 8 + d.length); return c; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// descripción -> archivo .fig. thumbnail = PNG base64 opcional (si no, una miniatura lisa)
export function toFigFile(roots, images = {}, { name = 'RbxUI', thumbnail = null } = {}) {
  const nodes = toChanges(roots, PAGE.guid, null);
  const canvas = Buffer.from(encodeFig(S, { type: 'NODE_CHANGES', sessionID: 0, ackID: 0, nodeChanges: [DOC, PAGE, ...nodes], blobs: [] }, VERSION));
  const W = Math.max(1, ...roots.map((r) => r.x + r.w)), H = Math.max(1, ...roots.map((r) => r.y + r.h));
  const meta = { client_meta: { background_color: { r: 0.12, g: 0.12, b: 0.12, a: 1 }, thumbnail_size: { width: 400, height: Math.round(400 * H / W) },
    render_coordinates: { x: 0, y: 0, width: W, height: H } }, file_name: name, developer_related_links: [], exported_at: new Date().toISOString() };
  const entries = [['canvas.fig', canvas], ['meta.json', Buffer.from(JSON.stringify(meta))]];
  entries.push(['thumbnail.png', thumbnail ? Buffer.from(thumbnail, 'base64') : solidPng(400, Math.max(1, Math.round(400 * H / W)), [30, 30, 30])]);
  entries.push(['images/', Buffer.alloc(0)]);
  for (const [h, b64] of Object.entries(images)) entries.push([`images/${h}`, Buffer.from(b64, 'base64')]);
  return zipStored(entries);
}
