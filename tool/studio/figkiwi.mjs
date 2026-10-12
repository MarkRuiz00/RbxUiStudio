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

// ================================================================ codificador (para pegar en Figma)
class WB {
  constructor() { this.a = new Uint8Array(1024); this.n = 0; this.f32 = new Float32Array(1); this.u32 = new Uint32Array(this.f32.buffer); }
  grow(k) { if (this.n + k <= this.a.length) return; let m = this.a.length * 2; while (m < this.n + k) m *= 2; const b = new Uint8Array(m); b.set(this.a.subarray(0, this.n)); this.a = b; }
  byte(v) { this.grow(1); this.a[this.n++] = v & 255; }
  raw(b) { this.grow(b.length); this.a.set(b, this.n); this.n += b.length; }
  uint(v) { v >>>= 0; do { let b = v & 127; v >>>= 7; if (v) b |= 128; this.byte(b); } while (v); }
  int(v) { v |= 0; this.uint((v << 1) ^ (v >> 31)); }
  float(v) {
    this.f32[0] = v; const bits = this.u32[0];
    if ((bits & 0x7f800000) === 0) { this.byte(0); return; }   // 0 y desnormales -> 0 (como kiwi)
    const s = ((bits >>> 23) | (bits << 9)) >>> 0;
    this.byte(s); this.byte(s >>> 8); this.byte(s >>> 16); this.byte(s >>> 24);
  }
  string(s) { this.raw(Buffer.from(String(s), 'utf8')); this.byte(0); }
  bytes(b) { this.uint(b.length); this.raw(b); }
  uint64(v) { v = BigInt(v); while (v >= 128n) { this.byte(Number(v & 127n) | 128); v >>= 7n; } this.byte(Number(v)); }
  int64(v) { v = BigInt(v); this.uint64(v < 0n ? ((-v) << 1n) - 1n : v << 1n); }
  out() { return this.a.slice(0, this.n); }
}
function writeOne(wb, type, v, S) {
  switch (type) {
    case 'bool': return wb.byte(v ? 1 : 0);
    case 'byte': return wb.byte(v);
    case 'int': return wb.int(v);
    case 'uint': return wb.uint(v);
    case 'float': return wb.float(v);
    case 'string': return wb.string(v);
    case 'int64': return wb.int64(v);
    case 'uint64': return wb.uint64(v);
    default: {
      const d = S[type];
      if (!d) throw new Error('kiwi: tipo desconocido ' + type);
      if (d.kind === 'ENUM') {
        const f = typeof v === 'number' ? { value: v } : d.fields.find((x) => x.name === v);
        if (!f) throw new Error(`kiwi: valor "${v}" no existe en ${d.name}`);
        return wb.uint(f.value);
      }
      return writeDef(wb, d, v, S);
    }
  }
}
function writeField(wb, f, v, S) {
  if (!f.isArray) return writeOne(wb, f.type, v, S);
  if (f.type === 'byte') return wb.bytes(v);
  wb.uint(v.length);
  for (const x of v) writeOne(wb, f.type, x, S);
}
function writeDef(wb, d, o, S) {
  if (d.kind === 'STRUCT') { for (const f of d.fields) writeField(wb, f, o[f.name], S); return; }
  for (const f of d.fields) {
    const v = o[f.name];
    if (v === undefined || v === null) continue;
    wb.uint(f.value); writeField(wb, f, v, S);
  }
  wb.uint(0);
}
// esquema (objeto de decodeSchema) -> bytes kiwi
export function encodeSchema(S) {
  const defs = Object.values(S), index = new Map(defs.map((d, i) => [d.name, i])), wb = new WB();
  wb.uint(defs.length);
  for (const d of defs) {
    wb.string(d.name); wb.byte(KINDS.indexOf(d.kind)); wb.uint(d.fields.length);
    for (const f of d.fields) {
      wb.string(f.name);
      wb.int(d.kind === 'ENUM' ? 0 : TYPES.includes(f.type) ? ~TYPES.indexOf(f.type) : index.get(f.type));
      wb.byte(f.isArray ? 1 : 0); wb.uint(f.value);
    }
  }
  return wb.out();
}
export const encodeMessage = (S, message) => { const wb = new WB(); writeDef(wb, S.Message, message, S); return wb.out(); };
// { message } + esquema -> bytes fig-kiwi (trozos en deflate crudo, que Figma acepta igual que zstd)
export function encodeFig(S, message, version = 106, schemaBytes = null) {
  const c0 = zlib.deflateRawSync(schemaBytes || encodeSchema(S)), c1 = zlib.deflateRawSync(encodeMessage(S, message));
  const out = Buffer.alloc(12 + 4 + c0.length + 4 + c1.length);
  out.write('fig-kiwi', 0, 'latin1'); out.writeUInt32LE(version, 8);
  out.writeUInt32LE(c0.length, 12); c0.copy(out, 16);
  out.writeUInt32LE(c1.length, 16 + c0.length); c1.copy(out, 20 + c0.length);
  return new Uint8Array(out);
}
// esquema guardado como JSON [{ name, kind, fields: [[nombre, tipo, esArray, valor]] }] -> objeto como el de decodeSchema
export function schemaFromDefs(defs) {
  const S = {};
  for (const d of defs) {
    const o = { name: d.name, kind: d.kind, fields: d.fields.map(([name, type, isArray, value]) => ({ name, type, isArray: !!isArray, value })) };
    if (o.kind === 'ENUM') o.names = Object.fromEntries(o.fields.map((f) => [f.value, f.name]));
    if (o.kind === 'MESSAGE') o.byValue = Object.fromEntries(o.fields.map((f) => [f.value, f]));
    S[d.name] = o;
  }
  return S;
}
// bytes fig-kiwi + metadatos -> text/html del portapapeles, como lo escribe Figma
export function buildClipboardHtml(bytes, meta) {
  const m = Buffer.from(JSON.stringify(meta), 'utf8').toString('base64'), b = Buffer.from(bytes).toString('base64');
  return `<meta charset="utf-8"><span data-metadata="<!--(figmeta)${m}(/figmeta)-->"></span><span data-buffer="<!--(figma)${b}(/figma)-->"></span><span style="white-space:pre-wrap;"></span>`;
}
