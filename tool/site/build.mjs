// Página de producto de RbxUI Studio.
//   node site/build.mjs  ->  site/index.html (fragmento con los logos de las IAs en línea; lo sirve /landing y se publica como Artifact)
// Logos: lobe-icons (monocromos, currentColor), descargados en site/ai-*.svg.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const svg = (name) => fs.readFileSync(path.join(DIR, `ai-${name}.svg`), 'utf8')
  .replace(/<title>.*?<\/title>/, '')
  .replace(/\s(height|width)="1em"/g, '')
  .replace(/\sstyle="[^"]*"/, '')
  .replace('<svg', '<svg class="logo" aria-hidden="true"');
const src = fs.readFileSync(path.join(DIR, 'landing.src.html'), 'utf8');
const out = src.replace(/\{\{ai:(\w+)\}\}/g, (m, n) => svg(n));
fs.writeFileSync(path.join(DIR, 'index.html'), out);
console.log(`site/index.html (${(out.length / 1024).toFixed(1)} KB)`);
