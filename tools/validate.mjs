#!/usr/bin/env node
// Validates rbxui JSON against the official Roblox API (tools/roblox-api.json) and, if RbxUI Studio is running, imports + renders it.
//
//   node tools/validate.mjs examples            -> every ejemplos/*.rbxui.json (+ renders to ejemplos/renders/<name>.png)
//   node tools/validate.mjs docs                -> every complete JSON snippet in roblox-ui/, rbxui/, estilos/ (*.md)
//   node tools/validate.mjs file <doc.json>     -> one document
//   env RBXUI_URL (default http://127.0.0.1:5170), --no-render, --offline (API checks only)
//
// Checks: class exists · property exists on the class (incl. inherited) and is writable · deprecated props · enum item names ·
// value shapes (Color3, UDim2, UDim, Vector2, Rect, sequences, Font) · unique sibling names · modifiers parented to GUI objects ·
// interaction targets exist · local image files exist under tool/.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'roblox-api.json'), 'utf8'));
const URL0 = process.env.RBXUI_URL || 'http://127.0.0.1:5170';
const argv = process.argv.slice(2), flag = (f) => argv.includes(f);
const MOD = /^UI/;
const DESIGN_KEYS = new Set(['device', 'width', 'height', 'autoScale', 'background']);

function propsOf(cls) {
  const out = {};
  for (let c = cls; c && API.classes[c]; c = API.classes[c].inherits[0]) for (const [k, t] of Object.entries(API.classes[c].props)) if (!(k in out)) out[k] = t;
  return out;
}
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(num);
const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
function checkValue(type, v) {
  const t = type.replace(/ \(deprecated\)$/, '');
  if (API.enums[t]) return typeof v === 'string' && API.enums[t].includes(v) ? null : `expected Enum.${t} item (${API.enums[t].slice(0, 6).join(', ')}…)`;
  switch (t) {
    case 'Color3': return hex(v) ? null : 'expected "#RRGGBB"';
    case 'UDim2': return nums(v, 4) ? null : 'expected UDim2 [xScale, xOffset, yScale, yOffset]';
    case 'UDim': return nums(v, 2) ? null : 'expected UDim [scale, offset]';
    case 'Vector2': return nums(v, 2) ? null : 'expected Vector2 [x, y]';
    case 'Rect': return nums(v, 4) ? null : 'expected Rect [minX, minY, maxX, maxY]';
    case 'ColorSequence': return hex(v) || (Array.isArray(v) && v.length >= 1 && v.every((k) => Array.isArray(k) && num(k[0]) && hex(k[1])) && v[0][0] === 0 && v[v.length - 1][0] === 1) ? null : 'expected "#hex" or [[0,"#hex"],…,[1,"#hex"]] (first t=0, last t=1)';
    case 'NumberSequence': return num(v) || (Array.isArray(v) && v.every((k) => Array.isArray(k) && num(k[0]) && num(k[1])) && v[0][0] === 0 && v[v.length - 1][0] === 1) ? null : 'expected number or [[0,v],…,[1,v]]';
    case 'NumberRange': return num(v) || nums(v, 2) ? null : 'expected number or [min, max]';
    case 'Font': return v && typeof v === 'object' && typeof v.family === 'string' ? null : 'expected { family, weight, style }';
    case 'bool': case 'boolean': return typeof v === 'boolean' ? null : 'expected boolean';
    case 'float': case 'double': case 'int': case 'int64': case 'number': return num(v) ? null : 'expected number';
    case 'string': case 'ContentId': case 'Content': return typeof v === 'string' ? null : 'expected string';
    default: return null;                                    // types the format doesn't model (Instance refs…): skip
  }
}

function validateDoc(doc, label, { snippet = false } = {}) {
  const errs = [], warns = [], names = new Set(), targets = [], images = [];
  if (doc.ClassName === 'ScreenGui') doc = { format: 'rbxui', version: 1, screens: [doc] };
  if (!Array.isArray(doc.screens) || !doc.screens.length) return { errs: [`${label}: no "screens"`], warns };
  const walk = (n, p, parent) => {
    const at = `${p}.${n.Name || n.ClassName}`;
    if (!n.ClassName) { errs.push(`${at}: missing ClassName`); return; }
    if (!API.classes[n.ClassName]) warns.push(`${at}: class ${n.ClassName} not in the UI API subset (check spelling)`);
    names.add(n.Name);
    const P = propsOf(n.ClassName);
    for (const [k, v] of Object.entries(n.props || {})) {
      if (!(k in P)) { if (API.classes[n.ClassName]) errs.push(`${at}.${k}: not a writable property of ${n.ClassName}`); continue; }
      if (/deprecated/.test(P[k])) warns.push(`${at}.${k}: deprecated (use the modern property)`);
      const e = checkValue(P[k], v); if (e) errs.push(`${at}.${k} = ${JSON.stringify(v)}: ${e}`);
    }
    if (MOD.test(n.ClassName) && parent && MOD.test(parent.ClassName) && !(parent.ClassName === 'UIStroke' && n.ClassName === 'UIGradient')) warns.push(`${at}: modifier inside another modifier`);
    if (n.ClassName === 'ScreenGui' && n.design) for (const k of Object.keys(n.design)) if (!DESIGN_KEYS.has(k)) warns.push(`${at}.design.${k}: unknown design key`);
    for (const it of n.interactions || []) {
      if (!['open', 'close', 'toggle'].includes(it.action)) errs.push(`${at}: interaction action "${it.action}" (open|close|toggle)`);
      if (it.target) targets.push([at, it.target]);
    }
    for (const k of ['Image', 'HoverImage', 'PressedImage']) {
      const v = n.props && n.props[k];
      if (typeof v === 'string' && v && !/^(rbxasset|rbxthumb|https?:)/.test(v)) images.push([at, v]);
    }
    const seen = new Set();
    for (const c of n.children || []) {
      const nm = c.Name || c.ClassName;
      if (seen.has(nm)) errs.push(`${at}.${nm}: duplicate sibling name`);
      seen.add(nm); walk(c, at, n);
    }
  };
  for (const s of doc.screens) { if (s.ClassName !== 'ScreenGui') errs.push(`${label}: root must be ScreenGui`); walk(s, label, null); }
  for (const [at, t] of targets) if (!names.has(t)) (snippet ? warns : errs).push(`${at}: interaction target "${t}" not found${snippet ? ' (fine for a fragment)' : ''}`);
  for (const [at, img] of images) if (!fs.existsSync(path.join(REPO, 'tool', img))) warns.push(`${at}: local image ${img} missing (node tools/ui-resources.mjs fetch --examples)`);
  return { errs, warns, doc };
}

