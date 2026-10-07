/* RbxUI Studio — página de inicio: proyectos (grupos de escenas) en carpetas. API: GET/POST /api/projects (server.mjs). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style') el.style.cssText = v;
      else if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'innerHTML') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };
  const SVGI = window.ICON, R = window.RBXJson;
  const api = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
  const post = (body) => api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
  const MASCOT = { empty: 'brand/mascot_empty.png', search: 'brand/mascot_search.png', error: 'brand/mascot_error.png' };
  const COLORS = ['#7b6bff', '#2fd6ff', '#9cf01e', '#ffc21e', '#ff4fb4', '#ff7a3d', '#c2c8d4'];
  const S = { db: { folders: [], projects: [], loose: [] }, view: 'all', q: '' };
  try { S.view = localStorage.getItem('hm-view') || 'all'; } catch { /* sin almacenamiento */ }

  // ---------------------------------------------------------------- avisos
  function toast(msg, kind = 'ok') {
    const el = h('div', { class: 'st-toast ' + kind }, h('span', { class: 'st-tdot' }), h('span', {}, msg));
    $('#st-toasts').append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, kind === 'err' ? 5000 : 2800);
  }
  const state = (kind, title, text, btns = []) => h('div', { class: 'st-state', style: 'grid-column:1/-1;padding:40px 12px' },
    h('img', { src: MASCOT[kind], alt: '' }), h('b', {}, title), text ? h('p', {}, text) : null, btns.length ? h('div', { class: 'st-row' }, ...btns) : null);
  const ago = (t) => {
    const s = (Date.now() - t) / 1000, rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (s < 60) return 'ahora mismo';
    if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
    return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const folderOf = (id) => S.db.folders.find((f) => f.id === id) || null;
  const openProject = (pr, scene) => { location.href = `index.html?project=${encodeURIComponent(pr.id)}&scene=${encodeURIComponent(scene || pr.scenes[0] || '')}`; };

  // ---------------------------------------------------------------- diálogos y menús
  function closeLayer() { $('#hm-layer').innerHTML = ''; }
  function dialog(title, icon, body, actions) {
    closeLayer();
    const back = h('div', { class: 'hm-back', onmousedown: (e) => { if (e.target === back) closeLayer(); } },
      h('div', { class: 'hm-dlg', role: 'dialog', 'aria-label': title },
        h('header', {}, h('span', { class: 'st-wicon', innerHTML: SVGI(icon, 16) }), title),
        h('div', { class: 'body' }, ...body), h('footer', {}, h('button', { class: 'hm-btn', onclick: closeLayer }, 'Cancelar'), ...actions)));
    $('#hm-layer').append(back);
    const first = back.querySelector('input[type="text"]'); if (first) { first.focus(); first.select(); }
    back.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const ok = back.querySelector('footer .primary, footer .danger'); if (ok) ok.click(); } });
  }
  function menu(anchor, items) {
    closeLayer();
    const r = anchor.getBoundingClientRect();
    const m = h('div', { class: 'hm-menu', role: 'menu' }, ...items.map((it) => it === '-' ? h('hr') : it.label ? h('div', { class: 'lbl' }, it.label)
      : h('button', { class: it.danger ? 'danger' : '', role: 'menuitem', innerHTML: (it.icon ? SVGI(it.icon, 14) : '') + `<span>${it.text}</span>`, onclick: () => { closeLayer(); it.fn(); } })));
    const back = h('div', { style: 'position:fixed;inset:0;z-index:39', onmousedown: closeLayer });
    $('#hm-layer').append(back, m);
    const W = m.offsetWidth, H = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.right - W)) + 'px';
    m.style.top = (r.bottom + H + 8 > innerHeight ? r.top - H - 4 : r.bottom + 4) + 'px';
  }
  const folderSelect = (value) => h('select', { id: 'dlg-folder' }, h('option', { value: '' }, 'Sin carpeta'),
    ...S.db.folders.map((f) => h('option', { value: f.id, selected: f.id === value }, f.name)));

  function newProject() {
    const name = h('input', { type: 'text', id: 'dlg-name', placeholder: 'Mi juego', maxlength: 60 });
    const scene = h('input', { type: 'text', id: 'dlg-scene', placeholder: 'MainScreen (opcional)', maxlength: 60 });
    const fs = folderSelect(S.view.startsWith('f_') ? S.view : '');
    dialog('Nuevo proyecto', 'plus', [h('label', {}, 'Nombre', name), h('label', {}, 'Carpeta', fs),
      h('label', {}, 'Primera pantalla (nombre del ScreenGui)', scene), h('p', {}, 'Se abre en el editor con la pantalla vacía: pega de Figma, dibuja o importa un JSON.')],
    [h('button', { class: 'hm-btn primary', onclick: async () => {
      if (!name.value.trim()) { name.focus(); return; }
      try { const r = await post({ action: 'create', name: name.value, folder: fs.value || null, scene: scene.value.replace(/[^\w-]/g, '') }); openProject(r.project); }
      catch (e) { toast(e.message, 'err'); }
    } }, 'Crear y abrir')]);
  }
  function renameProject(pr) {
    const name = h('input', { type: 'text', id: 'dlg-name', value: pr.name, maxlength: 60 });
    dialog('Renombrar proyecto', 'text', [h('label', {}, 'Nombre', name)],
      [h('button', { class: 'hm-btn primary', onclick: async () => { await post({ action: 'update', id: pr.id, name: name.value }); closeLayer(); load(); } }, 'Guardar')]);
  }
  function deleteProject(pr) {
    const chk = h('input', { type: 'checkbox', id: 'dlg-del' });
    dialog(`Eliminar «${pr.name}»`, 'trash', [h('p', {}, `Sus ${pr.scenes.length} pantallas pasan a «Pantallas sueltas».`),
      h('label', { class: 'check' }, chk, 'Mover también sus pantallas a la papelera (screens/_papelera)')],
    [h('button', { class: 'hm-btn danger', onclick: async () => { await post({ action: 'delete', id: pr.id, deleteScenes: chk.checked }); closeLayer(); toast(`«${pr.name}» eliminado`, 'info'); load(); } }, 'Eliminar')]);
  }
  function folderDialog(f) {
    const name = h('input', { type: 'text', id: 'dlg-name', value: f ? f.name : '', placeholder: 'Juegos, Clientes, Pruebas…', maxlength: 40 });
    let color = f ? f.color : COLORS[S.db.folders.length % COLORS.length];
    const sw = h('div', { class: 'hm-colors' }, ...COLORS.map((c) => h('button', { type: 'button', class: c === color ? 'on' : '', style: `background:${c}`, title: c,
      onclick: (e) => { color = c; [...sw.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } })));
    dialog(f ? 'Editar carpeta' : 'Nueva carpeta', 'folder', [h('label', {}, 'Nombre', name), h('label', {}, 'Color', sw)],
      [h('button', { class: 'hm-btn primary', onclick: async () => {
        if (!name.value.trim()) { name.focus(); return; }
        const r = await post(f ? { action: 'folderUpdate', id: f.id, name: name.value, color } : { action: 'folderCreate', name: name.value, color });
        closeLayer(); if (!f) setView(r.folder.id); load();
      } }, f ? 'Guardar' : 'Crear carpeta')]);
  }
  function deleteFolder(f) {
    dialog(`Eliminar la carpeta «${f.name}»`, 'folder', [h('p', {}, 'Los proyectos no se borran: quedan sin carpeta.')],
      [h('button', { class: 'hm-btn danger', onclick: async () => { await post({ action: 'folderDelete', id: f.id }); closeLayer(); setView('all'); load(); } }, 'Eliminar carpeta')]);
  }
  const moveTo = async (pr, folder) => { await post({ action: 'update', id: pr.id, folder }); toast(folder ? `Movido a «${folderOf(folder).name}»` : 'Movido a «Sin carpeta»'); load(); };

  // ---------------------------------------------------------------- miniatura: la primera pantalla pintada con el renderizador del editor
  const sceneCache = new Map();
  const thumbObs = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { thumbObs.unobserve(en.target); drawThumb(en.target); }
  }, { rootMargin: '200px' });
  async function drawThumb(box) {
    const name = box.dataset.scene;
    if (!name) return;
    try {
      if (!sceneCache.has(name)) sceneCache.set(name, api('/api/scene?name=' + encodeURIComponent(name)));
      const sc = JSON.parse(JSON.stringify(await sceneCache.get(name)));
      if (!sc.native) return;
      const rl = (n) => { if (n.rbxClass) R.relayout(n); (n.children || []).forEach(rl); };
      sc.nodes.forEach(rl);
      const st = h('div', { class: 'stage' });
      box.append(st);
      RBXRender.renderScene(sc, st, { export: true });
      const k = box.clientWidth / sc.stage.w;
      st.style.transform = `scale(${k})`;
    } catch { /* sin miniatura: queda el fondo */ }
  }

  // ---------------------------------------------------------------- pintar
  function setView(v) { S.view = v; try { localStorage.setItem('hm-view', v); } catch { /* */ } render(); }
  function renderSide() {
    const side = $('#hm-side'); side.innerHTML = '';
    const count = (fn) => S.db.projects.filter(fn).length;
    const nav = (id, label, n, extra = {}) => {
      const b = h('button', { class: 'hm-nav' + (S.view === id ? ' on' : ''), onclick: () => setView(id), title: label }, extra.dot ? h('i', { class: 'dot', style: `background:${extra.dot}` }) : null,
        extra.icon ? h('i', { innerHTML: SVGI(extra.icon, 15), style: 'display:grid' }) : null, h('span', {}, label), n != null ? h('small', {}, String(n)) : null);
      if (extra.drop !== undefined) {          // soltar un proyecto aquí = moverlo a esta carpeta
        b.addEventListener('dragover', (e) => { if (S.drag) { e.preventDefault(); b.classList.add('drop'); } });
        b.addEventListener('dragleave', () => b.classList.remove('drop'));
        b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('drop'); if (S.drag) moveTo(S.drag, extra.drop); });
      }
      return b;
    };
    side.append(nav('all', 'Todos los proyectos', S.db.projects.length, { icon: 'layers' }),
      h('div', { class: 'hm-sec' }, 'Carpetas', h('button', { title: 'Nueva carpeta', innerHTML: SVGI('plus', 14), onclick: () => folderDialog(null) })));
    for (const f of S.db.folders) side.append(nav(f.id, f.name, count((p) => p.folder === f.id), { dot: f.color, drop: f.id }));
    side.append(nav('none', 'Sin carpeta', count((p) => !p.folder), { icon: 'folder', drop: null }));
    if (S.db.loose.length) side.append(nav('loose', 'Pantallas sueltas', S.db.loose.length, { icon: 'frame' }));
  }
  function card(pr, i) {
    const f = folderOf(pr.folder);
    const thumb = h('div', { class: 'hm-thumb', 'data-scene': pr.cover || pr.scenes[0] || '' }, h('span', { class: 'hm-count' }, `${pr.scenes.length} pantalla${pr.scenes.length === 1 ? '' : 's'}`));
    const more = h('button', { class: 'hm-more', title: 'Opciones', 'aria-label': 'Opciones de ' + pr.name, innerHTML: SVGI('sliders', 15),
      onclick: (e) => { e.stopPropagation(); menu(more, [
        { text: 'Abrir', icon: 'external', fn: () => openProject(pr) },
        ...pr.scenes.slice(0, 8).map((s) => ({ text: s, icon: 'frame', fn: () => openProject(pr, s) })),
        '-', { text: 'Renombrar', icon: 'text', fn: () => renameProject(pr) },
        { label: 'Mover a' }, { text: 'Sin carpeta', icon: 'folder', fn: () => moveTo(pr, null) },
        ...S.db.folders.filter((x) => x.id !== pr.folder).map((x) => ({ text: x.name, icon: 'folder', fn: () => moveTo(pr, x.id) })),
        '-', { text: 'Eliminar', icon: 'trash', danger: true, fn: () => deleteProject(pr) }]); } });
    const c = h('article', { class: 'hm-card', draggable: 'true', tabindex: 0, style: `animation-delay:${Math.min(i, 12) * 30}ms`, 'aria-label': pr.name,
      onclick: () => openProject(pr), onkeydown: (e) => { if (e.key === 'Enter') openProject(pr); } }, thumb,
      h('div', { class: 'hm-cbody' }, h('div', {}, h('b', {}, pr.name), h('small', {}, f ? h('i', { style: `background:${f.color}` }) : null, (f ? f.name + ' · ' : '') + ago(pr.updated))), more));
    c.addEventListener('dragstart', (e) => { S.drag = pr; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', pr.id); });
    c.addEventListener('dragend', () => { S.drag = null; c.classList.remove('dragging'); });
    thumbObs.observe(thumb);
    return c;
  }
  function render() {
    renderSide();
    const head = $('#hm-head'), grid = $('#hm-grid'); head.innerHTML = ''; grid.innerHTML = '';
    const q = S.q.toLowerCase();
    const f = S.view.startsWith('f_') ? folderOf(S.view) : null;
    if (S.view.startsWith('f_') && !f) S.view = 'all';
    if (S.view === 'loose') {
      head.append(h('h1', {}, 'Pantallas sueltas'), h('span', { class: 'n' }, 'no pertenecen a ningún proyecto'));
      const list = S.db.loose.filter((n) => !q || n.toLowerCase().includes(q));
      const box = h('div', { class: 'hm-list', style: 'grid-column:1/-1' }, ...list.map((n) => h('div', { class: 'hm-row' }, h('span', { innerHTML: SVGI('frame', 15) }), h('b', {}, n),
        S.db.projects.length ? h('select', { class: 'hm-btn', style: 'max-width:180px', onchange: async (e) => { if (!e.target.value) return; await post({ action: 'addScenes', id: e.target.value, names: [n] }); toast(`${n} añadida al proyecto`); load(); } },
          h('option', { value: '' }, 'Añadir a proyecto…'), ...S.db.projects.map((p) => h('option', { value: p.id }, p.name))) : null,
        h('a', { class: 'hm-btn', href: `index.html?scene=${encodeURIComponent(n)}`, style: 'text-decoration:none' }, 'Abrir'))));
      grid.append(list.length ? box : state('search', 'Sin resultados', `Ninguna pantalla se llama «${S.q}».`));
      return;
    }
    const title = S.view === 'none' ? 'Sin carpeta' : f ? f.name : 'Todos los proyectos';
    let list = S.db.projects.filter((p) => (S.view === 'all' ? true : S.view === 'none' ? !p.folder : p.folder === S.view));
    if (q) list = list.filter((p) => (p.name + ' ' + p.scenes.join(' ')).toLowerCase().includes(q));
    head.append(...[f ? h('i', { style: `width:12px;height:12px;border-radius:4px;background:${f.color}` }) : null, h('h1', {}, title),
      h('span', { class: 'n' }, `${list.length} proyecto${list.length === 1 ? '' : 's'}`),
      f ? h('div', { class: 'acts' }, h('button', { class: 'hm-btn', onclick: () => folderDialog(f) }, 'Editar'), h('button', { class: 'hm-btn danger', onclick: () => deleteFolder(f) }, 'Eliminar')) : null].filter(Boolean));
    if (!S.db.projects.length) {
      grid.append(state('empty', 'Aún no hay proyectos', 'Un proyecto agrupa las pantallas (ScreenGuis) de un juego. Crea el primero y empieza a diseñar.',
        [h('button', { class: 'hm-btn primary', innerHTML: SVGI('plus', 14) + 'Nuevo proyecto', onclick: newProject })]));
      return;
    }
    if (!list.length) {
      grid.append(q ? state('search', 'Sin resultados', `Ningún proyecto ni pantalla con «${S.q}».`)
        : state('empty', 'Carpeta vacía', 'Arrastra aquí un proyecto desde «Todos los proyectos» o crea uno nuevo.', [h('button', { class: 'hm-btn primary', innerHTML: SVGI('plus', 14) + 'Nuevo proyecto', onclick: newProject })]));
      return;
    }
    list.forEach((p, i) => grid.append(card(p, i)));
    if (!q) grid.append(h('button', { class: 'hm-card hm-new', onclick: newProject, innerHTML: SVGI('plus', 22) + '<span>Nuevo proyecto</span>' }));
  }
  async function load() {
    try { S.db = await api('/api/projects'); render(); }
    catch (e) { $('#hm-grid').innerHTML = ''; $('#hm-grid').append(state('error', 'No se pudo cargar', 'El servidor del editor no responde: abre «RbxUI Studio.bat». ' + e.message)); }
  }

  // ---------------------------------------------------------------- arranque
  window.paintIcons && window.paintIcons();
  const setTheme = (t) => { document.documentElement.dataset.theme = t; try { localStorage.setItem('st-theme', t); } catch { /* */ } $('#hm-theme').innerHTML = SVGI(t === 'light' ? 'moon' : 'sun', 16); };
  setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  $('#hm-theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  $('#hm-new').onclick = newProject;
  let qt = 0;
  $('#hm-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); render(); }, 120); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLayer(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#hm-q').focus(); } });
  fetch('/assets/rbx_assets.json').then((r) => (r.ok ? r.json() : {})).then((m) => R.setAssets(m)).catch(() => {}).finally(load);
  // en vivo: si el editor o la IA crean escenas o proyectos, la lista se actualiza sola
  try { const es = new EventSource('/api/events?cid=home-' + Math.random().toString(36).slice(2, 8)); es.onmessage = (m) => { const ev = JSON.parse(m.data); if (ev.type === 'projects' || ev.type === 'scenes') load(); }; } catch { /* sin eventos */ }
})();
