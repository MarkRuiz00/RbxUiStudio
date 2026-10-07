#!/usr/bin/env node
// ui-resources.com helper (https://ui-resources.com — curated community library by Stuxfian).
// This repo NEVER commits those images: it links to them with author credit and downloads them locally on demand.
//
//   node tools/ui-resources.mjs index                 -> rewrite estilos/resources.md from the live catalog
//   node tools/ui-resources.mjs fetch 90 33 1217      -> download those ids into <root>/assets/ui-resources/...
//   node tools/ui-resources.mjs fetch --examples      -> download every resource used by ejemplos/*.rbxui.json
//   options: --root <dir>  (default: tool/ — the RbxUI Studio folder, so the editor can show them)
//
// Local file name = assets/ui-resources/<Category>/<Tag>/<id padded to 4>_<Title>.<ext>  (same scheme RbxUI Studio uses)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://ui-resources.com/api/resources';

// curated sections for estilos/resources.md: [title, why, filter, max]
const SECTIONS = [
  ['Stud textures', 'Classic Roblox stud pattern. Tile it (`ScaleType: "Tile"`) over a colored frame, `ImageTransparency` 0.7–0.9.', (r) => r.category === 'Textures' && has(r, 'Stud'), 12],
  ['Sunbursts', 'Rotating rays behind rewards, eggs and "NEW!" items. Spin with TweenService (Rotation 0→360, linear, looped).', (r) => has(r, 'Sunburst', 'Sunbursts'), 14],
  ['Sparkles & stars', 'Small glints on buttons, rarity frames and reward popups.', (r) => r.category === 'Effects' && has(r, 'Stars', 'Sparkle', 'Sparke'), 12],
  ['Halftones', 'Comic-style dot gradients for headers and backgrounds (cartoony/anime styles).', (r) => has(r, 'Halftones', 'Halftone'), 10],
  ['Speed lines, rays & lines', 'Energy/motion behind titles and level-up screens.', (r) => r.category === 'Effects' && has(r, 'Speedlines', 'Rays', 'Lines'), 10],
  ['Surface textures', 'Metal, paper, grid, checkerboard, crystal, gradient textures for panels.', (r) => r.category === 'Textures' && !has(r, 'Stud'), 16],
  ['Backgrounds', 'Loading-screen and menu backgrounds (check each author before shipping).', (r) => r.category === 'Backgrounds', 16],
  ['Roblox plugins', 'Studio plugins that speed up UI work.', (r) => r.category === 'Plugins', 12],
  ['Tutorials & guides', 'Videos/articles about Roblox UI.', (r) => r.category === 'Tutorials' || (r.category === 'Websites' && has(r, 'Guides', 'UI', 'Roblox')), 12],
];
const has = (r, ...tags) => (r.tags || []).some((t) => tags.some((x) => String(t).toLowerCase() === x.toLowerCase()));
const author = (r) => String(r.description || '').replace(/^By\s+/i, '').trim() || 'unknown';
const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const localPath = (r) => {
  const url = r.download_url || '';
  const ext = (path.extname(new URL(url).pathname) || '.png').toLowerCase();
  const tag = slug((r.tags || [])[0] || 'misc');
  return `assets/ui-resources/${slug(r.category)}/${tag}/${String(r.id).padStart(4, '0')}_${slug(r.title)}${ext}`;
};

async function catalog() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`ui-resources API: HTTP ${res.status}`);
  return (await res.json()).resources;
}

async function writeIndex() {
  const all = await catalog();
  let md = `# Curated resources from ui-resources.com

[ui-resources.com](https://ui-resources.com) is a free, community-run library of Roblox UI/GFX resources (founded by Stuxfian).
This page is **generated** by \`node tools/ui-resources.mjs index\` from its public catalog (${all.length} resources, ${new Date().toISOString().slice(0, 10)}).

**Licensing:** every resource belongs to its author. ui-resources.com publishes no license of its own, so this repo only **links** to the files
and credits the author. Before shipping one in a game, check the author's terms (follow the credit link / the resource page) and credit them.

**Using one in RbxUI:** \`node tools/ui-resources.mjs fetch <id>\` downloads it to \`tool/assets/ui-resources/...\`; reference that path as \`Image\`
(RbxUI uploads it to Roblox when you install), or upload it yourself and use \`rbxassetid://\`.

**Formats:** Roblox's Asset Manager imports PNG/JPG/GIF/TGA/BMP — convert \`.webp\` files to PNG before uploading them by hand. Keep images ≤ 1024 px.

`;
  for (const [title, why, filter, max] of SECTIONS) {
    const list = all.filter(filter).filter((r) => r.download_url || r.website_url);
    if (!list.length) continue;
    md += `## ${title}\n\n${why} (${list.length} in the catalog, showing ${Math.min(max, list.length)}.)\n\n| id | Resource | Author | Tags | Link | Local path |\n|---|---|---|---|---|---|\n`;
    for (const r of list.slice(0, max)) {
      const link = r.download_url || r.website_url;
      const local = r.download_url && /\.(png|jpe?g|webp)$/i.test(new URL(r.download_url).pathname) ? `\`${localPath(r)}\`` : '—';
      md += `| ${r.id} | ${r.title} | ${author(r)} | ${(r.tags || []).join(', ')} | [open](${link}) | ${local} |\n`;
    }
    md += '\n';
  }
  md += `Browse everything at <https://ui-resources.com>. Suggest new resources there.\n`;
  const out = path.join(REPO, 'estilos', 'resources.md');
  fs.writeFileSync(out, md);
  console.log('wrote', path.relative(REPO, out));
}

function idsFromExamples() {
  const ids = new Set();
  const dir = path.join(REPO, 'ejemplos');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.rbxui.json'))) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of s.matchAll(/assets\/ui-resources\/[^"]*?\/(\d+)_[^"/]*\.(?:png|jpe?g|webp)/g)) ids.add(+m[1]);
  }
  return [...ids];
}

async function fetchIds(ids, root) {
  const all = await catalog();
  for (const id of ids) {
    const r = all.find((x) => x.id === id);
    if (!r || !r.download_url) { console.warn('skip', id, '(not found or no direct file)'); continue; }
    const rel = localPath(r), file = path.join(root, rel);
    if (fs.existsSync(file)) { console.log('have', rel); continue; }
    const res = await fetch(r.download_url);
    if (!res.ok) { console.warn('fail', id, res.status); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('got ', rel, '— by', author(r));
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const ri = rest.indexOf('--root');
const root = ri >= 0 ? path.resolve(rest[ri + 1]) : path.join(REPO, 'tool');
if (cmd === 'index') await writeIndex();
else if (cmd === 'fetch') await fetchIds(rest.includes('--examples') ? idsFromExamples() : rest.filter((x, i) => /^\d+$/.test(x) && rest[i - 1] !== '--root').map(Number), root);
else console.log('usage: node tools/ui-resources.mjs index | fetch <ids...> [--examples] [--root <dir>]');
