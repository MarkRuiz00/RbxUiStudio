// Documentos del editor Fig (tool/fig/): el modelo ES el de Figma. Cada nodo guarda los campos kiwi tal cual vienen de Figma
// (fillPaints, transform, size, stack*, derivedTextData, fillGeometry…), sin guid/parentIndex/phase, que se sustituyen por
// id + children. Así importar y volver a exportar no pierde nada, aunque el editor no entienda un campo.
//   Documento: { format:'figdoc', version:1, name, schema (esquema kiwi que vino con los datos), blobs:[{$b}], document:{…}, pages:[nodo CANVAS] }
//   En JSON: Uint8Array -> {"$b": base64}, BigInt -> {"$n": "…"}
// Imágenes: DATA/out/fig/images/<sha1> (bytes). Documentos: DATA/out/fig/docs/<nombre>.figdoc.json
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { decodeFig, readArchive, decompress, decodeSchema, parseClipboardHtml, schemaFromDefs, encodeFig, buildClipboardHtml } from './figkiwi.mjs';
import { readZip } from './figma.mjs';
import { derivedTextData } from './figtext.mjs';

const require = createRequire(import.meta.url);
const { DATA } = require('./paths.cjs');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIG_DIR = path.join(DATA, 'out', 'fig');   // no en DATA/fig: taparía la app /fig/
export const IMG_DIR = path.join(FIG_DIR, 'images');
export const DOC_DIR = path.join(FIG_DIR, 'docs');
const MIN_SCHEMA = JSON.parse(fs.readFileSync(path.join(HERE, 'figschema.json'), 'utf8'));
const BLOB_KEYS = new Set(['commandsBlob', 'vectorNetworkBlob', 'dataBlob']);

// ---------------------------------------------------------------- JSON <-> valores kiwi
export const toJson = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v instanceof Uint8Array ? { $b: Buffer.from(v).toString('base64') } : typeof v === 'bigint' ? { $n: v.toString() } : v)));
export function fromJson(o) {
  if (Array.isArray(o)) return o.map(fromJson);
  if (o && typeof o === 'object') {
    if (typeof o.$b === 'string' && Object.keys(o).length === 1) return new Uint8Array(Buffer.from(o.$b, 'base64'));
    if (typeof o.$n === 'string' && Object.keys(o).length === 1) return BigInt(o.$n);
    const r = {}; for (const [k, v] of Object.entries(o)) r[k] = fromJson(v); return r;
  }
  return o;
}
const gid = (g) => `${g.sessionID}:${g.localID}`;
const hex = (b) => Buffer.from(b).toString('hex');
// esquema decodificado -> defs JSON (como figschema.json)
const schemaDefs = (S) => Object.values(S).map((d) => ({ name: d.name, kind: d.kind, fields: d.fields.map((f) => [f.name, f.type, f.isArray ? 1 : 0, f.value]) }));

// recorre un valor kiwi y desplaza los índices de blob
function shiftBlobs(o, off, map) {
  if (Array.isArray(o)) { o.forEach((x) => shiftBlobs(x, off, map)); return; }
  if (!o || typeof o !== 'object' || o instanceof Uint8Array) return;
  for (const [k, v] of Object.entries(o)) {
    if (BLOB_KEYS.has(k) && typeof v === 'number') o[k] = map ? (map.has(v) ? map.get(v) : v) : v + off;
    else shiftBlobs(v, off, map);
  }
}
function collectBlobs(o, set) {
  if (Array.isArray(o)) { o.forEach((x) => collectBlobs(x, set)); return; }
  if (!o || typeof o !== 'object' || o instanceof Uint8Array) return;
  for (const [k, v] of Object.entries(o)) { if (BLOB_KEYS.has(k) && typeof v === 'number') set.add(v); else collectBlobs(v, set); }
}
function imageHashesOf(o, set) {
  if (Array.isArray(o)) { o.forEach((x) => imageHashesOf(x, set)); return; }
  if (!o || typeof o !== 'object' || o instanceof Uint8Array) return;
  for (const [k, v] of Object.entries(o)) { if ((k === 'image' || k === 'imageThumbnail') && v && v.hash instanceof Uint8Array) set.add(hex(v.hash)); else imageHashesOf(v, set); }
}

