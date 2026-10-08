// Página exportable de una escena: la misma que ve el editor, con data-rbx para export.mjs.
// Escenas nativas (rbxui): carga rbxjson.js + fuentes de Roblox y pinta las Instances tal cual.
import { createRequire } from 'module';
const { FONT_URL } = createRequire(import.meta.url)('./rbxjson.js');
const safe = (s) => String(s || '').replace(/[^\w-]/g, '');

export function sceneHtml(scene) {
  const name = safe(scene.name);
  const data = JSON.stringify(scene).replace(/</g, '\\u003c');
  const fonts = scene.native
    ? FONT_URL
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
