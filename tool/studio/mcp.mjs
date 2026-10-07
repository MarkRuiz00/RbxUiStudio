#!/usr/bin/env node
// RbxUI Studio — servidor MCP (stdio, JSON-RPC 2.0 por líneas, sin dependencias).
// Deja que Claude (Code / Desktop), Cursor o cualquier cliente MCP diseñe UIs de Roblox en RbxUI Studio:
// leer y escribir escenas en formato rbxui, ver una captura, usar los ejemplos de Figma del usuario como referencia,
// listar sus logos, construir el Luau e insertar capas en el editor abierto (en vivo).
//
//   claude mcp add -s user rbxui -- node "<ruta>/rbxui/studio/mcp.mjs"
//
// Habla con el servidor del editor (http://127.0.0.1:5170); si no está arrancado, lo arranca.
import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.RBXUI_PORT || 5170);
const BASE = `http://127.0.0.1:${PORT}`;
const SID = crypto.randomUUID();
const SELFTEST = process.env.RBXUI_SELFTEST === '1';
let client = { name: 'cliente MCP', version: '' };

const log = (...a) => process.stderr.write('[rbxui-mcp] ' + a.join(' ') + '\n');
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');

// ---------------------------------------------------------------- servidor del editor
let starting = null;
async function ensureServer() {
  const up = () => fetch(BASE + '/api/scenes', { signal: AbortSignal.timeout(1500) }).then((r) => r.ok, () => false);
  if (await up()) return;
  if (!starting) {
    starting = (async () => {
      log('arrancando el servidor de RbxUI Studio…');
      spawn(process.execPath, [path.join(HERE, 'server.mjs')], { cwd: path.join(HERE, '..'), detached: true, stdio: 'ignore', windowsHide: true }).unref();
      for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (await up()) return; }
      throw new Error(`no se pudo arrancar el servidor en ${BASE}`);
    })().finally(() => { starting = null; });
  }
  return starting;
}
async function api(url, opts = {}) {
  await ensureServer();
  const r = await fetch(BASE + url, opts);
  const type = r.headers.get('content-type') || '';
  if (type.startsWith('image/')) { if (!r.ok) throw new Error(r.statusText); return Buffer.from(await r.arrayBuffer()); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || j.out || r.statusText);
  return j;
}
const post = (url, body) => api(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const beat = () => !SELFTEST && fetch(BASE + '/api/mcp/hello', { method: 'POST', body: JSON.stringify({ sid: SID, client: client.name, version: client.version, pid: process.pid }) }).catch(() => {});

// ---------------------------------------------------------------- herramientas
const asDoc = (x) => (typeof x === 'string' ? JSON.parse(x.replace(/^[\s\S]*?```(?:json)?\s*([\s\S]*?)```[\s\S]*$/, '$1')) : x);
const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }] });
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });

const TOOLS = [
  { name: 'rbxui_status', description: 'Estado de RbxUI Studio: si el editor está abierto, escena abierta y selección, escenas, ejemplos y carpetas de logos.',
    inputSchema: S({}),
    run: async () => {
      const [ed, scenes, ex, logos] = await Promise.all([api('/api/editor/state'), api('/api/scenes-meta'), api('/api/examples'), api('/api/logos')]);
      return text({ editor: ed, editorUrl: `${BASE.replace('127.0.0.1', 'localhost')}/studio/`, scenes, examples: ex.map((e) => ({ id: e.id, name: e.name, include: e.include, chars: e.chars })),
        logoFolders: logos.map((l) => ({ folder: l.folder, count: l.files.length })) });
    } },
  { name: 'rbxui_design_guide', description: 'LEER ANTES DE DISEÑAR. Especificación del formato JSON rbxui (Instances reales de Roblox) y el estilo de la casa, más los APUNTES del usuario: UIs suyas de Figma que te da como un profesor da apuntes, cada una con un resumen de su técnica (estructura, paleta, fuentes, bordes, radios) y su JSON; estúdialos y diseña con esas técnicas. examples: "marked" (los marcados, por defecto), "all", "none" o ids separados por comas.',
    inputSchema: S({ examples: { type: 'string', description: 'marked | all | none | id,id' } }),
    run: async ({ examples = 'marked' }) => text((await api('/api/ai-prompt?examples=' + encodeURIComponent(examples))).text) },
  { name: 'rbxui_list_scenes', description: 'Lista las escenas (una por ScreenGui). native=true son Instances reales editables como rbxui.',
    inputSchema: S({}), run: async () => text(await api('/api/scenes-meta')) },
  { name: 'rbxui_get_scene', description: 'Devuelve una o varias escenas nativas como documento rbxui {format,version,name,screens:[ScreenGui]}.',
    inputSchema: S({ names: { type: 'string', description: 'Nombres separados por comas' } }, ['names']),
    run: async ({ names }) => text(await api('/api/rbxui?names=' + encodeURIComponent(names))) },
  { name: 'rbxui_put_scene', description: 'Crea o reemplaza escenas a partir de un documento rbxui (cada ScreenGui = una escena). El editor abierto se actualiza en vivo. Tras escribir, usa rbxui_render para ver el resultado.',
    inputSchema: S({ rbxui: { description: 'Documento rbxui (objeto o texto JSON)' }, open: { type: 'boolean', description: 'Abrirla en el editor (por defecto true)' } }, ['rbxui']),
    run: async ({ rbxui, open = true }) => {
      const r = await post(`/api/rbxui/import?origin=mcp&open=${open ? 1 : 0}&client=${encodeURIComponent(client.name)}`, asDoc(rbxui));
      return text({ scenes: r.names, warnings: r.warn });
    } },
  { name: 'rbxui_render', description: 'Captura PNG de una escena guardada tal como la pinta el editor (lo que verá Roblox). Úsala para revisar tu diseño.',
    inputSchema: S({ name: { type: 'string' }, scale: { type: 'number', description: '1 (defecto) o 2' } }, ['name']),
    run: async ({ name, scale = 1 }) => {
      const png = await api(`/api/render?name=${encodeURIComponent(name)}&scale=${scale}`);
      return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }, { type: 'text', text: `${name} (${png.length >> 10} KB)` }] };
    } },
  { name: 'rbxui_open_scene', description: 'Abre una escena en el editor (necesita el editor abierto). Si hay cambios sin guardar falla, salvo save=true (los guarda antes).',
    inputSchema: S({ name: { type: 'string' }, save: { type: 'boolean' } }, ['name']),
    run: async (a) => text((await post('/api/editor/rpc', { method: 'open', params: a })).result) },
  { name: 'rbxui_editor_selection', description: 'Lo seleccionado ahora mismo en el editor, como documento rbxui (para leer o modificar lo que el usuario señala).',
    inputSchema: S({}), run: async () => text((await post('/api/editor/rpc', { method: 'selection' })).result) },
  { name: 'rbxui_editor_insert', description: 'Inserta Instances rbxui (lista de nodos {ClassName,Name,props,children}) en la escena abierta del editor, dentro de la capa seleccionada si es contenedor. Queda sin guardar para que el usuario la revise.',
    inputSchema: S({ nodes: { type: 'array', items: { type: 'object' } }, stage: { type: 'boolean', description: 'true = usar Position tal cual en el escenario; false = centrar' } }, ['nodes']),
    run: async (a) => text((await post('/api/editor/rpc', { method: 'insert', params: a })).result) },
  { name: 'rbxui_list_examples', description: 'Apuntes del usuario (UIs suyas pegadas desde Figma) con el resumen de técnica de cada uno. include = entra en rbxui_design_guide por defecto.',
    inputSchema: S({}), run: async () => text(await api('/api/examples')) },
  { name: 'rbxui_get_example', description: 'Un ejemplo completo con su documento rbxui.',
    inputSchema: S({ id: { type: 'string' } }, ['id']), run: async ({ id }) => text(await api('/api/examples?id=' + encodeURIComponent(id))) },
  { name: 'rbxui_add_example', description: 'Guarda un documento rbxui como ejemplo de referencia (aparece en la ventana Ejemplos IA del editor).',
    inputSchema: S({ name: { type: 'string' }, desc: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, rbxui: { description: 'Documento rbxui' } }, ['name', 'rbxui']),
    run: async (a) => text(await post('/api/examples', { ...a, rbxui: asDoc(a.rbxui), source: 'mcp' })) },
  { name: 'rbxui_list_logos', description: 'Logos subidos por el usuario (carpetas). Las rutas "assets/logos/…" valen como Image de un ImageLabel.',
    inputSchema: S({ folder: { type: 'string' } }),
    run: async ({ folder }) => text((await api('/api/logos')).filter((l) => !folder || l.folder === folder)) },
  { name: 'rbxui_studio_status', description: 'Roblox Studio conectado por el plugin RbxUI Connect (place, usuario, versión), estado del plugin y actividad reciente.',
    inputSchema: S({}), run: async () => text(await api('/api/studio/status')) },
  { name: 'rbxui_studio_install', description: 'Instala escenas nativas directamente en el Roblox Studio abierto (plugin RbxUI Connect): sube antes las imágenes que falten y crea las Instances en StarterGui + el LocalScript RbxUINative. Se puede deshacer en Studio.',
    inputSchema: S({ names: { type: 'string', description: 'Escenas separadas por comas' }, doc: { type: 'string' }, upload: { type: 'boolean', description: 'Subir imágenes que falten (por defecto true)' } }, ['names']),
    run: async ({ names, doc, upload = true }) => text(await post(`/api/studio/install?names=${encodeURIComponent(names)}${doc ? '&doc=' + encodeURIComponent(doc) : ''}&upload=${upload ? 1 : 0}`, '')) },
  { name: 'rbxui_studio_upload_images', description: 'Sube a Roblox (desde Studio, sin API key) las imágenes locales de unas escenas que aún no tienen rbxassetid.',
    inputSchema: S({ names: { type: 'string' } }, ['names']), run: async ({ names }) => text(await post('/api/studio/upload?names=' + encodeURIComponent(names), '')) },
  { name: 'rbxui_studio_list_guis', description: 'ScreenGuis que hay en StarterGui del Studio conectado.',
    inputSchema: S({}), run: async () => text(await api('/api/studio/guis')) },
  { name: 'rbxui_studio_pull', description: 'Trae un ScreenGui de Roblox Studio al editor como escena nativa (JSON rbxui) para leerlo o rediseñarlo. Sin names = lo seleccionado en Studio.',
    inputSchema: S({ names: { type: 'string', description: 'ScreenGuis de StarterGui separados por comas' } }),
    run: async ({ names }) => text(await post('/api/studio/pull' + (names ? '?names=' + encodeURIComponent(names) : ''), '')) },
  { name: 'rbxui_build', description: 'Construye el Luau que crea las Instances en Roblox Studio (out/native/<doc>.build.luau) e indica las imágenes locales que aún hay que subir.',
    inputSchema: S({ names: { type: 'string', description: 'Escenas separadas por comas' }, doc: { type: 'string' } }, ['names']),
    run: async ({ names, doc }) => text(await post(`/api/native/build?names=${encodeURIComponent(names)}${doc ? '&doc=' + encodeURIComponent(doc) : ''}`, '')) },
];

