// Página exportable de una escena: la misma que ve el editor, con data-rbx para export.mjs.
// Escenas nativas (rbxui): carga rbxjson.js + fuentes de Roblox y pinta las Instances tal cual.
const safe = (s) => String(s || '').replace(/[^\w-]/g, '');

export function sceneHtml(scene) {
  const name = safe(scene.name);
  const data = JSON.stringify(scene).replace(/</g, '\\u003c');
  const fonts = scene.native
    ? 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Inter:wght@100..900&family=Fredoka:wght@300..700&family=Luckiest+Guy&family=Bangers&family=Source+Sans+3:wght@200..900&family=Roboto:wght@100..900&family=Oswald:wght@200..700&family=Nunito:wght@200..1000&family=Arimo:wght@400..700&family=Press+Start+2P&display=swap'
    : 'https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${name} (RbxUI Studio)</title>
<link href="${fonts}" rel="stylesheet">
<link rel="stylesheet" href="../ds/ds.css">
</head><body>
<!-- Generado por RbxUI Studio desde ${name}.scene.json. No editar a mano: editar la escena. -->
<div class="stage" data-rbx-root data-name="${name}"></div>
${scene.native ? '<script src="../studio/rbxjson.js"></script>\n' : ''}<script src="../studio/render.js"></script>
<script>RBXRender.renderScene(${data}, document.querySelector('.stage'), { export: true });${scene.native ? "\ndocument.fonts.ready.then(() => RBXJson.fitScaled(document.querySelector('.stage')));" : ''}</script>
</body></html>
`;
}

export { safe };