// ---------------------------------------------------------------- mensaje kiwi -> árbol
function treeOf(message) {
  const byId = new Map(), roots = [];
  for (const nc of message.nodeChanges || []) {
    if (nc.phase === 'REMOVED') continue;
    const { guid, parentIndex, phase, ...rest } = nc;
    byId.set(gid(guid), { node: { id: gid(guid), ...rest, children: [] }, parent: parentIndex ? gid(parentIndex.guid) : null, pos: parentIndex?.position || '' });
  }
  for (const e of byId.values()) { const p = e.parent && byId.get(e.parent); if (p) p.node.children.push(e); else roots.push(e); }
  const fin = (e) => { e.node.children = e.node.children.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0)).map(fin); return e.node; };
  return roots.sort((a, b) => (a.pos < b.pos ? -1 : 1)).map(fin);
}
export function saveImage(bytes) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const h = crypto.createHash('sha1').update(bytes).digest('hex'), f = path.join(IMG_DIR, h);
  if (!fs.existsSync(f)) fs.writeFileSync(f, bytes);
  return h;
}
async function fetchImage(h, url) {
  const f = path.join(IMG_DIR, h);
  if (fs.existsSync(f) || !url) return;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (r.ok) { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); } } catch { /* sin red */ }
}

// bytes fig-kiwi (+ imágenes) -> documento
async function docFrom(bytes, { name, images = new Map(), urls = {} } = {}) {
  const { chunks } = readArchive(bytes);
  const S = decodeSchema(decompress(chunks[0]));
  const { message } = decodeFig(bytes);
  const blobs = message.blobs || [];
  // imágenes dentro de blobs (Image.dataBlob, pegado desde RbxUI) y en el ZIP / URLs del portapapeles
  for (const b of blobs) if (b.bytes && b.bytes.length > 8 && b.bytes[0] === 0x89 && b.bytes[1] === 0x50) saveImage(Buffer.from(b.bytes));
  for (const [, b] of images) saveImage(b);
  const hashes = new Set(); imageHashesOf(message.nodeChanges, hashes);
  await Promise.all([...hashes].map((h) => fetchImage(h, urls[h])));
  const roots = treeOf(message);
  const docNode = roots.find((r) => r.type === 'DOCUMENT');
  const pages = docNode ? docNode.children : roots.filter((r) => r.type === 'CANVAS');
  const loose = roots.filter((r) => r.type !== 'DOCUMENT' && r.type !== 'CANVAS');
  if (docNode) delete docNode.children;
  if (loose.length) pages.push({ id: 'loose:1', type: 'CANVAS', name: 'Pegado', visible: true, opacity: 1, children: loose });
  return { format: 'figdoc', version: 1, name: name || 'Sin título', schema: schemaDefs(S), blobs: blobs.map((b) => b.bytes || new Uint8Array(0)), document: docNode || null, pages };
}

export async function docFromFigFile(buf, name) {
  const files = readZip(buf), canvas = files.get('canvas.fig');
  if (!canvas) throw new Error('no es un .fig (falta canvas.fig)');
  const images = new Map();
  for (const [n, b] of files) if (n.startsWith('images/') && b.length) images.set(n.slice(7), b);
  return docFrom(new Uint8Array(canvas), { name, images });
}
export async function docFromClipboard(html) {
  const { bytes, meta } = parseClipboardHtml(html);
  return docFrom(bytes, { name: 'Pegado', urls: meta?.imageHashes || {} });
}

