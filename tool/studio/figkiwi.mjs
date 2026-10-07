// Decodificador del formato binario de Figma ("fig-kiwi"), sin dependencias.
// Lo usa el portapapeles de Figma (text/html con (figmeta)/(figma)) y los .fig (canvas.fig dentro del ZIP).
//   bytes = "fig-kiwi" + versión u32 + trozos [u32 tamaño + datos]: [0] esquema kiwi, [1] mensaje (zstd o deflate crudo)
// El esquema viaja dentro de los datos, así que no depende de la versión de Figma.
import zlib from 'zlib';

// ---------------------------------------------------------------- portapapeles
// El navegador puede re-serializar el HTML: comillas cambiadas y < > como entidades.
const LT = '(?:&lt;|&#0*60;|&#[xX]0*3[cC];|<)', GT = '(?:&gt;|&#0*62;|&#[xX]0*3[eE];|>)', B64 = '([A-Za-z0-9+/=\\s]*)';
const BUFFER_RE = new RegExp(`data-buffer=["']?\\s*${LT}!--\\(figma\\)${B64}\\(/figma\\)--${GT}`);
const META_RE = new RegExp(`data-metadata=["']?\\s*${LT}!--\\(figmeta\\)${B64}\\(/figmeta\\)--${GT}`);
const BUFFER_LOOSE = /\(figma\)([A-Za-z0-9+/=\s]+)\(\/figma\)/, META_LOOSE = /\(figmeta\)([A-Za-z0-9+/=\s]+)\(\/figmeta\)/;

export const isFigmaHtml = (html) => typeof html === 'string' && html.includes('(figma)');

export function parseClipboardHtml(html) {
  const m = BUFFER_RE.exec(html) || BUFFER_LOOSE.exec(html);
  if (!m) throw new Error('el HTML no trae datos de Figma ((figma)…(/figma))');
  const bytes = new Uint8Array(Buffer.from(m[1].replace(/\s+/g, ''), 'base64'));
  let meta = null;
  const mm = META_RE.exec(html) || META_LOOSE.exec(html);
  if (mm) { try { meta = JSON.parse(Buffer.from(mm[1].replace(/\s+/g, ''), 'base64').toString('utf8')); } catch { meta = null; } }
  return { bytes, meta };
}

