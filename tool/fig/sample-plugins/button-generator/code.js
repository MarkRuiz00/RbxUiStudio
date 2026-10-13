// Plugin de ejemplo con la API estándar de Figma: crea botones con auto layout (funciona igual en Figma y en Fig).
figma.showUI(__html__, { width: 280, height: 250, title: 'Generador de botones' });

const hex = (s) => { const v = parseInt(s.replace('#', ''), 16); return { r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255 }; };

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') { figma.closePlugin(); return; }
  if (msg.type !== 'create') return;
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  const made = [];
  for (let i = 0; i < msg.count; i++) {
    const btn = figma.createFrame();
    btn.name = `${msg.label} ${i + 1}`;
    btn.layoutMode = 'HORIZONTAL';
    btn.primaryAxisSizingMode = 'AUTO';
    btn.counterAxisSizingMode = 'AUTO';
    btn.primaryAxisAlignItems = 'CENTER';
    btn.counterAxisAlignItems = 'CENTER';
    btn.paddingLeft = btn.paddingRight = 24;
    btn.paddingTop = btn.paddingBottom = 12;
    btn.cornerRadius = msg.radius;
    btn.fills = [{ type: 'SOLID', color: hex(msg.color) }];
    btn.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    btn.strokeWeight = 3;
    btn.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.35 }, offset: { x: 0, y: 4 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }];
    const t = figma.createText();
    t.fontName = { family: 'Inter', style: 'Bold' };
    t.characters = msg.label;
    t.fontSize = 20;
    t.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    btn.appendChild(t);
    btn.x = figma.viewport.center.x - 80;
    btn.y = figma.viewport.center.y + i * 70 - (msg.count * 35);
    made.push(btn);
  }
  figma.currentPage.selection = made;
  figma.viewport.scrollAndZoomIntoView(made);
  figma.notify(`${made.length} botón(es) creados`);
  figma.closePlugin();
};