// ---------------------------------------------------------------- exportar
let localId = 1;
// nodos del documento (árbol, con id/children) -> nodeChanges + blobs propios (remapeados)
function changesOf(nodes, doc, parentGuid) {
  const out = [], used = new Set();
  const B = 94, posOf = (i, n) => { const w = Math.max(1, Math.ceil(Math.log(n + 1) / Math.log(B))); let s = '', v = i + 1; for (let k = 0; k < w; k++) { s = String.fromCharCode(33 + (v % B)) + s; v = Math.floor(v / B); } return s; };
  const walk = (n, parent, i, cnt) => {
    const { id, children, ...rest } = n;
    const guid = { sessionID: 7000 + (n.id === undefined ? 0 : 0), localID: localId++ };
    const nc = { guid, phase: 'CREATED', parentIndex: { guid: parent, position: posOf(i, cnt) }, ...rest };
    collectBlobs(nc, used);
    out.push(nc);
    (children || []).forEach((c, j) => walk(c, guid, j, children.length));
  };
  nodes.forEach((n, i) => walk(n, parentGuid, i, nodes.length));
  // blobs: solo los usados, en orden nuevo
  const order = [...used].sort((a, b) => a - b), map = new Map(order.map((b, i) => [b, i]));
  shiftBlobs(out, 0, map);
  return { changes: out, blobs: order.map((b) => ({ bytes: doc.blobs[b] || new Uint8Array(0) })) };
}
function schemaFor(doc) { return schemaFromDefs(doc.schema && doc.schema.length ? doc.schema : MIN_SCHEMA); }
const DOCN = { guid: { sessionID: 0, localID: 0 }, phase: 'CREATED', type: 'DOCUMENT', name: 'Document', visible: true, opacity: 1, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } };
const PAGEN = { guid: { sessionID: 0, localID: 1 }, phase: 'CREATED', parentIndex: { guid: DOCN.guid, position: '!' }, type: 'CANVAS', name: 'Page 1', visible: true, opacity: 1, transform: DOCN.transform };

