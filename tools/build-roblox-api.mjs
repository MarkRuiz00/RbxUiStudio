#!/usr/bin/env node
// Builds tool/studio/roblox-api.json (UI classes, their writable properties with types, and enums) from the official
// Roblox Creator Docs source (https://github.com/Roblox/creator-docs, content licensed CC BY 4.0 by Roblox).
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Roblox/creator-docs.git /tmp/creator-docs
//   (cd /tmp/creator-docs && git sparse-checkout set --no-cone '/content/en-us/reference/engine/**/*.yaml')
//   node tools/build-roblox-api.mjs /tmp/creator-docs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-roblox-api.mjs <creator-docs clone>'); process.exit(1); }
const REF = path.join(src, 'content/en-us/reference/engine');

const ROOTS = ['ScreenGui', 'Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame', 'CanvasGroup',
  'ViewportFrame', 'VideoFrame', 'UICorner', 'UIStroke', 'UIGradient', 'UIPadding', 'UIListLayout', 'UIGridLayout', 'UITableLayout',
  'UIPageLayout', 'UIFlexItem', 'UIScale', 'UIAspectRatioConstraint', 'UISizeConstraint', 'UITextSizeConstraint', 'Folder'];

function parseClass(name) {
  const file = path.join(REF, 'classes', name + '.yaml');
  if (!fs.existsSync(file)) return null;
  const s = fs.readFileSync(file, 'utf8');
  const inh = /\ninherits:\n((?:  - .*\n)*)/.exec(s);
  const inherits = inh ? inh[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];
  const props = {};
  const sec = /\nproperties:\n([\s\S]*?)\n(?:methods|events|callbacks):/.exec(s);
  if (sec) {
    for (const block of ('\n' + sec[1]).split(/\n  - name: /).slice(1)) {
      const full = block.split('\n')[0].trim(), prop = full.split('.').pop();
      const type = (/\n    type: (.*)/.exec(block) || [])[1]?.trim();
      const tags = (/\n    tags:([\s\S]*?)\n    [a-z_]+:/.exec(block) || [])[1] || '';
      const write = (/\n      write: (.*)/.exec(block) || [])[1]?.trim();
      const deprecated = /Deprecated/.test(tags) || /\n    deprecation_message: '?[^'\n]/.test(block);
      if (/ReadOnly|NotScriptable/.test(tags) || (write && write !== 'None')) continue;
      props[prop] = deprecated ? `${type} (deprecated)` : type;
    }
  }
  return { inherits, props };
}

const classes = {}, enums = {};
const queue = [...ROOTS];
while (queue.length) {
  const c = queue.shift();
  if (classes[c] || c === 'Object') continue;
  const info = parseClass(c);
  if (!info) continue;
  classes[c] = info;
  queue.push(info.inherits[0] ? info.inherits[0] : null);
  queue.splice(queue.indexOf(null), queue.includes(null) ? 1 : 0);
  for (const t of Object.values(info.props)) { const m = /^(\w+)/.exec(t); if (m && fs.existsSync(path.join(REF, 'enums', m[1] + '.yaml'))) enums[m[1]] = true; }
}
for (const e of Object.keys(enums)) {
  const f = path.join(REF, 'enums', e + '.yaml');
  enums[e] = fs.existsSync(f) ? [...fs.readFileSync(f, 'utf8').matchAll(/\n  - name: '?(\w+)'?/g)].map((m) => m[1]) : [];
}
let commit = '';
try { commit = execSync('git rev-parse HEAD', { cwd: src }).toString().trim(); } catch { /* not a git clone */ }
const out = { source: 'https://github.com/Roblox/creator-docs (CC BY 4.0, Roblox Corporation)', commit, generated: new Date().toISOString().slice(0, 10), classes, enums };
fs.writeFileSync(path.join(REPO, 'tool', 'studio', 'roblox-api.json'), JSON.stringify(out));
console.log('classes', Object.keys(classes).length, 'enums', Object.keys(enums).length, '->', 'tool/studio/roblox-api.json');
