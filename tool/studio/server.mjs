// RbxUI Studio — servidor local (sin dependencias): estáticos de rbxui/ + API.
//   node rbxui/studio/server.mjs   ->   http://localhost:5170/studio/
// API
//   GET  /api/scenes                 escenas (screens/*.scene.json)
//   GET  /api/screens                pantallas DS importables (screens/*.html)
//   GET  /api/scene?name=X           escena
//   POST /api/scene?name=X           guarda escena (+ genera screens/X.scene.html)
//   POST /api/export?name=X          export.mjs -> out/X (PNG + build.luau)
//   POST /api/import?src=screens/..  convierte una pantalla DS en escena
//   GET  /api/icons                  iconos disponibles
//   POST /api/rbxui/import           body = JSON rbxui -> una escena nativa por ScreenGui (las DS del mismo nombre van a screens/ds_backup/)
//   GET  /api/rbxui?names=A,B        escenas nativas -> documento JSON rbxui
//   POST /api/native/build?names=A,B JSON rbxui -> out/native/<A>.build.luau (Instances reales, sin PNG)
//   POST /api/figma/paste?w&h        body = text/html del portapapeles de Figma -> nodos rbxui (ver figma.mjs)
//   POST /api/figma/fig              body = .fig -> frames que trae (se guarda en out/figma/last.fig)
//   POST /api/figma/fig-import?id    frame del último .fig -> nodos rbxui (con sus imágenes)
//   POST /api/figma/image            body = PNG/JPG/WEBP -> assets/figma/<sha1>.<ext>
//   POST /api/figma/svg              body = SVG -> PNG en assets/figma/
//   GET  /api/logos                  carpetas de logos (assets/logos/<carpeta>/…)
//   POST /api/logos?folder&name      body = PNG/JPG/WEBP/SVG -> assets/logos/<carpeta>/<name>
//   DELETE /api/logos?folder[&name]  borra una carpeta de logos (o un archivo)
//   GET  /api/examples               ejemplos para la IA (examples/<id>.json)
//   POST /api/examples               body = {id?, name, desc, tags, include, source, rbxui} -> guarda
//   DELETE /api/examples?id          borra un ejemplo
//   GET  /api/ai-prompt?examples=marked|all|none|id,id   prompt del formato rbxui + ejemplos de referencia
//   GET  /api/render?name            PNG de una escena guardada (Chrome headless sobre studio/view.html)
//   GET  /api/events                 SSE: el editor recibe avisos (MCP, escenas cambiadas, RPC)
//   POST /api/editor/state|reply     el editor publica su estado / responde a un RPC
//   POST /api/editor/rpc             body = {method, params} -> lo ejecuta el editor abierto (lo usa mcp.mjs)
//   GET  /api/mcp/status             clientes MCP conectados, actividad y configuración de Claude Code / Desktop / Cursor
//   POST /api/mcp/hello|bye|log      latido y actividad de mcp.mjs
//   POST /api/mcp/connect?target&off conectar / desconectar el MCP en claude-code | claude-desktop | cursor
//   POST /api/mcp/test               arranca mcp.mjs, hace initialize + tools/list y lo cierra
//   GET  /api/studio/poll?sid…       el plugin RbxUI Connect espera trabajos (long-poll 20 s); POST /api/studio/result|progress|bye
//   GET  /api/studio/status          Studio conectado, estado del plugin, actividad · POST /api/studio/plugin[?off=1] instala/quita el plugin
//   POST /api/studio/install?names   sube imágenes que falten + crea las Instances en Studio (trabajo install)
//   POST /api/studio/upload?names    sube imágenes locales desde Studio (EditableImage + CreateAssetAsync) -> rbx_assets.json
//   GET  /api/studio/guis · POST /api/studio/pull?names   ScreenGuis de Studio -> escena nativa (ids sin archivo -> miniaturas en assets/roblox/)
//   GET  /api/studio/pixels?path     imagen local -> RGBA base64 (≤1024 px) para el plugin
import http from 'http';
import os from 'os';
import { createRequire } from 'module';
import { buildLuau, imagesOf, loadAssets } from './rbxbuild.mjs';
import crypto from 'crypto';
import { fromClipboardHtml, openFig, convertFigma, listFrames, rasterize, IMG_REL, fillMasks } from './figma.mjs';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { sceneHtml, safe } from './scenehtml.mjs';

const require = createRequire(import.meta.url);
const R = require('./rbxjson.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS = path.join(ROOT, 'screens');
const LOGOS = path.join(ROOT, 'assets', 'logos');
const EXAMPLES = path.join(ROOT, 'examples');
const MCP_JS = path.join(ROOT, 'studio', 'mcp.mjs');
const PORT = +(process.env.PORT || 5170);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.cjs': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.luau': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};
const IMG_EXT = /\.(png|jpe?g|webp|svg)$/i;
const cleanName = (s, def = '') => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/^[._]+|_+$/g, '').slice(0, 80) || def;

// ---------------------------------------------------------------- eventos en vivo (SSE) + RPC al editor
const sse = new Map();                                    // cid (pestaña del editor) -> respuesta SSE
const broadcast = (ev) => { const s = `data: ${JSON.stringify(ev)}\n\n`; for (const r of sse.values()) r.write(s); };
setInterval(() => { for (const r of sse.values()) r.write(': ping\n\n'); }, 20000).unref();
let editorState = null;                                   // { cid, scene, native, dirty, selection, at } de la última pestaña activa
const pending = new Map();                                // id RPC -> { ok, ko, t }
function editorRpc(method, params, ms = 10000) {
  if (!sse.size) return Promise.reject(new Error('El editor RbxUI Studio no está abierto (http://localhost:' + PORT + '/studio/)'));
  const id = crypto.randomUUID();
  // solo responde la pestaña activa (la última que publicó su estado); si ya no está, la primera que conteste
  const to = editorState && sse.has(editorState.cid) ? editorState.cid : null;
  return new Promise((ok, ko) => {
    const t = setTimeout(() => { pending.delete(id); ko(new Error('El editor no respondió a tiempo')); }, ms);
    pending.set(id, { ok, ko, t });
    broadcast({ type: 'rpc', id, to, method, params });
  });
}

// ---------------------------------------------------------------- MCP: clientes, actividad, configuración
const mcpClients = new Map();                             // sid -> { client, version, pid, since, seen, calls }
const mcpLog = [];                                        // últimas llamadas
const activeClients = () => [...mcpClients.values()].filter((c) => Date.now() - c.seen < 45000);
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const MCP_TARGETS = {
  'claude-desktop': path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json'),
  cursor: path.join(os.homedir(), '.cursor', 'mcp.json'),
};
const mcpEntry = () => ({ command: process.execPath, args: [MCP_JS] });
function mcpConfigured() {
  const cc = readJson(path.join(os.homedir(), '.claude.json'));
  const out = { 'claude-code': !!(cc && cc.mcpServers && cc.mcpServers.rbxui) };
  for (const [k, f] of Object.entries(MCP_TARGETS)) { const j = readJson(f); out[k] = !!(j && j.mcpServers && j.mcpServers.rbxui); }
  return out;
}
const runCmd = (cmd, args) => new Promise((ok) => execFile(cmd, args, { shell: true, windowsHide: true, timeout: 60000 }, (err, out, errOut) =>
  ok({ ok: !err, out: String(out + errOut).trim() })));
