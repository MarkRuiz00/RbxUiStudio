// RbxUI Studio — renderizador compartido (editor + export).
// Escena JSON -> DOM absoluto con las clases del design system (ds/ds.css). El exportador (export.mjs)
// lee los data-rbx que pone este renderizador, así que lo que ves en el editor es lo que llega a Roblox.
//
// Nodo: { id, type:'box'|'group'|'text'|'image'|'html', name, rbx:'image'|'text'|'frame'|null, pad,
//         cls, style, x, y, w, h, rot, text, grad, src, html, hidden, locked, children:[] }
// x/y son relativos a la caja de relleno del padre (dentro del borde), como position:absolute en CSS.
(function () {
  const hasTok = (cls, t) => (' ' + (cls || '') + ' ').includes(' ' + t + ' ');

  // nodo nativo (Instance real de Roblox: rbxClass + props + mods), ver rbxjson.js
  function renderNative(n, map, opts) {
    const R = window.RBXJson;
    if (opts.play && R.prop(n, 'Visible') === false) return null;
    const el = R.nativeEl(n, document, opts);
    let css = el.dataset.cssBox; delete el.dataset.cssBox;
    css += `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;`;
    if (n.rot) css += `transform:rotate(${n.rot}deg);`;
    if (n.hidden) css += 'visibility:hidden;';
    el.style.cssText = css;
    el.setAttribute('data-name', n.name || n.rbxClass);
    if (!opts.export) el.setAttribute('data-nid', n.id);
    map[n.id] = el;
    for (const k of n.children || []) { const ce = renderNode(k, map, opts); if (ce) el.appendChild(ce); }
    return el;
  }

  function renderNode(n, map, opts) {
    if (opts.export && n.hidden) return null;
    if (n.rbxClass) return renderNative(n, map, opts);
    let el;
    if (n.type === 'image') {
      el = document.createElement('img');
      el.setAttribute('src', n.src || '');
      el.draggable = false;
    } else {
      el = document.createElement('div');
    }
    if (n.type === 'text') el.textContent = n.text == null ? '' : n.text;
    if (n.type === 'html') el.innerHTML = n.html || '';
    if (n.cls) el.setAttribute('class', n.cls);

    let css = n.style ? n.style.trim().replace(/;?$/, ';') : '';
    css += `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;`;
    if (n.rot) css += `transform:rotate(${n.rot}deg);`;
    if (n.hidden) css += 'visibility:hidden;';
    el.style.cssText = css;

    if (n.rbx) {
      el.setAttribute('data-rbx', n.rbx);
      el.setAttribute('data-name', n.name || n.rbx);
      if (n.pad != null) el.setAttribute('data-pad', n.pad);
    }
    if (n.type === 'text' && n.grad) {
      const [g1, g2] = n.grad.split(',');
      el.setAttribute('data-grad', n.grad);
      el.setAttribute('data-g', el.textContent);
      el.style.setProperty('--g1', g1);
      el.style.setProperty('--g2', g2 || g1);
    }
    if (!opts.export) el.setAttribute('data-nid', n.id);
    map[n.id] = el;

    // efectos (.fx) de una pieza .pc: dentro de un recorte con su forma (como ds.js)
    const kids = n.children || [];
    const clipFx = hasTok(n.cls, 'pc') && kids.some((k) => hasTok(k.cls, 'fx'));
    let clip = null;
    if (clipFx) {
      clip = document.createElement('div');
      clip.className = 'fxclip';
      el.appendChild(clip);
    }
    for (const k of kids) {
      const ce = renderNode(k, map, opts);
      if (!ce) continue;
      if (clip && hasTok(k.cls, 'fx')) {
        ce.style.left = (k.x - 1) + 'px';   // el recorte está 1px dentro de la caja de relleno
        ce.style.top = (k.y - 1) + 'px';
        clip.appendChild(ce);
      } else {
        el.appendChild(ce);
      }
    }
    return el;
  }

  // fondos del lienzo (referencia para diseñar; no se exportan): [clave, nombre, CSS]
  const BASE = "url('../assets/ui-resources/Backgrounds/0101_Baseplate.png') center/cover";
  const BG_PRESETS = [
    ['baseplate', 'Baseplate', BASE],
    ['sky', 'Cielo', 'linear-gradient(#4f9fe6, #9fd2f7 62%, #d9eefc)'],
    ['grass', 'Pradera', 'linear-gradient(#78c0f3 0, #b9e0fb 54%, #62b24a 54%, #4c9a3a 100%)'],
    ['sunset', 'Atardecer', 'linear-gradient(#2b1e5c, #8a3f8f 45%, #ff8a5c 80%, #ffc57a)'],
    ['night', 'Noche', 'radial-gradient(ellipse at 50% 115%, #34467f, #0b1026 72%)'],
    ['studs', 'Studs', "url('../assets/ui-resources/Backgrounds/studmap2.jpg') center/cover"],
    ['uigrid', 'Rejilla', "url('../assets/ui-resources/Backgrounds/0105_UIGrid.png') center/cover"],
    ['checker', 'Transparente', 'repeating-conic-gradient(#3b3b3b 0 25%, #2c2c2c 0 50%) 0 0/20px 20px'],
    ['#1E1E1E', 'Oscuro', '#1e1e1e'], ['#F5F5F5', 'Claro', '#f5f5f5'], ['#3A6EA5', 'Azul', '#3a6ea5'], ['#000000', 'Negro', '#000000'],
  ];
  function stageBg(bg) {
    if (!bg) return '';
    const p = BG_PRESETS.find((x) => x[0] === bg);
    if (p) return p[2];
    if (/^img:/.test(bg)) return `url('../${bg.slice(4).replace(/^(\.\.\/)+/, '')}') center/cover`;
    return bg;                                  // color o CSS
  }

  function renderScene(scene, stage, opts = {}) {
    stage.innerHTML = '';
    const map = {};
    const bg = scene.design && scene.design.background;
    if (scene.native) {
      stage.classList.add('native');
      stage.style.background = !bg || bg === 'baseplate' ? '' : stageBg(bg);
      stage.style.width = scene.stage.w + 'px'; stage.style.height = scene.stage.h + 'px';
    } else { stage.classList.remove('native'); stage.style.background = bg && bg !== 'baseplate' ? stageBg(bg) : ''; }
    for (const n of scene.nodes || []) {
      const el = renderNode(n, map, opts);
      if (el) stage.appendChild(el);
    }
    if (scene.native) window.RBXJson.fitScaled(stage);
    return map;
  }

  window.RBXRender = { renderScene, renderNode, hasTok, stageBg, BG_PRESETS };
})();
