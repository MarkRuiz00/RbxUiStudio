// Texto para Figma: glifos ya maquetados (derivedTextData). Al pegar, Figma NO maqueta los TEXT que no los traen (solo los
// recalcula si la fuente le falta), así que se generan aquí: posiciones de cada carácter medidas en el navegador (tofigma.js,
// mismo render que el editor) + contornos de la fuente (Google Fonts, WOFF, opentype.js) codificados como Figma:
//   blob de glifo = [0] + por contorno: 1 moveTo(x,y) · 2 lineTo · 3 quad(cx,cy,x,y) · 4 cúbica(c1,c2,p) · 0 cerrar
//   coordenadas en em, y hacia arriba; la posición del glifo es su origen en la línea base (px dentro del TEXT)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const { DATA } = require('./paths.cjs');
const DIR = path.join(DATA, 'out', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0.742.100 Safari/534.30';   // Google sirve WOFF
const mem = new Map();

// familia de Google Fonts + peso + cursiva -> { font, digest } (null si no existe)
export async function fontFor(family, weight = 400, italic = false) {
  const key = `${family}|${weight}|${italic ? 1 : 0}`;
  if (mem.has(key)) return mem.get(key);
  const p = (async () => {
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, `${family.replace(/[^\w-]+/g, '_')}_${weight}${italic ? 'i' : ''}.woff`);
    let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (!buf) {
      for (const w of [weight, 400]) {
        const css = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${w}${italic ? 'italic' : ''}`,
          { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
        const url = /url\((https:[^)]+)\)/.exec(css)?.[1];
        if (!url) continue;
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
        if (r && r.ok) { buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(file, buf); break; }
      }
    }
    if (!buf) return null;
    const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    return { font, digest: crypto.createHash('sha1').update(buf).digest() };
  })();
  mem.set(key, p);
  return p;
}

// contorno de un glifo -> bytes del blob de Figma
function glyphBlob(glyph, upm) {
  const cmds = glyph.path?.commands || [];
  const parts = [Buffer.from([0])], f = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v / upm, 0); return b; };
  let open = false;
  for (const c of cmds) {
    if (c.type === 'M') { if (open) parts.push(Buffer.from([0])); parts.push(Buffer.from([1]), f(c.x), f(c.y)); open = true; }
    else if (c.type === 'L') parts.push(Buffer.from([2]), f(c.x), f(c.y));
    else if (c.type === 'Q') parts.push(Buffer.from([3]), f(c.x1), f(c.y1), f(c.x), f(c.y));
    else if (c.type === 'C') parts.push(Buffer.from([4]), f(c.x1), f(c.y1), f(c.x2), f(c.y2), f(c.x), f(c.y));
    else if (c.type === 'Z') { parts.push(Buffer.from([0])); open = false; }
  }
  if (open) parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/* Texto enriquecido: estilos por carácter (medidos en el navegador, t.text.layout.styles + chars[].s) ->
   textData.characterStyleIDs + styleOverrideTable, como los escribe Figma. Vale también para el .fig (Figma maqueta, pero
   necesita los estilos). Devuelve null si todo el texto tiene el estilo base. */
export function textStyles(t) {
  const L = t.text.layout, chars = String(t.text.characters ?? '');
  if (!L || !L.styles?.length || !L.chars.some((c) => c.s)) return null;
  const ids = new Array(chars.length).fill(0), used = new Set();
  for (const c of L.chars) if (c.s) { ids[c.i] = c.s; if (chars.codePointAt(c.i) > 0xffff) ids[c.i + 1] = c.s; used.add(c.s); }
  const baseCol = t.fills?.[0]?.color, table = [];
  for (const st of L.styles) {
    if (!used.has(st.id)) continue;
    const o = { styleID: st.id };
    if (st.family !== t.text.family || st.style !== t.text.style) o.fontName = { family: st.family, style: st.style, postscript: '' };
    if (Math.abs(st.size - (t.text.size || 14)) > 0.01) o.fontSize = st.size;
    if (!baseCol || ['r', 'g', 'b'].some((k) => Math.abs(st.color[k] - baseCol[k]) > 0.002) || Math.abs((st.color.a ?? 1) - (t.fills?.[0]?.opacity ?? 1)) > 0.002)
      o.fillPaints = [{ type: 'SOLID', color: { r: st.color.r, g: st.color.g, b: st.color.b, a: 1 }, opacity: st.color.a ?? 1, visible: true, blendMode: 'NORMAL' }];
    if (/line-through/.test(st.deco)) o.textDecoration = 'STRIKETHROUGH';
    else if (/underline/.test(st.deco)) o.textDecoration = 'UNDERLINE';
    table.push(o);
  }
  return { characterStyleIDs: ids, styleOverrideTable: table };
}

/* t = descripción del TEXT (figexport) con t.text.layout medido en el navegador:
     { chars: [{ i, x, base, line, s, w }], lines: [{ top, height, base, x, width, first, end }], styles: [...], w, h, weight, italic }
   addBlob(bytes) -> índice en message.blobs. Devuelve derivedTextData o null si alguna fuente no está disponible. */
export async function derivedTextData(t, addBlob) {
  const L = t.text.layout;
  if (!L || !L.chars) return null;
  const base = { family: t.text.family, style: t.text.style || 'Regular', weight: L.weight || 400, italic: !!L.italic, size: t.text.size || 14 };
  const styles = new Map((L.styles || []).map((s) => [s.id, s]));
  const styleOf = (sid) => (sid && styles.get(sid)) || base;
  // fuentes que hacen falta
  const fonts = new Map();
  for (const c of L.chars) {
    const st = styleOf(c.s), k = `${st.family}|${st.weight}|${st.italic ? 1 : 0}`;
    if (!fonts.has(k)) fonts.set(k, { st, F: await fontFor(st.family, st.weight, st.italic) });
    if (!fonts.get(k).F) return null;
  }
  const fontOf = (st) => fonts.get(`${st.family}|${st.weight}|${st.italic ? 1 : 0}`).F.font;
  const chars = String(t.text.characters ?? ''), blobOf = new Map(), glyphs = [];
  for (const c of L.chars) {
    const ch = chars[c.i];
    if (ch == null || ch === '\n' || ch === '\r') continue;
    const st = styleOf(c.s), font = fontOf(st), upm = font.unitsPerEm || 1000;
    const g = font.charToGlyph(String.fromCodePoint(chars.codePointAt(c.i)));
    const bk = `${st.family}|${st.weight}|${st.italic}|${g.index}`;
    let bi = blobOf.get(bk);
    if (bi == null) { bi = addBlob(glyphBlob(g, upm)); blobOf.set(bk, bi); }
    glyphs.push({ commandsBlob: bi, position: { x: c.x, y: c.base }, ...(c.s ? { styleID: c.s } : {}), fontSize: st.size, firstCharacter: c.i,
      advance: (g.advanceWidth || 0) / upm, rotation: 0 });
  }
  // subrayado / tachado: un rectángulo por tramo seguido en la misma línea (métricas de la fuente: OS/2 y post)
  const decorations = [];
  for (const st of styles.values()) {
    const kind = /line-through/.test(st.deco) ? 'strike' : /underline/.test(st.deco) ? 'under' : null;
    if (!kind) continue;
    const font = fontOf(st), upm = font.unitsPerEm || 1000, os2 = font.tables.os2 || {}, post = font.tables.post || {};
    const pos = kind === 'strike' ? (os2.yStrikeoutPosition ?? upm * 0.3) : (post.underlinePosition ?? -upm * 0.1);
    const th = Math.max(1, (kind === 'strike' ? (os2.yStrikeoutSize ?? upm * 0.05) : (post.underlineThickness ?? upm * 0.05)) / upm * st.size);
    const rects = [];
    let run = null;
    for (const c of L.chars) {
      if (c.s !== st.id) { run = null; continue; }
      const y = c.base - pos / upm * st.size - th / 2;
      if (run && run.line === c.line) run.r.w = c.x + c.w - run.r.x;
      else { run = { line: c.line, r: { x: c.x, y, w: c.w, h: th } }; rects.push(run.r); }
    }
    if (rects.length) decorations.push({ rects, styleID: st.id });
  }
  const metas = [...fonts.values()].map(({ st, F }) => {
    const f = F.font, upm = f.unitsPerEm || 1000, asc = (f.tables.hhea?.ascender ?? f.ascender) / upm, desc = (f.tables.hhea?.descender ?? f.descender) / upm;
    return { key: { family: st.family, style: st.style, postscript: '' }, fontLineHeight: asc - desc, fontDigest: new Uint8Array(F.digest),
      fontStyle: st.italic ? 'ITALIC' : 'NORMAL', fontWeight: st.weight };
  });
  const baselines = L.lines.map((l) => ({ position: { x: l.x, y: l.base }, width: l.width, lineY: l.top, lineHeight: l.height,
    lineAscent: l.base - l.top, firstCharacter: l.first, endCharacter: l.end }));
  return {
    layoutSize: { x: L.w, y: L.h }, baselines, glyphs, ...(decorations.length ? { decorations } : {}), fontMetaData: metas,
    truncationStartIndex: -1, truncatedHeight: -1, logicalIndexToCharacterOffsetMap: L.chars.map((c) => c.x - (L.lines[c.line]?.x || 0)),
    derivedLines: L.lines.map(() => ({ directionality: 'LTR' })),
  };
}
