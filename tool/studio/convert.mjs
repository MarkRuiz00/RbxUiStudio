// Importa una pantalla hecha con los constructores DS (screens/x.html) como escena editable.
//   node studio/convert.mjs screens/shop.html   ->  screens/<Name>.scene.json + .scene.html
// Aplana los envoltorios de maquetación (flex/grid) y guarda cada pieza con posición absoluta.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sceneHtml, safe } from './scenehtml.mjs';

const require = createRequire(import.meta.url);
const BROWSER = require('./browser.cjs');
const { DATA: ROOT } = require('./paths.cjs');
const src = path.resolve(ROOT, process.argv[2] || '');
if (!fs.existsSync(src)) { console.error('no existe: ' + src); process.exit(1); }

const browser = await BROWSER.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(src).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const scene = await page.evaluate(() => {
  const stage = document.querySelector('[data-rbx-root]');
  const FLAT = new Set(['place', 'hero', 'grow', 'tl', 'bl', 'badge']);
  const STRIP = /^(width|height|min-width|min-height|max-width|max-height|left|top|right|bottom|inset|margin.*|flex.*|grid.*|position|transform|display|align-.*|justify-.*|gap|row-gap|column-gap|padding.*|place-.*|order)$/;
  const r1 = (v) => Math.round(v * 2) / 2;
  let seq = 0;

  const cleanStyle = (el) => {
    const out = [];
    for (let i = 0; i < el.style.length; i++) {
      const p = el.style[i];
      if (!STRIP.test(p)) out.push(`${p}:${el.style.getPropertyValue(p)}`);
    }
    return out.join(';');
  };
  const rotOf = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return 0;
    const [a, b] = m[1].split(',').map(Number);
    return Math.round((Math.atan2(b, a) * 1800) / Math.PI) / 10;
  };
  // rect sin rotar, relativo a la caja de relleno del padre conservado
  const geom = (el, par) => {
    const pr = par.getBoundingClientRect();
    const bl = par === stage ? 0 : par.clientLeft, bt = par === stage ? 0 : par.clientTop;
    const r = el.getBoundingClientRect();
    const isHtml = el instanceof HTMLElement;
    const w = isHtml ? el.offsetWidth : r.width, h = isHtml ? el.offsetHeight : r.height;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { x: r1(cx - w / 2 - pr.left - bl), y: r1(cy - h / 2 - pr.top - bt), w: r1(w), h: r1(h) };
  };

  const walk = (el, par, out) => {
    for (const c of el.children) {
      const tag = c.tagName.toLowerCase();
      const cl = (c.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      if (cl.includes('fxclip')) { walk(c, par, out); continue; }
      const rbx = c.getAttribute('data-rbx');
      if (tag === 'div' && !rbx && cl.every((k) => FLAT.has(k))) { walk(c, par, out); continue; }

      const n = { id: 'n' + (seq++).toString(36), name: c.getAttribute('data-name') || '', rbx: rbx || null, ...geom(c, par) };
      const pad = c.getAttribute('data-pad');
      if (pad != null) n.pad = +pad;
      const cls = cl.filter((k) => k !== 'place').join(' ');
      if (cls) n.cls = cls;
      const st = cleanStyle(c);
      if (st) n.style = st;
      const rot = rotOf(c);
      if (rot) n.rot = rot;

      if (cl.includes('txt')) {
        n.type = 'text';
        n.text = c.textContent;
        const g = c.getAttribute('data-grad');
        if (g) n.grad = g;
        if (!n.name) n.name = 'Text';
      } else if (tag === 'img') {
        n.type = 'image';
        n.src = c.getAttribute('src');
        if (!n.name) n.name = 'Image';
      } else if (tag === 'svg') {
        n.type = 'html';
        const k = c.cloneNode(true);
        for (const a of [...k.attributes]) if (/^(data-|width$|height$|style$)/.test(a.name)) k.removeAttribute(a.name);
        k.setAttribute('width', '100%');
        k.setAttribute('height', '100%');
        n.html = k.outerHTML;
        if (!n.name) n.name = 'Vector';
      } else {
        n.type = cls ? 'box' : 'group';
        if (!n.name) n.name = cl.includes('fx') ? (cl.find((k) => k.startsWith('fx-')) || 'fx') : (cls ? cl[0] : 'Group');
        n.children = [];
        walk(c, c, n.children);
      }
      out.push(n);
    }
  };
  const nodes = [];
  walk(stage, stage, nodes);
  return { name: stage.getAttribute('data-name'), stage: { w: stage.clientWidth, h: stage.clientHeight }, nodes };
});
await browser.close();

const name = safe(scene.name);
const dir = path.join(ROOT, 'screens');
fs.writeFileSync(path.join(dir, name + '.scene.json'), JSON.stringify(scene, null, 1));
fs.writeFileSync(path.join(dir, name + '.scene.html'), sceneHtml(scene));
console.log(name);
