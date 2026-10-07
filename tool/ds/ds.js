// RbxUI Design System v10 "Stud Style" — constructores. Ver DESIGN_SYSTEM.md y assets/ref_wangui/.
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
  const robux = (name = 'Robux', size, style = '') =>
    `<img class="ic rbx" src="${A}brand/robux_ol.png" ${attrs('image', name)} style="${size ? `width:${size}px;height:${size}px;` : ''}${style}">`;
  const pc = (cls, name, inner = '', style = '', pad = 4) =>
    `<div class="pc ${cls}" ${attrs('image', name, pad)} style="${style}">${inner}</div>`;
  const frame = (name, inner, cls = '', style = '') => `<div class="${cls}" ${attrs('frame', name)} style="${style}">${inner}</div>`;
  const row = (inner, style = '') => `<div style="display:flex;align-items:center;${style}">${inner}</div>`;
  const col = (inner, style = '') => `<div style="display:flex;flex-direction:column;align-items:center;${style}">${inner}</div>`;
  const grow = () => `<div style="flex:1"></div>`;
  const fx = (cls, l, t, w, h, extra = '') => `<div class="fx ${cls}" style="left:${l}px;top:${t}px;width:${w}px;height:${h}px;${extra}"></div>`;

  // ---------- botones ----------
  // variant: cta (lima: acción/comprar) · pink (pagar con Robux) · grey · std (+theme) · danger
  // badge: precio en Robux pegado a la esquina (como "Rebirth Now  99")
  const btn = ({ name, label, variant = 'cta', theme, size = 'm', style = '', badge }) =>
    pc(`btn ${size} v-${variant}${theme ? ` th-${theme}` : ''}`, name,
      txt(label, 'Label', size === 's' ? 't-small' : 't-label') +
      (badge ? `<div class="badge">` + robux('BadgeRobux', 20) + txt(badge, 'BadgePrice', 't-small t-lime') + `</div>` : ''), style);
  const buy = ({ name = 'BuyButton', price, size = 'm', style = '', variant = 'cta' }) =>
    pc(`btn ${size} v-${variant}`, name, robux() + txt(price, 'Price', size === 's' ? 't-small' : 't-label'), style);
  const closeBtn = () => pc('xbtn v-danger', 'CloseButton', baked('X', 't-label', 'font-size:22px'), '', 4);

  // ---------- ventana ----------
  const win = ({ name, title, icon: ic, theme = 'orange', w = 520, h }, body) =>
    `<div class="pc win th-${theme}" ${attrs('image', name, 12)} style="width:${w}px;${h ? `height:${h}px` : ''}">` +
      `<div class="win-head" ${attrs('image', 'Header')}>` +
        (ic ? icon(ic, 'TitleIcon', 40) : '') + txt(title, 'Title', 't-title') + grow() + closeBtn() +
      `</div><div class="win-body" ${attrs('frame', 'Body')}>${body}</div></div>`;

  // etiqueta de sección dorada ("Gamepasses!")
  const sect = (name, text) => `<div class="sect" ${attrs('image', name)}>` + txt(text, 'Text', 't-small t-gold') + `</div>`;

  // ---------- contenido ----------
  const card = ({ name, theme = 'green', style = '', fxs = '', variant = 'card' }, inner) =>
    pc(`card th-${theme} v-${variant}`, name, fxs + inner, style, 4);

  // slot tipo Index/Inventory: relleno oscuro del color + borde interior brillante; tl = texto arriba-izq, bl = abajo-izq
  const tile = ({ name, theme = 'blue', file, tl, bl, w = 96, h = 96, iconSize, state, blCls = 't-label' }) => {
    const claimed = state === 'claimed';
    const is = iconSize || Math.round(Math.min(w, h) * 0.74);
    return pc(`tile v-tile th-${claimed ? 'grey' : theme}`, name,
      `<div class="fx fx-glow" style="left:${(w - is) / 2}px;top:${(h - is) / 2 - 4}px;width:${is}px;height:${is}px;opacity:.35"></div>` +
      `<div style="position:relative;width:${is}px;height:${is}px;margin-top:-4px">` + icon(file, 'Icon', is, claimed ? 'ic-sh claimed' : 'ic-sh') +
        (claimed ? icon('Checkmark_Outline', 'Claimed', Math.round(is * 0.8), 'ic-sh', `position:absolute;left:${is * 0.1}px;top:${is * 0.1}px`) : '') +
      `</div>` +
      (tl ? `<div class="tl">${txt(tl, 'Top', 't-small')}</div>` : '') +
      (bl ? `<div class="bl">${txt(bl, 'Bottom', blCls)}</div>` : ''),
      `width:${w}px;height:${h}px`, 4);
  };

  // moneda dorada con icono (Premium Shop)
  const coin = (file, size = 80, name = 'Icon') =>
    `<div class="coin" style="width:${size}px;height:${size}px">` + icon(file, name, Math.round(size * 0.66)) + `</div>`;

  // caja oscura (filas de Rebirth, etc.)
  const box = (name, inner, style = '') => pc('box v-box', name, inner, style, 3);

  // flecha roja con contorno (SVG)
  const arrow = (name = 'Arrow', w = 40, h = 34) =>
    `<svg ${attrs('image', name, 3)} width="${w}" height="${h}" viewBox="0 0 40 34" style="flex:none">` +
      `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a8a"/><stop offset="1" stop-color="#e0184a"/></linearGradient></defs>` +
      `<path d="M3 10 H20 V3 L37 17 L20 31 V24 H3 Z" fill="url(#ag)" stroke="#121318" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M6 12.5 H22 V8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`;

  // barra de progreso: pista oscura + relleno lima (pieza aparte "Fill" para poder escalarla en juego)
  const progress = ({ name = 'Progress', value = 0.5, text = '', style = '' }) =>
    pc('bar-track v-box', name,
      pc('bar-fill v-cta', 'Fill', '', `width:calc(${value * 100}% - 4px)`, 2) + txt(text, 'Text', 't-small'), style, 3);

  // icono grande con sunburst/brillo detrás
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
  const hudWide = (name, file, label, theme) => pc(`hud-wide v-std th-${theme}`, name, icon(file, 'Icon') + txt(label, 'Label', 't-big'), '', 6);
  const hudSquare = (name, file, label, theme) => pc(`hud-sq v-std th-${theme}`, name, icon(file, 'Icon') + txt(label, 'Label', 't-small'), '', 4);
  const currency = (name, file, value, cls = 't-lime') =>
    frame(name, icon(file, 'Icon', 46) + txt(value, 'Value', `t-cur ${cls}`) +
      pc('btn add v-cta', 'AddButton', baked('+', 't-label', 'font-size:20px'), '', 3), 'cur');

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
    // efectos de un héroe dentro de una pieza: al recorte de esa pieza (no se salen de la tarjeta)
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

  window.DS = { txt, baked, icon, robux, pc, frame, row, col, grow, fx, btn, buy, closeBtn, win, sect, card, tile, coin, box,
    arrow, progress, hero, hudWide, hudSquare, currency, place, render };
})();