async function mcpConnect(target, off) {
  if (target === 'claude-code') {
    const q = (s) => `"${s}"`;
    if (off) return runCmd('claude', ['mcp', 'remove', '-s', 'user', 'rbxui']);
    if (mcpConfigured()['claude-code']) await runCmd('claude', ['mcp', 'remove', '-s', 'user', 'rbxui']);
    return runCmd('claude', ['mcp', 'add', '-s', 'user', 'rbxui', '--', q(process.execPath), q(MCP_JS)]);
  }
  const f = MCP_TARGETS[target];
  if (!f) throw new Error('destino desconocido: ' + target);
  const j = readJson(f) || {};
  if (fs.existsSync(f)) fs.copyFileSync(f, f + '.rbxui.bak');
  j.mcpServers = j.mcpServers || {};
  if (off) delete j.mcpServers.rbxui; else j.mcpServers.rbxui = mcpEntry();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  return { ok: true, out: `${off ? 'Quitado de' : 'Añadido a'} ${f}` + (target === 'claude-desktop' ? ' · reinicia Claude Desktop' : ' · recarga Cursor') };
}
// prueba real: arranca mcp.mjs como lo haría un cliente y pide la lista de herramientas
function mcpSelfTest() {
  return new Promise((ok) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [MCP_JS], { env: { ...process.env, RBXUI_SELFTEST: '1' }, windowsHide: true });
    let buf = '', done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(to); p.kill(); ok({ ...r, ms: Date.now() - t0 }); };
    const to = setTimeout(() => finish({ ok: false, error: 'sin respuesta en 8 s' }), 8000);
    const send = (m) => p.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
    p.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        const m = JSON.parse(line);
        if (m.id === 1) { send({ method: 'notifications/initialized' }); send({ id: 2, method: 'tools/list' }); }
        if (m.id === 2) finish({ ok: true, server: 'rbxui-studio', tools: m.result.tools.map((x) => ({ name: x.name, description: x.description })) });
      }
    });
    p.on('error', (e) => finish({ ok: false, error: e.message }));
    p.on('exit', (c) => finish({ ok: false, error: 'mcp.mjs terminó (código ' + c + ')' }));
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'rbxui-selftest', version: '1' } } });
  });
}

