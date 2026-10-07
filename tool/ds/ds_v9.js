// RbxUI Design System v9 — constructores. Ver DESIGN_SYSTEM.md.
// Uso en una pantalla (rbxui/screens/x.html):  DS.render(DS.place('center', DS.win({...}, ...)) + ...)
(function () {
  const A = '../assets/';
  const stud = (n) => `${A}studs/${n}.png`;         // nombre de archivo sin .png (p.ej. 'Red_GIft_Outline')
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const attrs = (kind, name, pad) => `data-rbx="${kind}" data-name="${name}"${pad != null ? ` data-pad="${pad}"` : ''}`;

  // ---------- primitivas ----------
  const txt = (text, name, cls = 't-label', grad) =>
    `<div class="txt ${cls}" ${attrs('text', name)}${grad ? ` data-grad="${grad}"` : ''}>${esc(text)}</div>`;
  const baked = (text, cls = 't-label', style = '') => `<span class="txt ${cls}" style="${style}">${esc(text)}</span>`;
  const icon = (file, name = 'Icon', size, cls = 'ic-sh', style = '') =>
    `<img class="ic ${cls}" src="${stud(file)}" ${attrs('image', name)} style="${size ? `width:${size}px;height:${size}px;` : ''}${style}">`;
  const robux = (name = 'Robux', size) =>
    `<img class="ic rbx" src="${A}brand/robux_ol.png" ${attrs('image', name)}${size ? ` style="width:${size}px;height:${size}px"` : ''}>`;
  const pc = (cls, name, inner = '', style = '', pad = 4) =>
    `<div class="pc ${cls}" ${attrs('image', name, pad)} style="${style}">${inner}</div>`;
  const frame = (name, inner, cls = '', style = '') => `<div class="${cls}" ${attrs('frame', name)} style="${style}">${inner}</div>`;
  const row = (inner, style = '') => `<div style="display:flex;align-items:center;${style}">${inner}</div>`;
  const col = (inner, style = '') => `<div style="display:flex;flex-direction:column;align-items:center;${style}">${inner}</div>`;
  const grow = () => `<div class="grow" style="flex:1"></div>`;
  const fx = (cls, l, t, w, h, extra = '') => `<div class="fx ${cls}" style="left:${l}px;top:${t}px;width:${w}px;height:${h}px;${extra}"></div>`;

  // ---------- botones ----------
  // variant: cta (verde, comprar) · gem (magenta) · gold · danger · dark
  const btn = ({ name, label, variant = 'cta', size = 'm', style = '' }) =>
    pc(`btn ${size} v-${variant}`, name, txt(label, 'Label', size === 's' ? 't-small' : 't-label'), style);
  const buy = ({ name = 'BuyButton', price, size = 'm', style = '', variant = 'cta' }) =>
    pc(`btn ${size} v-${variant}`, name, robux() + txt(price, 'Price', size === 's' ? 't-small' : 't-label'), style);
  const closeBtn = () => pc('btn xbtn v-danger', 'CloseButton', baked('X', 't-label', 'font-size:17px'), '', 4);

  // ---------- ventana ----------
  // cuerpo: gris oscuro a cuadros (igual en todas) · cabecera: color del tema · ribbon: cinta de acento tras la X
  const win = ({ name, title, icon: ic, theme = 'orange', ribbon, w = 520, h }, body) =>
    `<div class="pc win th-${theme}" ${attrs('image', name, 12)} style="width:${w}px;${h ? `height:${h}px` : ''}">` +
      `<div class="win-head" ${attrs('image', 'Header')}>` +
        (ribbon ? `<div class="ribbon-wrap"><div class="ribbon" style="--r1:${ribbon[0]};--r2:${ribbon[1]}"></div></div>` : '') +
        (ic ? icon(ic, 'TitleIcon', 36) : '') + txt(title, 'Title', 't-title') + grow() + closeBtn() +
      `</div><div class="win-body" ${attrs('frame', 'Body')}>${body}</div></div>`;

  // ---------- tarjetas y slots ----------
  // card: fondo radial saturado del tema (ref 1). fxs: efectos horneados (string de DS.fx)
  const card = ({ name, theme = 'red', style = '', fxs = '', variant = 'radial', tex = '' }, inner) =>
    pc(`card th-${theme} v-${variant} ${tex}`, name, fxs + inner, style, 4);

  // slot cuadrado con icono (ref 2): top/bottom = textos pequeños; state: 'claimed'
  const slot = ({ name, theme = 'blue', file, top, bottom, w = 60, h = 60, iconSize, state, variant = 'slot', bottomCls = 't-small' }) => {
    const claimed = state === 'claimed';
    const is = iconSize || Math.round(Math.min(w, h) * 0.72);
    return pc(`slot studs th-${theme} ${claimed ? 'v-dim' : `v-${variant}`}`, name,
      (top ? txt(top, 'Top', 't-small') : '<span></span>') +
      `<div style="position:relative;width:${is}px;height:${is}px">` + icon(file, 'Icon', is, claimed ? 'ic-sh claimed' : 'ic-sh') +
        (claimed ? icon('Checkmark_Outline', 'Claimed', Math.round(is * 0.8), 'ic-sh', `position:absolute;left:${is * 0.1}px;top:${is * 0.1}px`) : '') +
      `</div>` +
      (bottom ? txt(bottom, 'Bottom', bottomCls) : '<span></span>'),
      `width:${w}px;height:${h}px`, 4);
  };

  // icono grande con sunburst/brillo detrás (horneado en el PNG del padre)
  const hero = (file, name = 'Hero', size = 100, { burst = true, glow = true, sparks = true } = {}) => {
    const b = size * 1.5, g = size * 0.95;
    return `<div class="hero" style="width:${size}px;height:${size}px">` +
      (burst ? fx('fx-burst', (size - b) / 2, (size - b) / 2, b, b) : '') +
      (glow ? `<div class="fx fx-glow" style="left:${(size - g) / 2}px;top:${(size - g) / 2}px;width:${g}px;height:${g}px"></div>` : '') +
      (sparks ? fx('fx-spark', size * .8, 0, size * .2, size * .2) + fx('fx-spark', 0, size * .72, size * .14, size * .14) : '') +
      `<img class="ic ic-sh" src="${stud(file)}" ${attrs('image', name)} style="position:absolute;inset:0;width:100%;height:100%">` +
      `</div>`;
  };

  // ---------- HUD ----------
  const hudSquare = (name, file, label, theme) => pc(`hud-sq stripes v-radial th-${theme}`, name, icon(file, 'Icon') + txt(label, 'Label', 't-label'), '', 4);
  const hudWide = (name, label, theme) => pc(`hud-wide stripes v-radial th-${theme}`, name, txt(label, 'Label', 't-label', null), '', 4);
  const currency = (name, file, value, color = 't-lime') =>
    pc('cur v-dark', name, icon(file, 'Icon') + txt(value, 'Value', `t-label t-left val ${color}`) +
      pc('btn add v-cta', 'AddButton', baked('+', 't-label', 'font-size:18px'), '', 3), '', 10);

  // ---------- colocación en el stage ----------
  const ANCH = {
    'center':       (x, y) => `left:calc(50% + ${x}px);top:calc(50% + ${y}px);transform:translate(-50%,-50%)`,
    'left':         (x, y) => `left:${x}px;top:calc(50% + ${y}px);transform:translateY(-50%)`,
    'right':        (x, y) => `right:${x}px;top:calc(50% + ${y}px);transform:translateY(-50%)`,
    'top':          (x, y) => `left:calc(50% + ${x}px);top:${y}px;transform:translateX(-50%)`,
    'bottom':       (x, y) => `left:calc(50% + ${x}px);bottom:${y}px;transform:translateX(-50%)`,
    'top-left':     (x, y) => `left:${x}px;top:${y}px`,
    'top-right':    (x, y) => `right:${x}px;top:${y}px`,
    'bottom-left':  (x, y) => `left:${x}px;bottom:${y}px`,
    'bottom-right': (x, y) => `right:${x}px;bottom:${y}px`,
  };
  const place = (anchor, html, { x = 16, y = 0, name, cls = '' } = {}) =>
    `<div class="place ${cls}" ${name ? attrs('frame', name) : ''} style="${ANCH[anchor](x, y)}">${html}</div>`;

  // ---------- render + post-proceso ----------
  function render(html) {
    const stage = document.querySelector('.stage');
    stage.innerHTML = html;
    stage.querySelectorAll('.txt[data-grad]').forEach((el) => {
      const [g1, g2] = el.dataset.grad.split(',');
      el.style.setProperty('--g1', g1); el.style.setProperty('--g2', g2 || g1);
      el.dataset.g = el.textContent.trim();
    });
    // efectos recortados a la forma de su pieza
    stage.querySelectorAll('.pc').forEach((el) => {
      const f = [...el.children].filter((c) => c.classList.contains('fx'));
      if (!f.length) return;
      const clip = document.createElement('div');
      clip.className = 'fxclip';
      el.insertBefore(clip, el.firstChild);
      f.forEach((x) => clip.appendChild(x));
    });
    // efectos de un héroe dentro de una pieza: se pasan al recorte de esa pieza (no se salen de la tarjeta)
    document.fonts.ready.then(() => {
      stage.querySelectorAll('.hero').forEach((h) => {
        const host = h.parentElement && h.parentElement.closest('.pc');
        if (!host) return;
        let clip = [...host.children].find((c) => c.classList.contains('fxclip'));
        if (!clip) { clip = document.createElement('div'); clip.className = 'fxclip'; host.insertBefore(clip, host.firstChild); }
        const cr = clip.getBoundingClientRect();
        [...h.children].filter((c) => c.classList.contains('fx')).forEach((x) => {
          const r = x.getBoundingClientRect();
          x.style.left = `${r.left - cr.left}px`; x.style.top = `${r.top - cr.top}px`;
          clip.appendChild(x);
        });
      });
    });
  }

  window.DS = { txt, baked, icon, robux, pc, frame, row, col, grow, fx, btn, buy, closeBtn, win, card, slot, hero,
    hudSquare, hudWide, currency, place, render };
})();
