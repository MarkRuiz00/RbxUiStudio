// RbxUI Design System v4 — constructores. Ver DESIGN_SYSTEM.md.
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
  const icon = (file, name = 'Icon', size, cls = 'ic-sh') =>
    `<img class="ic ${cls}" src="${stud(file)}" ${attrs('image', name)} style="${size ? `width:${size}px;height:${size}px` : ''}">`;
  const robux = (name = 'Robux') => `<img class="ic rbx" src="${A}brand/robux_ol.png" ${attrs('image', name)}>`;
  const pc = (cls, name, inner = '', style = '', pad = 5) =>
    `<div class="pc ${cls}" ${attrs('image', name, pad)} style="${style}">${inner}</div>`;
  const frame = (name, inner, cls = '', style = '') => `<div class="${cls}" ${attrs('frame', name)} style="${style}">${inner}</div>`;
  const row = (inner, style = '') => `<div style="display:flex;align-items:center;${style}">${inner}</div>`;
  const col = (inner, style = '') => `<div style="display:flex;flex-direction:column;align-items:center;${style}">${inner}</div>`;
  const grow = () => `<div style="flex:1"></div>`;

  // ---------- botones ----------
  const btn = ({ name, label, variant = 'theme', size = 'm', icon: ic, style = '' }) =>
    pc(`btn ${size} v-${variant}`, name, (ic ? icon(ic, 'Icon', size === 'l' ? 30 : 22, '') : '') +
      (label ? txt(label, 'Label', size === 's' ? 't-small' : 't-label') : ''), style);
  // variant: 'cta' (verde) por defecto; en ventanas de tema verde usar 'gold'
  const buy = ({ name = 'BuyButton', price, size = 'm', style = '', variant = 'cta' }) =>
    pc(`btn ${size} v-${variant}`, name, robux() + txt(price, 'Price', 't-label'), style);
  const closeBtn = () => pc('btn xbtn v-danger', 'CloseButton', baked('X', 't-label', 'font-size:19px'), '', 5);

  // ---------- ventana / tabs / tarjetas ----------
  // cuerpo gris neutro (igual en todas las ventanas); el color del tema va en la cabecera
  const win = ({ name, title, icon: ic, theme = 'orange', head, w = 700, h }, body) =>
    `<div class="pc win studs th-${theme}" ${attrs('image', name, 8)} style="width:${w}px;${h ? `height:${h}px` : ''}">` +
      `<div class="win-head th-${head || theme}" ${attrs('image', 'Header')}>` +
        (ic ? icon(ic, 'TitleIcon', 50) : '') + txt(title, 'Title', 't-title') + grow() + closeBtn() +
      `</div><div class="win-body" ${attrs('frame', 'Body')}>${body}</div></div>`;

  // pestañas: todas son botones con etiqueta; el resaltado es una pieza aparte (TabHighlight) que el runtime desliza
  const tabs = (name, labels, active = 0) =>
    `<div class="tabs" ${attrs('image', name, 2)} style="--n:${labels.length}">` +
      pc('tab-hi v-t1', 'TabHighlight', '', `--i:${active}`, 4) +
      labels.map((l) => {
        const [label, ic] = l.split(':');
        return frame(label.replace(/\W/g, '') + 'TabButton', (ic ? icon(ic, 'Icon', 28, '') : '') + txt(label, 'Label', 't-label'), 'tab');
      }).join('') + `</div>`;

  // shade: 0 brillante (productos) · 1 medio · 2 héroe dorado · 3 fuerte · 'n' apagado (reclamado/bloqueado)
  const CARD = { 0: 'v-t1', 1: 'v-t2', 2: 'v-gold', 3: 'v-t3', n: 'v-dim' };
  // theme: color propio de la tarjeta (variedad con paleta controlada); por defecto hereda el de la ventana
  const card = ({ name, shade = 0, half = true, style = '', theme }, inner) =>
    pc(`card studs ${theme ? `th-${theme} ` : ''}${CARD[shade]}`, name,
      (half ? `<div class="fx fx-half" style="right:0;top:0;width:65%;height:100%"></div>` : '') + inner, style, 5);

  // icono grande con sunburst/brillo detrás (efectos horneados en el PNG del padre)
  const hero = (file, name = 'Hero', size = 100, { burst = true, glow = true, sparks = true } = {}) => {
    const b = size * 1.55, g = size * 0.95;
    return `<div class="hero" style="width:${size}px;height:${size}px">` +
      (burst ? `<div class="fx fx-burst" style="left:${(size - b) / 2}px;top:${(size - b) / 2}px;width:${b}px;height:${b}px"></div>` : '') +
      (glow ? `<div class="fx fx-glow" style="left:${(size - g) / 2}px;top:${(size - g) / 2}px;width:${g}px;height:${g}px"></div>` : '') +
      (sparks ? `<div class="fx fx-spark" style="left:${size * .82}px;top:${size * .02}px;width:${size * .2}px;height:${size * .2}px"></div>` +
                `<div class="fx fx-spark" style="left:${size * .02}px;top:${size * .7}px;width:${size * .14}px;height:${size * .14}px"></div>` : '') +
      `<img class="ic ic-sh" src="${stud(file)}" ${attrs('image', name)} style="position:absolute;inset:0;width:100%;height:100%">` +
      `</div>`;
  };

  const reward = (name, file, amount, size = 74) =>
    frame(name, icon(file, 'Icon', size) + txt(amount, 'Amount', 't-small'), 'reward');
  const plus = () => baked('+', 'plus');

  // ---------- HUD ----------
  // HUD: un solo tema vivo (azul por defecto) para todos los botones => armonía
  const hudSquare = (name, file, label, theme = 'blue') => pc(`hud-sq studs th-${theme} v-t2`, name, icon(file, 'Icon') + txt(label, 'Label', 't-small'), '', 6);
  const hudWide = (name, file, label, theme = 'blue') => pc(`hud-wide studs th-${theme} v-t2`, name, icon(file, 'Icon') + txt(label, 'Label', 't-label'), 'width:172px', 6);
  const currency = (name, file, value, w = 196) =>
    pc('cur v-dim', name, icon(file, 'Icon') + txt(value, 'Value', 't-label t-left val') +
      pc('btn add v-cta', 'AddButton', baked('+', 't-label', 'font-size:22px'), '', 4), `width:${w}px`, 5);

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
    // texto con degradado
    stage.querySelectorAll('.txt[data-grad]').forEach((el) => {
      const [g1, g2] = el.dataset.grad.split(',');
      el.style.setProperty('--g1', g1); el.style.setProperty('--g2', g2 || g1);
      el.dataset.g = el.textContent.trim();
    });
    // efectos de tarjeta recortados a su forma
    stage.querySelectorAll('.pc').forEach((el) => {
      const fx = [...el.children].filter((c) => c.classList.contains('fx'));
      if (!fx.length) return;
      const clip = document.createElement('div');
      clip.className = 'fxclip';
      el.insertBefore(clip, el.firstChild);
      fx.forEach((f) => clip.appendChild(f));
    });
  }

  window.DS = { txt, baked, icon, robux, pc, frame, row, col, grow, btn, buy, closeBtn, win, tabs, card, hero, reward, plus,
    hudSquare, hudWide, currency, place, render };
})();