// ---------------------------------------------------------------- proyectos (grupos de escenas) y carpetas: projects.json
const PROJECTS = path.join(ROOT, 'projects.json');
for (const d of [SCREENS, EXAMPLES, LOGOS]) fs.mkdirSync(d, { recursive: true });   // instalación limpia
const pid = (pre) => pre + '_' + crypto.randomBytes(5).toString('hex');
const sceneFiles = () => fs.readdirSync(SCREENS).filter((f) => f.endsWith('.scene.json')).map((f) => f.slice(0, -11));
function loadProjects() {
  let db = readJson(PROJECTS);
  if (!db) {                                   // primera vez: las escenas que había se agrupan en proyectos
    const all = sceneFiles();
    db = { folders: [], projects: all.length ? [{ id: pid('p'), name: 'My scenes', folder: null, scenes: all, created: Date.now() }] : [] };
    saveProjects(db);
  }
  db.folders ||= []; db.projects ||= [];
  return db;
}
const saveProjects = (db) => fs.writeFileSync(PROJECTS, JSON.stringify(db, null, 1));
function addToProject(id, names) {
  if (!id || !names?.length) return;
  const db = loadProjects(), pr = db.projects.find((x) => x.id === id);
  if (!pr) return;
  for (const n of names) if (!pr.scenes.includes(n)) pr.scenes.push(n);
  saveProjects(db);
}
function projectsView() {
  const db = loadProjects(), files = new Set(sceneFiles()), used = new Set();
  const mt = (n) => { try { return fs.statSync(path.join(SCREENS, n + '.scene.json')).mtimeMs; } catch { return 0; } };
  const projects = db.projects.map((pr) => {
    const scenes = pr.scenes.filter((n) => files.has(n));
    scenes.forEach((n) => used.add(n));
    // portada = la pantalla más completa (el archivo más grande), no la primera
    const size = (n) => { try { return fs.statSync(path.join(SCREENS, n + '.scene.json')).size; } catch { return 0; } };
    const cover = scenes.slice().sort((a, b) => size(b) - size(a))[0] || null;
    return { ...pr, scenes, cover, updated: Math.max(pr.created || 0, ...scenes.map(mt)) };
  }).sort((a, b) => b.updated - a.updated);
  return { folders: db.folders, projects, loose: [...files].filter((n) => !used.has(n)).sort() };
}
function projectAction(b) {
  const db = loadProjects();
  const pr = b.id ? db.projects.find((x) => x.id === b.id) : null;
  const folderOk = (f) => (f && db.folders.some((x) => x.id === f) ? f : null);
  switch (b.action) {
    case 'create': {
      const name = String(b.name || '').trim().slice(0, 60) || 'Proyecto';
      let scene = safe(b.scene) || safe(name.replace(/\s+(\w)/g, (m, c) => c.toUpperCase())) + 'Screen';
      for (let i = 2; fs.existsSync(path.join(SCREENS, scene + '.scene.json')); i++) scene = scene.replace(/\d*$/, '') + i;
      const sc = { name: scene, native: true, stage: { w: 1280, h: 720 }, design: { ...R.DESIGN_DEF, background: 'baseplate' }, gui: { props: {} }, nodes: [] };
      fs.writeFileSync(path.join(SCREENS, scene + '.scene.json'), JSON.stringify(sc, null, 1));
      fs.writeFileSync(path.join(SCREENS, scene + '.scene.html'), sceneHtml(sc));
      const np = { id: pid('p'), name, folder: folderOk(b.folder), scenes: [scene], created: Date.now() };
      db.projects.push(np); saveProjects(db);
      return { project: np };
    }
    case 'update': {
      if (!pr) throw new Error('no existe el proyecto');
      if (b.name != null) pr.name = String(b.name).trim().slice(0, 60) || pr.name;
      if ('folder' in b) pr.folder = folderOk(b.folder);
      saveProjects(db); return { project: pr };
    }
    case 'delete': {                             // las escenas pasan a «sueltas» (o a screens/_papelera si se pide)
      if (!pr) throw new Error('no existe el proyecto');
      if (b.deleteScenes) {
        const bin = path.join(SCREENS, '_papelera'); fs.mkdirSync(bin, { recursive: true });
        for (const n of pr.scenes) for (const ext of ['.scene.json', '.scene.html', '.rbxui.json']) {
          const f = path.join(SCREENS, n + ext); if (fs.existsSync(f)) fs.renameSync(f, path.join(bin, n + ext));
        }
      }
      db.projects = db.projects.filter((x) => x !== pr); saveProjects(db); return { ok: true };
    }
    case 'addScenes': {
      if (!pr) throw new Error('no existe el proyecto');
      for (const x of db.projects) if (x !== pr) x.scenes = x.scenes.filter((n) => !(b.names || []).includes(n));
      for (const n of b.names || []) if (!pr.scenes.includes(n)) pr.scenes.push(safe(n));
      saveProjects(db); return { project: pr };
    }
    case 'removeScene': { if (pr) { pr.scenes = pr.scenes.filter((n) => n !== b.name); saveProjects(db); } return { ok: true }; }
    case 'folderCreate': {
      const f = { id: pid('f'), name: String(b.name || '').trim().slice(0, 40) || 'Carpeta', color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#2fd6ff' };
      db.folders.push(f); saveProjects(db); return { folder: f };
    }
    case 'folderUpdate': {
      const f = db.folders.find((x) => x.id === b.id); if (!f) throw new Error('no existe la carpeta');
      if (b.name != null) f.name = String(b.name).trim().slice(0, 40) || f.name;
      if (/^#[0-9a-f]{6}$/i.test(b.color || '')) f.color = b.color;
      saveProjects(db); return { folder: f };
    }
    case 'folderDelete': {                       // los proyectos de la carpeta quedan «sin carpeta»
      db.folders = db.folders.filter((x) => x.id !== b.id);
      for (const x of db.projects) if (x.folder === b.id) x.folder = null;
      saveProjects(db); return { ok: true };
    }
    default: throw new Error('acción desconocida: ' + b.action);
  }
}

// ---------------------------------------------------------------- logos y ejemplos
function listLogos() {
  if (!fs.existsSync(LOGOS)) return [];
  return fs.readdirSync(LOGOS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => ({
    folder: d.name,
    files: fs.readdirSync(path.join(LOGOS, d.name)).filter((f) => IMG_EXT.test(f)).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
      .map((f) => ({ name: f.replace(IMG_EXT, ''), path: `assets/logos/${d.name}/${f}`, svg: /\.svg$/i.test(f) })),
  })).sort((a, b) => a.folder.localeCompare(b.folder, 'es'));
}
// «apuntes» de un ejemplo: cómo está construido, resumido para que la IA aprenda la técnica y no solo copie el JSON
function studyNotes(doc) {
  const colors = new Map(), fonts = new Map(), strokes = [], radii = [], sizes = [], cls = new Map();
  let grads = 0, depth = 0, layers = 0, images = 0, buttons = 0;
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const walk = (n, d) => {
    if (!n || !n.ClassName) return;
    const p = n.props || {};
    if (n.ClassName === 'UIStroke') strokes.push(+p.Thickness || 1);
    else if (n.ClassName === 'UICorner' && Array.isArray(p.CornerRadius)) radii.push(p.CornerRadius[0] ? `${Math.round(p.CornerRadius[0] * 100)}%` : `${p.CornerRadius[1]}px`);
    else if (n.ClassName === 'UIGradient') { grads++; for (const k of Array.isArray(p.Color) ? p.Color : []) bump(colors, String(k[1]).toUpperCase()); }
    else if (!/^UI/.test(n.ClassName) && n.ClassName !== 'ScreenGui') {
      layers++; depth = Math.max(depth, d); bump(cls, n.ClassName);
      if (/Button$/.test(n.ClassName) || n.buttonFx) buttons++;
      if (/^Image/.test(n.ClassName)) images++;
      if (p.BackgroundColor3 && (p.BackgroundTransparency ?? 0) < 1) bump(colors, String(p.BackgroundColor3).toUpperCase());
      if (p.TextColor3) bump(colors, String(p.TextColor3).toUpperCase());
      if (p.FontFace) bump(fonts, `${String(p.FontFace.family).replace(/^rbxassetid:\/\//, 'asset ')} ${p.FontFace.weight || 'Regular'}`);
      if (p.TextSize) sizes.push(+p.TextSize);
    }
    for (const c of n.children || []) walk(c, d + 1);
  };
  for (const sg of doc.screens || []) walk(sg, 0);
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map((x) => x[0]);
  const range = (a) => (a.length ? (Math.min(...a) === Math.max(...a) ? `${Math.min(...a)}` : `${Math.min(...a)}–${Math.max(...a)}`) : '—');
  return { layers, depth, buttons, images, gradients: grads, palette: top(colors, 8), fonts: top(fonts, 4), textSizes: range(sizes),
    strokes: range(strokes), radii: [...new Set(radii)].slice(0, 5), classes: top(cls, 6) };
}
const notesText = (n) => [
  `- Structure: ${n.layers} layers, ${n.depth} levels deep; mostly ${n.classes.join(', ')}; ${n.buttons} buttons, ${n.images} images`,
  `- Palette (most used first): ${n.palette.join(' ') || '—'}; ${n.gradients} UIGradient`,
  `- Type: ${n.fonts.join(' / ') || '—'}; TextSize ${n.textSizes}`,
  `- Edges: UIStroke thickness ${n.strokes}; UICorner ${n.radii.join(', ') || 'none (square)'}`,
].join('\n');

function listExamples(full) {
  if (!fs.existsSync(EXAMPLES)) return [];
  return fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(EXAMPLES, f))).filter(Boolean)
    .sort((a, b) => (a.created || 0) - (b.created || 0))
    .map((e) => (full ? { ...e, notes: studyNotes(e.rbxui || {}) } : { ...e, rbxui: undefined, chars: JSON.stringify(e.rbxui || {}).length, notes: studyNotes(e.rbxui || {}) }));
}
function aiPrompt(which = 'marked') {
  const all = listExamples(true);
  const ids = new Set(String(which).split(','));
  const ex = which === 'none' ? [] : which === 'all' ? all : which === 'marked' ? all.filter((e) => e.include !== false) : all.filter((e) => ids.has(e.id));
  if (!ex.length) return { text: R.AI_PROMPT, examples: 0 };
  const parts = [R.AI_PROMPT, '',
    `STUDY NOTES FROM THE USER (${ex.length}). These are real UIs the user designed in Figma, converted to rbxui, and handed to you the way a teacher hands ` +
    'notes to students: study HOW each one is built before designing anything — the layer hierarchy (what is a container, what is decoration), how ' +
    'gradients, UIStroke and shadows give the 3D look, the palette, fonts and text sizes, corner radii, spacing and proportions. Then build new screens ' +
    'with those same techniques, as if the user had made them. Do not copy their texts or layouts verbatim unless asked. Local image paths in them exist ' +
    'in the project and can be reused. Each note starts with a summary of its technique, then the full rbxui.'];
  ex.forEach((e, i) => parts.push('', `### Note ${i + 1}: ${e.name}${e.desc ? ' — ' + e.desc : ''}${e.tags?.length ? ' [' + e.tags.join(', ') + ']' : ''}`,
    notesText(studyNotes(e.rbxui)), '```json', JSON.stringify(e.rbxui), '```'));
  return { text: parts.join('\n'), examples: ex.length };
}

// ---------------------------------------------------------------- Chrome headless compartido (render de escenas, píxeles de imágenes)
let renderBrowser = null, renderIdle = 0;
async function chrome() {
  if (!renderBrowser) renderBrowser = await require('./browser.cjs').launch();
  clearTimeout(renderIdle);
  renderIdle = setTimeout(() => { renderBrowser?.close().catch(() => {}); renderBrowser = null; }, 90000);
  return renderBrowser;
}
// imagen local -> píxeles RGBA (máx. 1024 px por lado, el límite de EditableImage) en base64, para que el plugin la suba
async function imagePixels(rel) {
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) throw new Error('no existe ' + rel);
  const buf = fs.readFileSync(abs), ext = path.extname(abs).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext] || 'image/png';
  const page = await (await chrome()).newPage();
  try {
    return await page.evaluate(async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
      cx.drawImage(im, 0, 0, w, h);
      const px = cx.getImageData(0, 0, w, h).data;
      let bin = '';
      for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
      return { w, h, data: btoa(bin) };
    }, `data:${mime};base64,${buf.toString('base64')}`);
  } finally { await page.close(); }
}

