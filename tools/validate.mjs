#!/usr/bin/env node
// Validates rbxui JSON against the official Roblox API (tool/studio/roblox-api.json, shared checks in tool/studio/rbxcheck.js) and, if RbxUI Studio is running, imports + renders it.
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
import { createRequire } from 'module';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = JSON.parse(fs.readFileSync(path.join(REPO, 'tool', 'studio', 'roblox-api.json'), 'utf8'));
const DATA = createRequire(import.meta.url)(path.join(REPO, 'tool', 'studio', 'paths.cjs')).DATA;
const URL0 = process.env.RBXUI_URL || 'http://127.0.0.1:5170';
const argv = process.argv.slice(2), flag = (f) => argv.includes(f);
const MOD = /^UI/;
const CHECK = createRequire(import.meta.url)(path.join(REPO, 'tool', 'studio', 'rbxcheck.js'));
// same checks the editor runs live (tool/studio/rbxcheck.js) + local image files exist under the data folder
function validateDoc(doc, label, { snippet = false } = {}) {
  const r = CHECK.checkDoc(doc, API, { snippet });
  const fmt = (x) => `${label}${x.path ? '.' + x.path : ''}: ${x.msg}`;
  const errs = r.errs.map(fmt), warns = r.warns.map(fmt);
  for (const [at, img] of r.images) if (!fs.existsSync(path.join(DATA, img))) warns.push(`${label}.${at}: local image ${img} missing (node tools/ui-resources.mjs fetch --examples)`);
  return { errs, warns, doc: r.doc };
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
