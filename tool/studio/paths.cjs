// Where RbxUI Studio reads code vs. user data.
//   CODE = this tool folder (studio/, plugin/, runtime/, site/, ds/, assets/brand/)
//   DATA = your workspace (screens/, projects.json, examples/, assets/… images, out/, .secrets/)
// DATA comes from the RBXUI_DATA env var, else from the first line of tool/.rbxui-data, else CODE itself.
'use strict';
const fs = require('fs');
const path = require('path');
const CODE = path.resolve(__dirname, '..');
function dataDir() {
  let d = process.env.RBXUI_DATA;
  if (!d) { try { d = fs.readFileSync(path.join(CODE, '.rbxui-data'), 'utf8').split(/\r?\n/)[0].trim(); } catch { d = ''; } }
  if (!d) return CODE;
  const abs = path.resolve(CODE, d);
  return fs.existsSync(abs) ? abs : CODE;
}
const DATA = dataDir();
// a file under DATA if it exists there, else under CODE (static files, brand images…)
const resolveFile = (rel) => { const a = path.join(DATA, rel); return fs.existsSync(a) ? a : path.join(CODE, rel); };
module.exports = { CODE, DATA, resolveFile };
