// Headless browser for rendering (previews, Figma rasterizing, exports).
// Uses the `playwright` npm package (npm install in tool/). Tries the installed Google Chrome first
// (best font/emoji fidelity), then Playwright's bundled Chromium (`npx playwright install chromium`).
// RBXUI_PLAYWRIGHT=<path to a playwright package> overrides where Playwright is loaded from.
'use strict';
function loadPlaywright() {
  const tries = [process.env.RBXUI_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch { /* next */ } }
  throw new Error('Playwright not found: run "npm install" inside tool/ (and "npx playwright install chromium" if you have no Chrome).');
}
async function launch(opts = {}) {
  const { chromium } = loadPlaywright();
  try { return await chromium.launch({ channel: 'chrome', headless: true, ...opts }); }
  catch { return chromium.launch({ headless: true, ...opts }); }
}
module.exports = { launch, loadPlaywright };
