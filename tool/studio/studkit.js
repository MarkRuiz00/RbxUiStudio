/* RbxUI — kit "Stud Style" en formato rbxui (Instances reales: Frame + UIGradient + UIStroke + mosaico de studs).
   Compartido: editor (window.StudKit, pestaña Insertar) y node (screens/native.mjs genera las pantallas).
   Cada constructor devuelve un nodo {ClassName, Name, props, children, interactions?, buttonFx?}. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudKit = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const IMG = {
    stud: 'assets/rbx/stud.png', burst: 'assets/rbx/burst.png', arrow: 'assets/rbx/arrow.png',
    robux: 'assets/brand/robux_ol.png', icon: (n) => `assets/studs/${n}_Outline.png`,
  };
  // temas: [claro, oscuro] (degradado vertical) + color del reborde interior
  const THEME = {
    orange: ['#FFB547', '#F27A12'], yellow: ['#FFD84A', '#F2A611'], gold: ['#FFE066', '#E9A300'], red: ['#FF5E4E', '#D11F1F'],
    pink: ['#FF7ED0', '#E0187A'], lime: ['#C6FF4A', '#5CCB14'], green: ['#7DE84C', '#27A62A'], teal: ['#43E6CF', '#0E9E8E'],
    cyan: ['#5CD8FF', '#1592E0'], blue: ['#5CA9FF', '#1B5FE0'], purple: ['#C473FF', '#7A22E6'], grey: ['#D3D9E3', '#8E97A8'],
    dark: ['#26282F', '#1A1B21'], body: ['#31333B', '#292B32'],
  };
  const FX = { hover: 1.06, press: 0.9 };
  const INK = '#000000';

  // ---------------------------------------------------------------- piezas básicas
  const U2 = (xs, xo, ys, yo) => [xs, xo, ys, yo];
  const px = (x, y) => [0, x, 0, y];
  const node = (ClassName, Name, props = {}, children = [], extra = {}) => ({ ClassName, Name, props, ...(children.length ? { children } : {}), ...extra });
  const grad = (c1, c2, rot = 90) => node('UIGradient', 'UIGradient', { Color: [[0, c1], [1, c2]], Rotation: rot });
  const stroke = (t = 3, color = INK, o = {}) => node('UIStroke', 'UIStroke', { ApplyStrokeMode: 'Border', Thickness: t, Color: color, LineJoinMode: 'Miter', ...o });
  const corner = (s, o = 0) => node('UICorner', 'UICorner', { CornerRadius: [s, o] });
  const studs = (tr = 0.55) => node('ImageLabel', 'Studs', { Size: U2(1, 0, 1, 0), BackgroundTransparency: 1, Image: IMG.stud, ScaleType: 'Tile', TileSize: px(37, 37), ImageTransparency: tr });
  const gloss = () => node('Frame', 'Gloss', { Size: U2(1, 0, 0.48, 0), BackgroundColor3: '#FFFFFF', BackgroundTransparency: 0.8 });
  const bevel = (h = 3) => node('Frame', 'Bevel', { Position: U2(0, 0, 1, -h), Size: U2(1, 0, 0, h), BackgroundColor3: INK, BackgroundTransparency: 0.72 });
  const rim = (color = '#FFFFFF', tr = 0.5) => node('Frame', 'Rim', { Position: px(2, 2), Size: U2(1, -4, 1, -4), BackgroundTransparency: 1 }, [stroke(1.5, color, { Transparency: tr })]);

  // texto blanco Montserrat Heavy con contorno negro
  const sw = (size) => Math.max(1.5, Math.round(size * 0.26) / 2);
  function text(Name, Text, size, props = {}, o = {}) {
    const kids = [node('UIStroke', 'UIStroke', { ApplyStrokeMode: 'Contextual', Thickness: o.stroke ?? sw(size), Color: INK, LineJoinMode: 'Round' })];
    if (o.grad) kids.push(grad(o.grad[0], o.grad[1]));
    return node('TextLabel', Name, { BackgroundTransparency: 1, Size: px(Math.ceil(Text.length * size * 0.72 + 12), Math.ceil(size * 1.3)), Text, TextSize: size,
      TextColor3: '#FFFFFF', FontFace: { family: 'Montserrat', weight: 'Heavy', style: 'Normal' }, ...props }, kids);
  }
  // pieza de color: degradado claro->oscuro + contorno negro + reborde claro + studs + brillo + bisel
  function piece(Name, theme, props = {}, children = [], o = {}) {
    const [c1, c2] = Array.isArray(theme) ? theme : THEME[theme] || THEME.grey;
    const deco = [grad(c1, c2), stroke(o.stroke ?? 3), studs(o.studs ?? 0.72)];
    if (o.gloss !== false) deco.push(gloss());
    if (o.bevel !== false) deco.push(bevel());
    if (o.rim !== false) deco.push(rim(o.rimColor, o.rimTr));
    return node(o.cls || 'Frame', Name, { BackgroundColor3: '#FFFFFF', ...props }, [...deco, ...children], o.extra || {});
  }
  const icon = (Name, img, size, props = {}) => node('ImageLabel', Name, { BackgroundTransparency: 1, Size: px(size, size), Image: img, ScaleType: 'Fit', ...props });

  // ---------------------------------------------------------------- botones
  const click = (action, target, animation = 'pop') => [{ trigger: 'click', action, target, ...(action === 'close' ? {} : { animation }) }];
  function button(Name, label, theme, w, h, props = {}, o = {}) {
    const size = o.size || Math.round(h * 0.56);
    const kids = [text('Label', label, size, { Size: U2(1, -8, 1, 0), Position: U2(0.5, 0, 0.5, 0), AnchorPoint: [0.5, 0.5], TextScaled: false })];
    return piece(Name, theme, { Size: px(w, h), Text: '', ...props }, [...kids, ...(o.children || [])],
      { cls: 'TextButton', extra: { buttonFx: FX, ...(o.interactions ? { interactions: o.interactions } : {}) } });
  }
  // compra con el logo oficial de Robux
  function buyButton(Name, price, w, h, props = {}, o = {}) {
    const s = Math.round(h * 0.62), ts = Math.round(h * 0.56);
    const row = node('Frame', 'Content', { BackgroundTransparency: 1, Size: U2(1, 0, 1, 0) }, [
      node('UIListLayout', 'UIListLayout', { FillDirection: 'Horizontal', HorizontalAlignment: 'Center', VerticalAlignment: 'Center', Padding: [0, 6], SortOrder: 'LayoutOrder' }),
      icon('Robux', IMG.robux, s, { LayoutOrder: 1 }),
      text('Price', String(price), ts, { LayoutOrder: 2, Size: px(Math.ceil(String(price).length * ts * 0.74 + 6), Math.ceil(ts * 1.3)) }),
    ]);
    return piece(Name, o.theme || 'lime', { Size: px(w, h), Text: '', ...props }, [row], { cls: 'TextButton', extra: { buttonFx: FX } });
  }
  // etiqueta de precio en la esquina (botones rosas: pagar con Robux)
  const priceBadge = (price, props = {}) => node('Frame', 'PriceBadge', { BackgroundTransparency: 1, AnchorPoint: [1, 0.5], Position: U2(1, 4, 0, -2), Size: px(76, 30), ZIndex: 3, ...props }, [
    node('UIListLayout', 'UIListLayout', { FillDirection: 'Horizontal', HorizontalAlignment: 'Right', VerticalAlignment: 'Center', Padding: [0, 3], SortOrder: 'LayoutOrder' }),
    icon('Robux', IMG.robux, 22, { LayoutOrder: 1, ZIndex: 3 }),
    text('Price', String(price), 24, { LayoutOrder: 2, TextColor3: '#A8FF2E', Size: px(40, 30), ZIndex: 3 }),
  ]);
  const closeButton = (win) => piece('CloseButton', 'red', { AnchorPoint: [1, 0.5], Position: U2(1, -7, 0.5, 0), Size: px(38, 36), Text: '' },
    [text('X', 'X', 22, { Size: U2(1, 0, 1, 0) })], { cls: 'TextButton', rimColor: '#FFA53A', rimTr: 0, extra: { buttonFx: FX, interactions: click('close', win) } });

  // ---------------------------------------------------------------- ventana: cuerpo carbón, color solo en la cabecera
  function win(Name, { title, iconImg, theme = 'yellow', w = 480, h = 320, x = 0, y = 0, body = [] }) {
    const head = piece('Header', theme, { Size: U2(1, 0, 0, 50) }, [
      ...(iconImg ? [icon('Icon', iconImg, 40, { AnchorPoint: [0, 0.5], Position: U2(0, 8, 0.5, 0) })] : []),
      text('Title', title, 26, { AnchorPoint: [0, 0.5], Position: U2(0, iconImg ? 56 : 14, 0.5, 0), Size: U2(0.7, 0, 0, 34), TextXAlignment: 'Left' }),
      closeButton(Name),
    ], { stroke: 3, studs: 0.66 });
    return node('Frame', Name, { AnchorPoint: [0.5, 0.5], Position: U2(0.5, x, 0.5, y), Size: px(w, h), BackgroundColor3: '#FFFFFF', Visible: false }, [
      grad(...THEME.body), stroke(4), studs(0.9),
      node('Frame', 'Body', { Position: px(0, 50), Size: U2(1, 0, 1, -50), BackgroundTransparency: 1 }, body),
      head,
    ]);
  }
  // etiqueta de sección dorada con línea que se desvanece
  const section = (Name, label, y, w) => node('Frame', Name, { BackgroundTransparency: 1, Position: px(12, y), Size: px(w - 24, 24) }, [
    text('Text', label, 14, { AnchorPoint: [0.5, 0], Position: U2(0.5, 0, 0, 0), Size: U2(1, 0, 0, 18), TextColor3: '#FFD23A' }),
    node('Frame', 'Line', { AnchorPoint: [0.5, 1], Position: U2(0.5, 0, 1, 0), Size: U2(0.9, 0, 0, 2), BackgroundColor3: '#FFC21E' },
      [node('UIGradient', 'UIGradient', { Transparency: [[0, 1], [0.5, 0], [1, 1]] })]),
  ]);
  // caja oscura (filas de stats)
  const box = (Name, props = {}, children = []) => node('Frame', Name, { BackgroundColor3: '#FFFFFF', ...props },
    [grad('#1F2127', '#17181D'), stroke(2.5), rim('#FFFFFF', 0.88), ...children]);
  // moneda dorada que enmarca un icono
  const coin = (Name, img, size, props = {}) => node('Frame', Name, { BackgroundColor3: '#FFFFFF', Size: px(size, size), ...props }, [
    // piezas redondas: LineJoinMode Round (con Miter, Roblox pinta el contorno cuadrado)
    corner(0.5), grad('#FFE680', '#E09A00'), stroke(3, INK, { LineJoinMode: 'Round' }),
    node('Frame', 'Inner', { AnchorPoint: [0.5, 0.5], Position: U2(0.5, 0, 0.5, 0), Size: U2(0.8, 0, 0.8, 0), BackgroundColor3: '#FFFFFF' },
      [corner(0.5), grad('#E8A200', '#FFD54A'), stroke(2, '#9A6200', { LineJoinMode: 'Round' })]),
    icon('Icon', img, Math.round(size * 0.66), { AnchorPoint: [0.5, 0.5], Position: U2(0.5, 0, 0.5, 0) }),
  ]);

  // ---------------------------------------------------------------- HUD
  const hudSquare = (Name, label, img, theme, props = {}, o = {}) => piece(Name, theme, { Size: px(64, 64), Text: '', ...props }, [
    icon('Icon', img, 50, { AnchorPoint: [0.5, 0], Position: U2(0.5, 0, 0, 1) }),
    text('Label', label, 13, { AnchorPoint: [0.5, 1], Position: U2(0.5, 0, 1, -1), Size: U2(1, 4, 0, 17) }),
  ], { cls: 'TextButton', extra: { buttonFx: FX, ...(o.interactions ? { interactions: o.interactions } : {}) } });
  const hudWide = (Name, label, img, theme, props = {}, o = {}) => piece(Name, theme, { Size: px(150, 46), Text: '', ...props }, [
    text('Label', label, 24, { AnchorPoint: [0, 0.5], Position: U2(0, 46, 0.5, 0), Size: px(96, 30), TextXAlignment: 'Left' }),
    icon('Icon', img, 64, { Position: px(-24, -13), ZIndex: 2 }),
  ], { cls: 'TextButton', extra: { buttonFx: FX, ...(o.interactions ? { interactions: o.interactions } : {}) } });
  // divisa: icono + número grande + botón +
  const currency = (Name, img, value, color, props = {}) => node('Frame', Name, { BackgroundTransparency: 1, Size: px(230, 44), ...props }, [
    icon('Icon', img, 44, { Position: px(0, 0) }),
    text('Value', value, 30, { Position: px(52, 3), Size: px(140, 38), TextXAlignment: 'Left', TextColor3: color }),
    node('ImageButton', 'AddButton', { BackgroundTransparency: 1, Image: IMG.icon('Plus'), ScaleType: 'Fit', Size: px(26, 26), AnchorPoint: [0, 0.5], Position: U2(0, 60 + Math.ceil(value.length * 16.5), 0.5, 0) }, [], { buttonFx: FX }),
  ]);
  // slot de recompensa (Index / Daily)
  const tile = (Name, theme, img, top, bottom, props = {}, o = {}) => piece(Name, theme, { Size: px(o.w || 96, o.h || 96), ...props }, [
    icon('Icon', img, o.icon || 66, { AnchorPoint: [0.5, 0.5], Position: U2(0.5, 0, 0.5, o.iconDy ?? 1) }),
    text('Top', top, 13, { Position: px(6, 3), Size: px(60, 16), TextXAlignment: 'Left' }),
    text('Bottom', bottom, o.bottomSize || 18, { AnchorPoint: [0, 1], Position: U2(0, 6, 1, -3), Size: px(90, Math.ceil((o.bottomSize || 18) * 1.3)), TextXAlignment: 'Left' }),
  ], { studs: 0.74 });

  const design = (o = {}) => ({ device: 'studio', width: 1280, height: 720, autoScale: true, background: 'baseplate', ...o });
  const screen = (Name, children, o = {}) => ({ ClassName: 'ScreenGui', Name, props: { ResetOnSpawn: false, ...(o.props || {}) }, design: design(o.design), children, ...(o.attributes ? { attributes: o.attributes } : {}) });

  return { IMG, THEME, FX, U2, px, node, grad, stroke, corner, studs, gloss, bevel, rim, text, piece, icon, click, button, buyButton, priceBadge,
    closeButton, win, section, box, coin, hudSquare, hudWide, currency, tile, screen, design };
});