// ---------------------------------------------------------------- JSON-RPC
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
async function handle(m) {
  const { id, method, params = {} } = m;
  if (method === 'initialize') {
    client = { name: params.clientInfo?.name || 'cliente MCP', version: params.clientInfo?.version || '' };
    beat();
    return send({ id, result: {
      protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'rbxui-studio', version: '1.0.0' },
      instructions: 'RbxUI Studio: diseña UIs de Roblox como JSON rbxui (Instances reales). Flujo: rbxui_design_guide → rbxui_put_scene → rbxui_render para revisar → iterar. ' +
        'Usa los ejemplos del usuario como referencia de estilo y sus logos (rbxui_list_logos). Para meterlo en Roblox: rbxui_studio_install (Studio abierto con el plugin RbxUI Connect) o rbxui_build.',
    } });
  }
  if (method === 'ping') return send({ id, result: {} });
  if (method === 'tools/list') return send({ id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
  if (method === 'tools/call') {
    const t = TOOLS.find((x) => x.name === params.name);
    if (!t) return send({ id, error: { code: -32602, message: 'herramienta desconocida: ' + params.name } });
    const t0 = Date.now();
    let ok = true, result;
    try { result = await t.run(params.arguments || {}); }
    catch (e) { ok = false; result = { content: [{ type: 'text', text: 'Error: ' + (e.message || e) }], isError: true }; }
    if (!SELFTEST) fetch(BASE + '/api/mcp/log', { method: 'POST', body: JSON.stringify({ sid: SID, client: client.name, tool: t.name, ok, ms: Date.now() - t0,
      args: JSON.stringify(params.arguments || {}).slice(0, 140) }) }).catch(() => {});
    return send({ id, result });
  }
  if (id !== undefined && !method.startsWith('notifications/')) send({ id, error: { code: -32601, message: 'método no soportado: ' + method } });
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m;
    try { m = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: 'JSON no válido' } }); continue; }
    for (const x of Array.isArray(m) ? m : [m]) handle(x).catch((e) => x.id !== undefined && send({ id: x.id, error: { code: -32603, message: String(e.message || e) } }));
  }
});
const hb = setInterval(beat, 15000); hb.unref();
const bye = () => { if (!SELFTEST) fetch(BASE + '/api/mcp/bye', { method: 'POST', body: JSON.stringify({ sid: SID }) }).catch(() => {}).finally(() => process.exit(0)); else process.exit(0); };
process.stdin.on('end', bye);
process.on('SIGINT', bye); process.on('SIGTERM', bye);