// ---------------------------------------------------------------- Roblox Studio: plugin RbxUI Connect (long-poll de trabajos)
const PLUGIN_SRC = path.join(ROOT, 'plugin', 'RbxUIConnect.plugin.luau');
const PLUGIN_DST = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Roblox', 'Plugins', 'RbxUIConnect.lua');
const PLUGIN_VERSION = () => (/PLUGIN_VERSION\s*=\s*"([^"]+)"/.exec(fs.existsSync(PLUGIN_SRC) ? fs.readFileSync(PLUGIN_SRC, 'utf8') : '') || [])[1] || '?';
const studios = new Map();                                // sid (sesión del plugin) -> { sid, place, placeId, user, userId, version, since, seen }
const studioJobs = [];                                    // trabajos pendientes / enviados
const studioWait = new Map();                             // sid -> { res, t } (long-poll abierto)
const studioLog = [];
let jobSeq = 0;
const autoTimers = new Map();                             // escena -> temporizador de autoinstalación
const activeStudios = () => [...studios.values()].filter((x) => Date.now() - x.seen < 35000).sort((a, b) => b.seen - a.seen);
const logStudio = (e) => { studioLog.push({ ...e, at: Date.now() }); if (studioLog.length > 40) studioLog.shift(); broadcast({ type: 'studio', ...e }); };
function sendJobs(res, sid) {
  const list = studioJobs.filter((j) => j.sid === sid && !j.sent).map((j) => { j.sent = true; return { seq: j.seq, type: j.type, payload: j.payload }; });
  json(res, 200, { jobs: list });
}
function studioJob(type, payload, { timeout = 120000 } = {}) {
  const st = activeStudios()[0];
  if (!st) return Promise.reject(new Error('Roblox Studio no está conectado: abre tu place en Studio (plugin RbxUI Connect)'));
  const job = { seq: ++jobSeq, sid: st.sid, type, payload, at: Date.now() };
  return new Promise((ok, ko) => {
    job.ok = ok; job.ko = ko;
    job.t = setTimeout(() => { studioJobs.splice(studioJobs.indexOf(job), 1); ko(new Error(`Roblox Studio no respondió (${type})`)); }, timeout);
    studioJobs.push(job);
    const w = studioWait.get(st.sid);
    if (w) { studioWait.delete(st.sid); clearTimeout(w.t); sendJobs(w.res, st.sid); }
  });
}
function recordAsset(rel, id) {
  const f = path.join(ROOT, 'assets', 'rbx_assets.json');
  const m = readJson(f) || {};
  m[rel] = 'rbxassetid://' + String(id).replace(/\D/g, '');
  fs.writeFileSync(f, JSON.stringify(m, null, 1));
}
// imágenes locales de unas escenas que aún no tienen rbxassetid
function missingImages(names) {
  const map = loadAssets();
  const scs = String(names || '').split(',').map(safe).filter(Boolean).map((n) => readJson(path.join(SCREENS, n + '.scene.json'))).filter((x) => x && x.native);
  if (!scs.length) return [];
  return imagesOf(R.scenesToDoc(scs, 'X')).filter((p) => !map[p] && fs.existsSync(path.join(ROOT, p)));
}
async function studioUpload(names) {
  const items = missingImages(names);
  if (!items.length) return { uploaded: 0, failed: [] };
  logStudio({ event: 'upload', count: items.length });
  const r = await studioJob('upload', { items: items.map((p) => ({ path: p, name: path.basename(p).replace(/\.\w+$/, '').slice(0, 50) })) }, { timeout: 15 * 60000 });
  return { uploaded: Object.keys(r.ids || {}).length, failed: r.errors || {} };
}
async function studioInstall(names, docName, upload = true) {
  const list = String(names || '').split(',').map(safe).filter(Boolean);
  const scs = list.map((n) => readJson(path.join(SCREENS, n + '.scene.json'))).filter((x) => x && x.native);
  if (!scs.length) throw new Error('ninguna escena nativa: ' + names);
  let up = null;
  if (upload) up = await studioUpload(list.join(','));
  const doc = R.scenesToDoc(scs, safe(docName) || scs[0].name);
  const { src, missing } = buildLuau(doc);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'RbxUINative.client.luau'), 'utf8');
  logStudio({ event: 'install', names: list });
  const r = await studioJob('install', { src, runtime, screens: doc.screens.map((x) => x.Name) }, { timeout: 90000 });
  return { message: r.message, missing, upload: up, screens: doc.screens.map((x) => x.Name) };
}
// rbxassetid sin archivo local -> miniatura de Roblox (thumbnails API) guardada en assets/roblox/ y registrada
async function localizeIds(doc) {
  const map = loadAssets(), byId = {};
  for (const [p, id] of Object.entries(map)) byId[String(id).replace(/\D/g, '')] = p;
  const ids = new Set();
  const walk = (n) => { for (const k of ['Image', 'HoverImage', 'PressedImage']) { const m = /(\d{5,})/.exec(String(n.props?.[k] || '')); if (m && !byId[m[1]]) ids.add(m[1]); } (n.children || []).forEach(walk); };
  doc.screens.forEach(walk);
  if (!ids.size) return 0;
  let got = 0;
  const all = [...ids];
  for (let i = 0; i < all.length; i += 50) {
    const part = all.slice(i, i + 50);
    try {
      const r = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${part.join(',')}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`, { signal: AbortSignal.timeout(15000) }).then((x) => x.json());
      for (const t of r.data || []) {
        if (t.state !== 'Completed' || !t.imageUrl) continue;
        const b = Buffer.from(await fetch(t.imageUrl, { signal: AbortSignal.timeout(15000) }).then((x) => x.arrayBuffer()));
        const rel = `assets/roblox/${t.targetId}.png`;
        fs.mkdirSync(path.join(ROOT, 'assets', 'roblox'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, rel), b);
        recordAsset(rel, t.targetId); got++;
      }
    } catch { /* sin red: las imágenes quedan como id (en Roblox siguen bien) */ }
  }
  return got;
}

// ---------------------------------------------------------------- render de una escena guardada a PNG
async function renderScene(name, scale = 1) {
  const page = await (await chrome()).newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: scale });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/studio/view.html?scene=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 15000 });
    const err = await page.evaluate(() => window.__error);
    if (err) throw new Error(err);
    return await page.locator('#stage').screenshot();
  } finally { await page.close(); }
}

// página de error (navegador): mascota del enchufe + enlace al editor
const errorPage = (res, code, title, detail) => {
  const img = code === 401 || code === 403 ? 'mascot_lock' : code === 404 ? 'mascot_search' : 'mascot_error';
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.writeHead(code, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${code} · RbxUI Studio</title><link rel="icon" href="/studio/brand/favicon.png">
<meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#1d1b34,#1e1e1e 62%);color:#fff;font:14px/1.5 Inter,system-ui,sans-serif;padding:16px;box-sizing:border-box}
main{text-align:center;max-width:460px}img{width:min(300px,80vw);filter:drop-shadow(0 16px 28px rgba(60,40,200,.4));animation:f 3.2s ease-in-out infinite}
@keyframes f{50%{transform:translateY(-10px)}}h1{margin:10px 0 4px;font-size:40px;font-weight:800;background:linear-gradient(135deg,#b84dff,#6a3cff 38%,#2d7bff 68%,#2fd6ff);-webkit-background-clip:text;background-clip:text;color:transparent}
h2{margin:0 0 8px;font-size:17px}p{margin:0 0 18px;color:rgba(255,255,255,.65)}code{font:12px/1.4 Consolas,monospace;color:rgba(255,255,255,.55);word-break:break-all}
a{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 18px;border-radius:10px;color:#fff;text-decoration:none;font-weight:600;background:linear-gradient(135deg,#b84dff,#6a3cff 38%,#2d7bff 68%,#2fd6ff);box-shadow:0 8px 24px -8px rgba(92,76,255,.8)}
@media (prefers-reduced-motion:reduce){img{animation:none}}</style></head><body><main><img src="/studio/brand/${img}.png" alt="">
<h1>${code}</h1><h2>${esc(title)}</h2><p>${detail ? `<code>${esc(detail)}</code>` : 'Lo que buscas no está aquí.'}</p><a href="/studio/">Volver al editor</a></main></body></html>`);
};
const wantsHtml = (req, p) => !p.startsWith('/api/') && /text\/html/.test(req.headers.accept || '');
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const readRaw = (req) => new Promise((ok, ko) => { const cs = []; req.on('data', (c) => cs.push(c)); req.on('end', () => ok(Buffer.concat(cs))); req.on('error', ko); });
// ancho/alto de un PNG / JPEG / WEBP (para insertar la imagen a su tamaño)
function imageSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), ext: 'jpg' };
      i += 2 + len;
    }
    return { w: 256, h: 256, ext: 'jpg' };
  }
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return { w: 256, h: 256, ext: 'webp' };
  return null;
}
const readBody = (req) => new Promise((ok, ko) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); req.on('error', ko); });
const runNode = (args) => new Promise((ok) =>
  execFile(process.execPath, args, { cwd: ROOT, maxBuffer: 1 << 24 }, (err, out, errOut) => ok({ ok: !err, out: (out + errOut).trim() })));