// nodos -> HTML de portapapeles de Figma (las imágenes van dentro, en blobs; los textos sin glifos los reciben de figtext.mjs)
export async function clipboardFromNodes(doc, nodes) {
  const { changes, blobs } = changesOf(nodes, doc, PAGEN.guid);
  for (const nc of changes) {
    const L = nc.__glyphLayout; delete nc.__glyphLayout;
    if (!L || nc.derivedTextData) continue;
    const t = { text: { family: nc.fontName?.family || 'Inter', style: nc.fontName?.style || 'Regular', size: nc.fontSize || 12, characters: nc.textData?.characters || '', layout: L }, fills: nc.fillPaints };
    const dt = await derivedTextData(t, (b) => blobs.push({ bytes: new Uint8Array(b) }) - 1).catch(() => null);
    if (dt) Object.assign(nc, { derivedTextData: dt, textUserLayoutVersion: 5, textExplicitLayoutVersion: 1, textBidiVersion: 1 });
  }
  const hashes = new Set(); imageHashesOf(changes, hashes);
  const imgIndex = new Map();
  for (const h of hashes) { const f = path.join(IMG_DIR, h); if (fs.existsSync(f)) { imgIndex.set(h, blobs.length); blobs.push({ bytes: new Uint8Array(fs.readFileSync(f)) }); } }
  const setBlob = (o) => {
    if (Array.isArray(o)) return o.forEach(setBlob);
    if (!o || typeof o !== 'object' || o instanceof Uint8Array) return;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'image' || k === 'imageThumbnail') && v && v.hash instanceof Uint8Array) { const i = imgIndex.get(hex(v.hash)); if (i != null) o[k] = { ...v, dataBlob: i }; }
      else setBlob(v);
    }
  };
  setBlob(changes);
  const pasteID = (Math.random() * 2e9) | 0;
  const message = { type: 'NODE_CHANGES', sessionID: 0, ackID: 0, pasteID, pasteFileKey: 'RbxUiFig', pasteIsPartiallyOutsideEnclosingFrame: false, pastePageId: PAGEN.guid,
    isCut: false, pasteEditorType: 'DESIGN', nodeChanges: [DOCN, PAGEN, ...changes], blobs };
  return buildClipboardHtml(encodeFig(schemaFor(doc), message, 106), { fileKey: 'RbxUiFig', pasteID, dataType: 'scene', editorType: 'design', environment: 'www.figma.com' });
}
// documento entero -> .fig
export function figFileFromDoc(doc, thumbnail = null) {
  const pages = [], all = [];
  doc.pages.forEach((p, i) => { const { children, id, ...rest } = p; pages.push({ ...rest, guid: { sessionID: 0, localID: 10 + i }, phase: 'CREATED', parentIndex: { guid: DOCN.guid, position: String.fromCharCode(34 + i) } }); });
  const blobsAll = [];
  doc.pages.forEach((p, i) => {
    const { changes, blobs } = changesOf(p.children || [], doc, pages[i].guid);
    const off = blobsAll.length; shiftBlobs(changes, off); blobsAll.push(...blobs); all.push(...changes);
  });
  const docNode = doc.document ? { ...doc.document, guid: DOCN.guid, phase: 'CREATED' } : DOCN;
  delete docNode.id;
  const canvas = Buffer.from(encodeFig(schemaFor(doc), { type: 'NODE_CHANGES', sessionID: 0, ackID: 0, nodeChanges: [docNode, ...pages, ...all], blobs: blobsAll }, 106));
  const hashes = new Set(); imageHashesOf(all, hashes);
  const entries = [['canvas.fig', canvas], ['meta.json', Buffer.from(JSON.stringify({ client_meta: { background_color: { r: 0.12, g: 0.12, b: 0.12, a: 1 },
    thumbnail_size: { width: 400, height: 300 }, render_coordinates: { x: 0, y: 0, width: 800, height: 600 } }, file_name: doc.name, developer_related_links: [], exported_at: new Date().toISOString() }))],
    ['thumbnail.png', thumbnail || solidPng(400, 300)], ['images/', Buffer.alloc(0)]];
  for (const h of hashes) { const f = path.join(IMG_DIR, h); if (fs.existsSync(f)) entries.push([`images/${h}`, fs.readFileSync(f)]); }
  return zipStored(entries);
}

// ---------------------------------------------------------------- ZIP / PNG mínimos
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
function solidPng(W, H) {
  const row = Buffer.alloc(1 + W * 3, 30); row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: H }, () => row));
  const chunk = (t, d) => { const c = Buffer.alloc(12 + d.length); c.writeUInt32BE(d.length, 0); c.write(t, 4, 'ascii'); d.copy(c, 8); c.writeUInt32BE(crc32(c.subarray(4, 8 + d.length)), 8 + d.length); return c; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- guardar / abrir
const safeName = (s) => String(s || 'Sin título').replace(/[^\w\s.-]+/g, '_').trim().slice(0, 80) || 'Sin título';
export const listDocs = () => (fs.existsSync(DOC_DIR) ? fs.readdirSync(DOC_DIR).filter((f) => f.endsWith('.figdoc.json')).map((f) => {
  const st = fs.statSync(path.join(DOC_DIR, f)); return { name: f.replace(/\.figdoc\.json$/, ''), mtime: st.mtimeMs, size: st.size };
}).sort((a, b) => b.mtime - a.mtime) : []);
export function saveDoc(doc) {
  fs.mkdirSync(DOC_DIR, { recursive: true });
  const name = safeName(doc.name);
  fs.writeFileSync(path.join(DOC_DIR, name + '.figdoc.json'), JSON.stringify({ ...doc, name }));
  return name;
}
export function loadDoc(name) {
  const f = path.join(DOC_DIR, safeName(name) + '.figdoc.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