// ---------------------------------------------------------------- contenedor
export function readArchive(bytes) {
  const prelude = String.fromCharCode(...bytes.subarray(0, 8));
  if (!/^fig-/.test(prelude)) throw new Error(`no es fig-kiwi (empieza por "${prelude}")`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(8, true);
  const chunks = [];
  let off = 12;
  while (off + 4 <= bytes.length) {
    const size = dv.getUint32(off, true); off += 4;
    if (off + size > bytes.length) throw new Error('trozo fuera de rango');
    chunks.push(bytes.subarray(off, off + size)); off += size;
  }
  return { prelude, version, chunks };
}
export function decompress(chunk) {
  if (chunk[0] === 0x28 && chunk[1] === 0xb5 && chunk[2] === 0x2f && chunk[3] === 0xfd) {
    if (!zlib.zstdDecompressSync) throw new Error('datos zstd: hace falta Node >= 22.15');
    return new Uint8Array(zlib.zstdDecompressSync(chunk));
  }
  try { return new Uint8Array(zlib.inflateRawSync(chunk)); } catch { /* puede venir con cabecera zlib o sin comprimir */ }
  try { return new Uint8Array(zlib.inflateSync(chunk)); } catch { return chunk; }
}

// ---------------------------------------------------------------- kiwi
class BB {
  constructor(data) { this.d = data; this.i = 0; this.f32 = new Float32Array(1); this.i32 = new Int32Array(this.f32.buffer); }
  byte() { if (this.i >= this.d.length) throw new Error('kiwi: fin de datos'); return this.d[this.i++]; }
  bytes() { const n = this.uint(); const s = this.d.subarray(this.i, this.i + n); this.i += n; return s; }
  uint() { let v = 0, sh = 0, b; do { b = this.byte(); v |= (b & 127) << sh; sh += 7; } while (b & 128 && sh < 35); return v >>> 0; }
  int() { const v = this.uint() | 0; return v & 1 ? ~(v >>> 1) : v >>> 1; }
  float() {
    const first = this.d[this.i];
    if (first === 0) { this.i++; return 0; }
    let bits = first | (this.d[this.i + 1] << 8) | (this.d[this.i + 2] << 16) | (this.d[this.i + 3] << 24);
    this.i += 4;
    this.i32[0] = (bits << 23) | (bits >>> 9);
    return this.f32[0];
  }
  string() { const s = this.i; while (this.d[this.i] !== 0) { if (this.i >= this.d.length) throw new Error('kiwi: string sin fin'); this.i++; } const out = Buffer.from(this.d.subarray(s, this.i)).toString('utf8'); this.i++; return out; }
  uint64() { let v = 0n, sh = 0n, b; while ((b = this.byte()) & 128 && sh < 56n) { v |= BigInt(b & 127) << sh; sh += 7n; } return v | (BigInt(b) << sh); }
  int64() { const v = this.uint64(); return v & 1n ? ~(v >> 1n) : v >> 1n; }
}
const TYPES = ['bool', 'byte', 'int', 'uint', 'float', 'string', 'int64', 'uint64'];
const KINDS = ['ENUM', 'STRUCT', 'MESSAGE'];

export function decodeSchema(data) {
  const bb = new BB(data);
  const n = bb.uint(), defs = [];
  for (let i = 0; i < n; i++) {
    const name = bb.string(), kind = KINDS[bb.byte()], fc = bb.uint(), fields = [];
    for (let j = 0; j < fc; j++) fields.push({ name: bb.string(), type: bb.int(), isArray: !!(bb.byte() & 1), value: bb.uint() });
    defs.push({ name, kind, fields });
  }
  for (const d of defs) for (const f of d.fields) f.type = d.kind === 'ENUM' ? null : f.type < 0 ? TYPES[~f.type] : defs[f.type].name;
  const byName = {};
  for (const d of defs) {
    byName[d.name] = d;
    if (d.kind === 'ENUM') d.names = Object.fromEntries(d.fields.map((f) => [f.value, f.name]));
    if (d.kind === 'MESSAGE') d.byValue = Object.fromEntries(d.fields.map((f) => [f.value, f]));
  }
  return byName;
}

function readOne(bb, type, S) {
  switch (type) {
    case 'bool': return !!bb.byte();
    case 'byte': return bb.byte();
    case 'int': return bb.int();
    case 'uint': return bb.uint();
    case 'float': return bb.float();
    case 'string': return bb.string();
    case 'int64': return bb.int64();
    case 'uint64': return bb.uint64();
    default: {
      const d = S[type];
      if (!d) throw new Error('kiwi: tipo desconocido ' + type);
      if (d.kind === 'ENUM') { const v = bb.uint(); return d.names[v] ?? v; }
      return readDef(bb, d, S);
    }
  }
}
function readField(bb, f, S) {
  if (!f.isArray) return readOne(bb, f.type, S);
  if (f.type === 'byte') return bb.bytes();
  const n = bb.uint(), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = readOne(bb, f.type, S);
  return out;
}
function readDef(bb, d, S) {
  const out = {};
  if (d.kind === 'STRUCT') { for (const f of d.fields) out[f.name] = readField(bb, f, S); return out; }
  for (;;) {
    const v = bb.uint();
    if (v === 0) return out;
    const f = d.byValue[v];
    if (!f) throw new Error(`kiwi: campo ${v} desconocido en ${d.name}`);
    out[f.name] = readField(bb, f, S);
  }
}

// bytes fig-kiwi -> { message, version }
export function decodeFig(bytes) {
  const { chunks, version } = readArchive(bytes);
  if (chunks.length < 2) throw new Error('fig-kiwi incompleto');
  const S = decodeSchema(decompress(chunks[0]));
  if (!S.Message) throw new Error('el esquema no tiene Message');
  return { message: readDef(new BB(decompress(chunks[1])), S.Message, S), version };
}