// ---------------------------------------------------------------- acceso desde el móvil (misma Wi-Fi) con clave
// El servidor escucha en toda la red local, pero fuera de este PC solo responde con la clave del enlace/QR (cookie rbxui_t).
// Lo que toca la configuración del PC (conectar MCP, instalar el plugin, ver/cambiar la clave) solo desde este PC.
const LAN_FILE = path.join(ROOT, '.secrets', 'lan.json');
let lanToken = (readJson(LAN_FILE) || {}).token;
function newLanToken() {
  lanToken = crypto.randomBytes(18).toString('base64url');
  fs.mkdirSync(path.dirname(LAN_FILE), { recursive: true });
  fs.writeFileSync(LAN_FILE, JSON.stringify({ token: lanToken }));
  return lanToken;
}
if (!lanToken) newLanToken();
const isLoopback = (a) => /^(::1|127\.|::ffff:127\.)/.test(String(a || ''));
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address)
  .sort((a, b) => (/^192\.168\./.test(b) - /^192\.168\./.test(a)) || (/^10\./.test(b) - /^10\./.test(a)));
const LOCAL_ONLY = /^\/api\/(lan|mcp\/connect|mcp\/test|studio\/plugin)$/;
const cookieOf = (req, k) => (String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(k + '=')) || '').slice(k.length + 1);
const safeEq = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(u.pathname);
    if (!isLoopback(req.socket.remoteAddress)) {
      const qt = u.searchParams.get('t');
      if (qt && safeEq(qt, lanToken)) {                     // enlace del QR: se guarda la clave en una cookie y se limpia la URL
        u.searchParams.delete('t');
        res.writeHead(302, { 'Set-Cookie': `rbxui_t=${lanToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`, Location: u.pathname + (u.search || '') });
        return res.end();
      }
      if (!safeEq(cookieOf(req, 'rbxui_t'), lanToken)) {
        if (wantsHtml(req, p)) return errorPage(res, 401, 'Este enlace no vale (o ha caducado)', 'Abre RbxUI Studio en el PC → botón del móvil → escanea el QR.');
        return json(res, 401, { error: 'sin autorización: usa el enlace del QR' });
      }
      if (LOCAL_ONLY.test(p)) return json(res, 403, { error: 'solo desde el PC' });
    }
    if (p === '/api/lan') {
      if (req.method === 'POST' && u.searchParams.get('reset') === '1') newLanToken();
      return json(res, 200, { port: PORT, ips: lanIps(), urls: lanIps().map((ip) => `http://${ip}:${PORT}/studio/?t=${lanToken}`) });
    }

    if (p === '/landing') {                              // página de producto (site/index.html es un fragmento: se envuelve aquí)
      const body = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8').replace(/src="(?!https?:|data:|\/)/g, 'src="/site/');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="/studio/brand/favicon.png"><style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
    }
    if (p === '/' || p === '/studio' || p === '/home') { res.writeHead(302, { Location: '/studio/home.html' }); return res.end(); }

    if (p === '/api/projects') {
      if (req.method === 'POST') { const r = projectAction(JSON.parse(await readBody(req))); broadcast({ type: 'projects' }); return json(res, 200, r); }
      return json(res, 200, projectsView());
    }
    if (p === '/api/scenes') {
      return json(res, 200, fs.readdirSync(SCREENS).filter((f) => f.endsWith('.scene.json')).map((f) => f.slice(0, -11)).sort());
    }
    if (p === '/api/scenes-meta') {
      return json(res, 200, fs.readdirSync(SCREENS).filter((f) => f.endsWith('.scene.json')).sort().map((f) => {
        let native = false;
        try { native = !!JSON.parse(fs.readFileSync(path.join(SCREENS, f), 'utf8')).native; } catch { /* escena rota: se lista igual */ }
        return { name: f.slice(0, -11), native };
      }));
    }
    if (p === '/api/screens') {
      return json(res, 200, fs.readdirSync(SCREENS).filter((f) => f.endsWith('.html') && !f.endsWith('.scene.html')).sort());
    }
    if (p === '/api/scene') {
      const name = safe(u.searchParams.get('name'));
      if (!name) return json(res, 400, { error: 'falta name' });
      const file = path.join(SCREENS, name + '.scene.json');
      if (req.method === 'GET') {
        if (!fs.existsSync(file)) return json(res, 404, { error: 'no existe' });
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(file));
      }
      if (req.method === 'POST') {
        const scene = JSON.parse(await readBody(req));
        scene.name = name;
        const isNew = !fs.existsSync(file);
        fs.writeFileSync(file, JSON.stringify(scene, null, 1));
        if (isNew) addToProject(u.searchParams.get('project'), [name]);
        fs.writeFileSync(path.join(SCREENS, name + '.scene.html'), sceneHtml(scene));
        if (scene.native) fs.writeFileSync(path.join(SCREENS, name + '.rbxui.json'), JSON.stringify(R.scenesToDoc([scene], name), null, 1));
        // plugin con «instalar al guardar»: la escena llega sola a Studio
        if (scene.native && activeStudios().some((x) => x.auto)) {
          clearTimeout(autoTimers.get(name));
          autoTimers.set(name, setTimeout(() => studioInstall(name).catch((e) => logStudio({ event: 'error', message: e.message })), 800));
        }
        return json(res, 200, { ok: true });
      }
    }
    if (p === '/api/export' && req.method === 'POST') {
      const name = safe(u.searchParams.get('name'));
      const r = await runNode(['export.mjs', `screens/${name}.scene.html`]);
      return json(res, r.ok ? 200 : 500, r);
    }
    if (p === '/api/import' && req.method === 'POST') {
      const src = String(u.searchParams.get('src') || '');
      const abs = path.resolve(ROOT, src);
      if (!abs.startsWith(SCREENS) || !abs.endsWith('.html')) return json(res, 400, { error: 'ruta no válida' });
      const r = await runNode(['studio/convert.mjs', path.relative(ROOT, abs)]);
      return json(res, r.ok ? 200 : 500, { ...r, name: r.ok ? r.out.split(/\r?\n/).pop() : null });
    }
    if (p === '/api/rbxui/import' && req.method === 'POST') {
      const origin = u.searchParams.get('origin');
      const { scenes, warn } = R.docToScenes(await readBody(req));
      const bak = path.join(SCREENS, 'ds_backup');
      const names = [];
      for (const sc of scenes) {
        const name = safe(sc.name) || 'Screen';
        sc.name = name;
        const f = path.join(SCREENS, name + '.scene.json');
        if (fs.existsSync(f) && !JSON.parse(fs.readFileSync(f, 'utf8')).native) {
          fs.mkdirSync(bak, { recursive: true });
          fs.renameSync(f, path.join(bak, name + '.scene.json'));
        }
        fs.writeFileSync(f, JSON.stringify(sc, null, 1));
        fs.writeFileSync(path.join(SCREENS, name + '.scene.html'), sceneHtml(sc));
        names.push(name);
      }
      addToProject(u.searchParams.get('project') || (origin === 'mcp' ? editorState?.project : null), names);
      if (origin === 'mcp') broadcast({ type: 'scenes', names, open: u.searchParams.get('open') === '1', by: u.searchParams.get('client') || 'MCP' });
      return json(res, 200, { names, warn });
    }
    const sceneList = (q) => String(q || '').split(',').map(safe).filter(Boolean).map((n) => {
      const f = path.join(SCREENS, n + '.scene.json');
      if (!fs.existsSync(f)) throw new Error('no existe la escena ' + n);
      const sc = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!sc.native) throw new Error(n + ' no es una escena nativa (rbxui)');
      return sc;
    });
    if (p === '/api/rbxui') {
      const scs = sceneList(u.searchParams.get('names'));
      return json(res, 200, R.scenesToDoc(scs, u.searchParams.get('doc') || scs[0]?.name));
    }
    if (p === '/api/native/build' && req.method === 'POST') {
      const scs = sceneList(u.searchParams.get('names'));
      const name = safe(u.searchParams.get('doc')) || scs[0].name;
      const doc = R.scenesToDoc(scs, name);
      const { src, missing } = buildLuau(doc);
      const out = path.join(ROOT, 'out', 'native');
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, name + '.build.luau'), src);
      fs.writeFileSync(path.join(out, name + '.rbxui.json'), JSON.stringify(doc, null, 1));
      return json(res, 200, { file: `out/native/${name}.build.luau`, kb: +(src.length / 1024).toFixed(1), missing, screens: scs.map((s) => s.name) });
    }
    const FIG_DIR = path.join(ROOT, 'out', 'figma');
    const stageOpts = () => ({ stageW: +u.searchParams.get('w') || 1280, stageH: +u.searchParams.get('h') || 720, scale: +u.searchParams.get('scale') || undefined, scaleMode: u.searchParams.get('mode') || undefined, autoLayout: u.searchParams.get('layout') !== '0', flat: u.searchParams.get('bake') === 'flat' });
    if (p === '/api/figma/paste' && req.method === 'POST') {
      const html = await readBody(req);
      fs.mkdirSync(FIG_DIR, { recursive: true });
      fs.writeFileSync(path.join(FIG_DIR, 'last_paste.html'), html);
      const r = await fromClipboardHtml(html, stageOpts());
      return json(res, 200, r);
    }
    if (p === '/api/figma/fig' && req.method === 'POST') {
      const buf = await readRaw(req);
      const f = openFig(buf);
      fs.mkdirSync(FIG_DIR, { recursive: true });
      fs.writeFileSync(path.join(FIG_DIR, 'last.fig'), buf);
      return json(res, 200, { frames: listFrames(f.message), images: f.images.size, version: f.version });
    }
    if (p === '/api/figma/fig-import' && req.method === 'POST') {
      const f = openFig(fs.readFileSync(path.join(FIG_DIR, 'last.fig')));
      return json(res, 200, await convertFigma(f.message, { ...stageOpts(), rootId: u.searchParams.get('id'), images: f.images }));
    }
    // relleno de textura editado en el panel flotante: receta -> máscaras (PNG sin color, compartidas)
    if (p === '/api/fills/masks' && req.method === 'POST') {
      try { return json(res, 200, { masks: await fillMasks(JSON.parse(await readBody(req)).spec) }); }
      catch (e) { return json(res, 400, { error: String(e.message || e) }); }
    }
    if (p === '/api/figma/image' && req.method === 'POST') {
      const buf = await readRaw(req);
      const info = imageSize(buf);
      if (!info) return json(res, 400, { error: 'formato de imagen no soportado (PNG, JPG o WEBP)' });
      const rel = `${IMG_REL}/${crypto.createHash('sha1').update(buf).digest('hex')}.${info.ext}`;
      fs.mkdirSync(path.join(ROOT, IMG_REL), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel), buf);
      return json(res, 200, { path: rel, w: info.w, h: info.h });
    }
    if (p === '/api/figma/svg' && req.method === 'POST') {
      const svg = (await readBody(req)).trim();
      if (!/^<svg[\s>]/i.test(svg)) return json(res, 400, { error: 'no es un SVG' });
      const num = (re) => { const m = re.exec(svg.slice(0, svg.indexOf('>'))); return m ? parseFloat(m[1]) : 0; };
      const vb = /viewBox="[^"]*?([\d.]+)[ ,]+([\d.]+)"/.exec(svg.slice(0, svg.indexOf('>')));
      const w = num(/\swidth="([\d.]+)/) || (vb ? +vb[1] : 100), h = num(/\sheight="([\d.]+)/) || (vb ? +vb[2] : 100);
      const fixed = /\swidth="/.test(svg.slice(0, svg.indexOf('>'))) ? svg : svg.replace(/^<svg/i, `<svg width="${w}" height="${h}"`);
      const rel = `${IMG_REL}/${crypto.createHash('sha1').update(svg).digest('hex')}.png`;
      await rasterize([{ svg: fixed, rel, w, h }]);
      return json(res, 200, { path: rel, w, h });
    }
    // recursos de ui-resources (efectos, texturas, caras, iconos) para la pestaña Iconos
    if (p === '/api/resources') {
      const idxFile = path.join(ROOT, 'assets/ui-resources/index.json');
      const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : [];
      return json(res, 200, idx.filter((r) => /^(Effects|Textures|Faces|Icons)$/.test(r.cat) && fs.existsSync(path.join(ROOT, r.file)))
        .map((r) => ({ src: '../' + r.file, title: `${r.title} · ${r.tag}`, cat: r.cat })));
    }
    // fondos del lienzo: ui-resources/Backgrounds + los subidos (assets/backgrounds)
    if (p === '/api/backgrounds') {
      const list = [];
      for (const dir of ['assets/ui-resources/Backgrounds', 'assets/backgrounds']) {
        const abs = path.join(ROOT, dir);
        if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) if (/\.(png|jpe?g|webp)$/i.test(f)) list.push(`${dir}/${f}`);
      }
      return json(res, 200, list.filter((x) => !/0101_Baseplate|0105_UIGrid|studmap2/.test(x)));
    }
    if (p === '/api/background' && req.method === 'POST') {
      const buf = await readRaw(req);
      const info = imageSize(buf);
      if (!info) return json(res, 400, { error: 'formato no soportado (PNG, JPG o WEBP)' });
      const rel = `assets/backgrounds/${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)}.${info.ext}`;
      fs.mkdirSync(path.join(ROOT, 'assets/backgrounds'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel), buf);
      return json(res, 200, { path: rel });
    }
    if (p === '/api/icons') {
      const studs = (fs.existsSync(path.join(ROOT, 'assets/studs')) ? fs.readdirSync(path.join(ROOT, 'assets/studs')) : []).filter((f) => f.endsWith('.png'))
        .sort((a, b) => (b.includes('Outline') - a.includes('Outline')) || a.localeCompare(b))
        .map((f) => `../assets/studs/${f}`);
      const brand = fs.readdirSync(path.join(ROOT, 'assets/brand')).filter((f) => f.endsWith('.png')).map((f) => `../assets/brand/${f}`);
      return json(res, 200, [...brand, ...studs]);
    }

    // ---- logos (carpetas subidas por el usuario)
    if (p === '/api/logos') {
      if (req.method === 'GET') return json(res, 200, listLogos());
      const folder = cleanName(u.searchParams.get('folder'), 'General');
      const dir = path.join(LOGOS, folder);
      if (req.method === 'POST') {
        const name = cleanName(u.searchParams.get('name'), 'logo');
        const buf = await readRaw(req);
        const isSvg = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(buf.slice(0, 4096).toString('utf8'));
        const info = isSvg ? { ext: 'svg' } : imageSize(buf);
        if (!info) return json(res, 400, { error: 'formato no soportado (PNG, JPG, WEBP o SVG)' });
        fs.mkdirSync(dir, { recursive: true });
        const base = name.replace(IMG_EXT, '');
        let file = `${base}.${info.ext}`;
        for (let i = 2; fs.existsSync(path.join(dir, file)) && !fs.readFileSync(path.join(dir, file)).equals(buf); i++) file = `${base}_${i}.${info.ext}`;
        fs.writeFileSync(path.join(dir, file), buf);
        return json(res, 200, { path: `assets/logos/${folder}/${file}`, folder, w: info.w, h: info.h });
      }
      if (req.method === 'DELETE') {
        if (!fs.existsSync(dir) || path.dirname(dir) !== LOGOS) return json(res, 404, { error: 'no existe' });
        const name = u.searchParams.get('name');
        if (name) fs.rmSync(path.join(dir, path.basename(name)), { force: true });
        else fs.rmSync(dir, { recursive: true, force: true });
        return json(res, 200, { ok: true });
      }
    }

    // ---- ejemplos para la IA
    if (p === '/api/examples') {
      if (req.method === 'GET') {
        const id = u.searchParams.get('id');
        if (id) { const e = readJson(path.join(EXAMPLES, cleanName(id) + '.json')); return e ? json(res, 200, e) : json(res, 404, { error: 'no existe' }); }
        return json(res, 200, listExamples(u.searchParams.get('full') === '1'));
      }
      if (req.method === 'POST') {
        const e = JSON.parse(await readBody(req));
        const prev = e.id ? readJson(path.join(EXAMPLES, cleanName(e.id) + '.json')) : null;
        const out = { ...(prev || {}), ...e };
        out.id = cleanName(out.id) || `ex_${Date.now().toString(36)}`;
        out.name = String(out.name || 'Ejemplo').slice(0, 80);
        out.created = out.created || Date.now();
        out.include = out.include !== false;
        if (!out.rbxui) return json(res, 400, { error: 'falta rbxui' });
        R.validate(out.rbxui);
        fs.mkdirSync(EXAMPLES, { recursive: true });
        fs.writeFileSync(path.join(EXAMPLES, out.id + '.json'), JSON.stringify(out, null, 1));
        broadcast({ type: 'examples' });
        return json(res, 200, { ...out, rbxui: undefined, chars: JSON.stringify(out.rbxui).length });
      }
      if (req.method === 'DELETE') {
        fs.rmSync(path.join(EXAMPLES, cleanName(u.searchParams.get('id')) + '.json'), { force: true });
        broadcast({ type: 'examples' });
        return json(res, 200, { ok: true });
      }
    }
    if (p === '/api/ai-prompt') return json(res, 200, aiPrompt(u.searchParams.get('examples') || 'marked'));

    // ---- render de una escena a PNG
    if (p === '/api/render') {
      const name = safe(u.searchParams.get('name'));
      if (!fs.existsSync(path.join(SCREENS, name + '.scene.json'))) return json(res, 404, { error: 'no existe la escena ' + name });
      const png = await renderScene(name, Math.min(2, +u.searchParams.get('scale') || 1));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(png);
    }

    // ---- eventos en vivo + editor
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'hello', clients: activeClients().length })}\n\n`);
      const cid = String(u.searchParams.get('cid') || crypto.randomUUID());
      sse.set(cid, res);
      req.on('close', () => { if (sse.get(cid) === res) sse.delete(cid); });
      return;
    }
    if (p === '/api/editor/state' && req.method === 'POST') { editorState = { ...JSON.parse(await readBody(req)), at: Date.now() }; return json(res, 200, { ok: true }); }
    if (p === '/api/editor/state') return json(res, 200, { open: sse.size > 0, windows: sse.size, ...(editorState || {}) });
    if (p === '/api/editor/reply' && req.method === 'POST') {
      const r = JSON.parse(await readBody(req)), w = pending.get(r.id);
      if (w) { pending.delete(r.id); clearTimeout(w.t); if (r.error) w.ko(new Error(r.error)); else w.ok(r.result); }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/editor/rpc' && req.method === 'POST') {
      const { method, params } = JSON.parse(await readBody(req));
      try { return json(res, 200, { result: await editorRpc(method, params) }); } catch (e) { return json(res, 409, { error: e.message }); }
    }

    // ---- MCP
    if (p === '/api/mcp/hello' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const old = mcpClients.get(b.sid);
      mcpClients.set(b.sid, { ...(old || { since: Date.now(), calls: 0 }), ...b, seen: Date.now() });
      if (!old) broadcast({ type: 'mcp', event: 'connect', client: b.client });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/mcp/bye' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const c = mcpClients.get(b.sid);
      if (c) { mcpClients.delete(b.sid); broadcast({ type: 'mcp', event: 'disconnect', client: c.client }); }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/mcp/log' && req.method === 'POST') {
      const b = { ...JSON.parse(await readBody(req)), at: Date.now() };
      const c = mcpClients.get(b.sid); if (c) { c.calls++; c.seen = Date.now(); }
      mcpLog.push(b); if (mcpLog.length > 60) mcpLog.shift();
      broadcast({ type: 'mcp', event: 'call', call: b });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/mcp/status') {
      return json(res, 200, { clients: activeClients(), log: mcpLog.slice(-40).reverse(), configured: mcpConfigured(), editors: sse.size,
        mcpPath: MCP_JS, node: process.execPath, port: PORT, targets: MCP_TARGETS });
    }
    if (p === '/api/mcp/connect' && req.method === 'POST') {
      const r = await mcpConnect(u.searchParams.get('target'), u.searchParams.get('off') === '1');
      return json(res, r.ok ? 200 : 500, { ...r, configured: mcpConfigured() });
    }
    if (p === '/api/mcp/test' && req.method === 'POST') return json(res, 200, await mcpSelfTest());

    // ---- Roblox Studio (plugin RbxUI Connect)
    if (p === '/api/studio/poll') {                        // el plugin espera trabajos (long-poll de 20 s)
      const q = Object.fromEntries(u.searchParams);
      if (!q.sid) return json(res, 400, { error: 'falta sid' });
      const old = studios.get(q.sid);
      const st = { ...(old || { since: Date.now() }), sid: q.sid, place: q.place || '', placeId: +q.placeId || 0, user: q.user || '', userId: +q.userId || 0, version: q.version || '', auto: q.auto === '1', seen: Date.now() };
      studios.set(q.sid, st);
      if (!old) logStudio({ event: 'connect', place: st.place, user: st.user });
      const prev = studioWait.get(q.sid);
      if (prev) { clearTimeout(prev.t); json(prev.res, 200, { jobs: [] }); studioWait.delete(q.sid); }
      if (studioJobs.some((j) => j.sid === q.sid && !j.sent)) return sendJobs(res, q.sid);
      const t = setTimeout(() => { if (studioWait.get(q.sid)?.res === res) { studioWait.delete(q.sid); json(res, 200, { jobs: [] }); } }, 20000);
      studioWait.set(q.sid, { res, t });
      req.on('close', () => { const w = studioWait.get(q.sid); if (w && w.res === res) { clearTimeout(w.t); studioWait.delete(q.sid); } });
      return;
    }
    if (p === '/api/studio/bye' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req)), st = studios.get(b.sid);
      if (st) { studios.delete(b.sid); logStudio({ event: 'disconnect', place: st.place }); }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/studio/result' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const j = studioJobs.find((x) => x.seq === b.seq);
      if (j) {
        studioJobs.splice(studioJobs.indexOf(j), 1); clearTimeout(j.t);
        if (b.ok) j.ok(b.data || { message: b.message }); else j.ko(new Error(b.message || 'error en Studio'));
      }
      logStudio({ event: 'done', job: j?.type, ok: !!b.ok, message: String(b.message || '').slice(0, 300) });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/studio/progress' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      if (b.path && b.id) recordAsset(b.path, b.id);          // cada imagen subida se guarda al momento
      broadcast({ type: 'studio', event: 'progress', done: b.done, total: b.total, message: b.message });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/studio/pixels') {
      try { return json(res, 200, await imagePixels(String(u.searchParams.get('path') || ''))); } catch (e) { return json(res, 404, { error: e.message }); }
    }
    if (p === '/api/studio/status') {
      const src = fs.existsSync(PLUGIN_SRC) ? fs.readFileSync(PLUGIN_SRC) : null, dst = fs.existsSync(PLUGIN_DST) ? fs.readFileSync(PLUGIN_DST) : null;
      return json(res, 200, { studios: activeStudios(), log: studioLog.slice(-30).reverse(), busy: studioJobs.map((j) => ({ seq: j.seq, type: j.type, at: j.at })),
        plugin: { installed: !!dst, upToDate: !!(src && dst && src.equals(dst)), path: PLUGIN_DST, version: PLUGIN_VERSION() } });
    }
    if (p === '/api/studio/plugin' && req.method === 'POST') {
      if (u.searchParams.get('off') === '1') { fs.rmSync(PLUGIN_DST, { force: true }); return json(res, 200, { ok: true, path: PLUGIN_DST }); }
      fs.mkdirSync(path.dirname(PLUGIN_DST), { recursive: true });
      fs.copyFileSync(PLUGIN_SRC, PLUGIN_DST);
      return json(res, 200, { ok: true, path: PLUGIN_DST, version: PLUGIN_VERSION() });
    }
    if (p === '/api/studio/missing') return json(res, 200, { missing: missingImages(u.searchParams.get('names')) });
    if (p === '/api/studio/upload' && req.method === 'POST') {
      try { return json(res, 200, await studioUpload(u.searchParams.get('names'))); } catch (e) { return json(res, 409, { error: e.message }); }
    }
    if (p === '/api/studio/install' && req.method === 'POST') {
      try { return json(res, 200, await studioInstall(u.searchParams.get('names'), u.searchParams.get('doc'), u.searchParams.get('upload') !== '0')); }
      catch (e) { return json(res, 409, { error: e.message }); }
    }
    if (p === '/api/studio/guis') {
      try { return json(res, 200, await studioJob('list', {}, { timeout: 15000 })); } catch (e) { return json(res, 409, { error: e.message }); }
    }
    if (p === '/api/studio/pull' && req.method === 'POST') {       // ScreenGui de Studio -> escena nativa del editor
      try {
        const names = String(u.searchParams.get('names') || '').split(',').filter(Boolean);
        const r = await studioJob('export', { names, selection: !names.length }, { timeout: 60000 });
        const doc = R.validate(r.doc).doc;
        const thumbs = await localizeIds(doc);
        const { scenes, warn } = R.docToScenes(doc);
        const out = [];
        for (const sc of scenes) {
          const name = safe(sc.name) || 'Screen'; sc.name = name;
          const f = path.join(SCREENS, name + '.scene.json');
          if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');
          fs.writeFileSync(f, JSON.stringify(sc, null, 1));
          fs.writeFileSync(path.join(SCREENS, name + '.scene.html'), sceneHtml(sc));
          out.push(name);
        }
        addToProject(editorState?.project, out);
        broadcast({ type: 'scenes', names: out, open: true, by: 'Roblox Studio' });
        return json(res, 200, { names: out, warn, thumbs, count: r.count });
      } catch (e) { return json(res, 409, { error: e.message }); }
    }

    // estáticos
    let fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || p.split('/').some((seg) => seg.startsWith('.'))) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
    if (!fs.existsSync(fp)) { if (wantsHtml(req, p)) return errorPage(res, 404, 'Esta página no existe', p); res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    if (res.headersSent) return;
    const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (wantsHtml(req, p)) return errorPage(res, 500, 'Algo ha fallado en el servidor', String(e && e.message || e));
    json(res, 500, { error: String(e && e.stack || e) });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`RbxUI Studio -> http://localhost:${PORT}/studio/` + (lanIps()[0] ? `  ·  móvil (misma Wi-Fi): botón del móvil en el editor` : '')));