async function server() { try { return (await fetch(URL0 + '/api/scenes')).ok; } catch { return false; } }
async function importAndRender(doc, renderTo) {
  const r = await fetch(URL0 + '/api/rbxui/import?open=0', { method: 'POST', body: JSON.stringify(doc) }).then((x) => x.json());
  if (r.error) return { errs: ['import: ' + r.error], warns: [] };
  const warns = (r.warn || []).map((w) => 'rbxui: ' + w);
  if (renderTo) for (const name of r.names) {
    const png = await fetch(`${URL0}/api/render?name=${encodeURIComponent(name)}`);
    if (png.ok) { fs.mkdirSync(path.dirname(renderTo), { recursive: true }); fs.writeFileSync(r.names.length > 1 ? renderTo.replace(/\.png$/, `-${name}.png`) : renderTo, Buffer.from(await png.arrayBuffer())); }
    else warns.push(`render ${name}: HTTP ${png.status}`);
  }
  return { errs: [], warns, names: r.names };
}

function docSnippets() {
  const out = [];
  for (const dir of ['roblox-ui', 'rbxui', 'estilos']) for (const f of fs.readdirSync(path.join(REPO, dir)).filter((x) => x.endsWith('.md'))) {
    const md = fs.readFileSync(path.join(REPO, dir, f), 'utf8');
    let i = 0;
    for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) {
      i++;
      let v; try { v = JSON.parse(m[1]); } catch { continue; }      // fragments like `"interactions": [...]` are illustrative
      if (v && (v.ClassName || v.screens)) out.push([`${dir}/${f}#${i}`, v]);
    }
  }
  return out;
}

let fails = 0;
const report = (label, r) => {
  const ok = !r.errs.length;
  if (!ok) fails++;
  console.log(`${ok ? '✔' : '✘'} ${label}${r.warns.length ? `  (${r.warns.length} warning${r.warns.length > 1 ? 's' : ''})` : ''}`);
  for (const e of r.errs) console.log('   ✘ ' + e);
  for (const w of r.warns) console.log('   ⚠ ' + w);
};
const live = !flag('--offline') && (await server());
if (!flag('--offline') && !live) console.log(`(RbxUI Studio not reachable at ${URL0}: API checks only)`);
const [mode, file] = argv.filter((x) => !x.startsWith('--'));

if (mode === 'examples' || mode === 'file') {
  const files = mode === 'file' ? [path.resolve(file)] : fs.readdirSync(path.join(REPO, 'ejemplos')).filter((x) => x.endsWith('.rbxui.json')).map((x) => path.join(REPO, 'ejemplos', x));
  for (const f of files) {
    const label = path.relative(REPO, f);
    let doc; try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { report(label, { errs: ['invalid JSON: ' + e.message], warns: [] }); continue; }
    const r = validateDoc(doc, path.basename(f));
    if (live && !r.errs.length) {
      const L = await importAndRender(r.doc, flag('--no-render') ? null : path.join(REPO, 'ejemplos', 'renders', path.basename(f).replace(/\.rbxui\.json$/, '.png')));
      r.errs.push(...L.errs); r.warns.push(...L.warns);
    }
    report(label, r);
  }
} else if (mode === 'docs') {
  const snips = docSnippets(), kids = [];
  for (const [label, v] of snips) {
    if (v.screens || v.ClassName === 'ScreenGui') { report(label, validateDoc(v, label)); continue; }
    const wrapped = MOD.test(v.ClassName) ? { ClassName: 'Frame', Name: 'Host', props: { Size: [0, 200, 0, 120] }, children: [v] } : v;
    const r = validateDoc({ ClassName: 'ScreenGui', Name: 'DocSnippet', children: [wrapped] }, label, { snippet: true });
    report(label, r);
    kids.push({ ClassName: 'Frame', Name: 'S' + kids.length, props: { BackgroundTransparency: 1, Size: [0, 0, 0, 0] }, children: [wrapped] });
  }
  if (live && kids.length) {
    const L = await importAndRender({ format: 'rbxui', version: 1, name: 'DocSnippets', screens: [{ ClassName: 'ScreenGui', Name: 'DocSnippets', children: kids }] }, null);
    report(`import of ${kids.length} snippets into RbxUI Studio`, L);
  }
} else {
  console.log('usage: node tools/validate.mjs examples | docs | file <doc.json> [--no-render] [--offline]');
  process.exitCode = 2;
}
if (fails) process.exitCode = 1;
