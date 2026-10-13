// Plugin de ejemplo con la API estándar de Figma: lista los colores sólidos de la selección y permite cambiarlos.
figma.showUI(__html__, { width: 260, height: 320, title: 'Colores de la selección' });

const toHex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const fromHex = (s) => { const v = parseInt(s.slice(1), 16); return { r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255 }; };

function collect() {
  const colors = new Map();
  const visit = (n) => {
    for (const key of ['fills', 'strokes']) {
      const ps = n[key];
      if (ps === figma.mixed || !ps) continue;
      for (const p of ps) if (p.type === 'SOLID') { const h = toHex(p.color); colors.set(h, (colors.get(h) || 0) + 1); }
    }
    if ('children' in n) n.children.forEach(visit);
  };
  figma.currentPage.selection.forEach(visit);
  figma.ui.postMessage({ type: 'colors', colors: [...colors.entries()].sort((a, b) => b[1] - a[1]) });
}

figma.on('selectionchange', collect);
collect();

figma.ui.onmessage = (msg) => {
  if (msg.type !== 'replace') return;
  const to = fromHex(msg.to);
  const visit = (n) => {
    for (const key of ['fills', 'strokes']) {
      const ps = n[key];
      if (ps === figma.mixed || !ps) continue;
      if (ps.some((p) => p.type === 'SOLID' && toHex(p.color) === msg.from)) n[key] = ps.map((p) => (p.type === 'SOLID' && toHex(p.color) === msg.from ? { ...p, color: to } : p));
    }
    if ('children' in n) n.children.forEach(visit);
  };
  figma.currentPage.selection.forEach(visit);
  collect();
};
