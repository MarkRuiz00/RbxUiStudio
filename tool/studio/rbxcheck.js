/* RbxUI — checks a rbxui document against the official Roblox API (roblox-api.json, built from Roblox/creator-docs).
   Shared: editor (window.RBXCheck, live warnings) and node (tools/validate.mjs).
   checkDoc(doc, api, { snippet }) -> { errs: [{path, msg}], warns: [{path, msg}], names:Set, images:[[path, rel]] } */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RBXCheck = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MOD = /^UI/;
  const DESIGN_KEYS = new Set(['device', 'width', 'height', 'autoScale', 'background']);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(num);
  const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

  function propsOf(API, cls) {
    const out = {};
    for (let c = cls; c && API.classes[c]; c = API.classes[c].inherits[0]) for (const [k, t] of Object.entries(API.classes[c].props)) if (!(k in out)) out[k] = t;
    return out;
  }
  function checkValue(API, type, v) {
    const t = type.replace(/ \(deprecated\)$/, '');
    if (API.enums[t]) return typeof v === 'string' && API.enums[t].includes(v) ? null : `expected Enum.${t} item (${API.enums[t].slice(0, 6).join(', ')}…)`;
    switch (t) {
      case 'Color3': return hex(v) ? null : 'expected "#RRGGBB"';
      case 'UDim2': return nums(v, 4) ? null : 'expected UDim2 [xScale, xOffset, yScale, yOffset]';
      case 'UDim': return nums(v, 2) ? null : 'expected UDim [scale, offset]';
      case 'Vector2': return nums(v, 2) ? null : 'expected Vector2 [x, y]';
      case 'Rect': return nums(v, 4) ? null : 'expected Rect [minX, minY, maxX, maxY]';
      case 'ColorSequence': return hex(v) || (Array.isArray(v) && v.length >= 1 && v.every((k) => Array.isArray(k) && num(k[0]) && hex(k[1])) && v[0][0] === 0 && v[v.length - 1][0] === 1) ? null : 'expected "#hex" or [[0,"#hex"],…,[1,"#hex"]] (first t=0, last t=1)';
      case 'NumberSequence': return num(v) || (Array.isArray(v) && v.every((k) => Array.isArray(k) && num(k[0]) && num(k[1])) && v[0][0] === 0 && v[v.length - 1][0] === 1) ? null : 'expected number or [[0,v],…,[1,v]]';
      case 'NumberRange': return num(v) || nums(v, 2) ? null : 'expected number or [min, max]';
      case 'Font': return v && typeof v === 'object' && typeof v.family === 'string' ? null : 'expected { family, weight, style }';
      case 'bool': case 'boolean': return typeof v === 'boolean' ? null : 'expected boolean';
      case 'float': case 'double': case 'int': case 'int64': case 'number': return num(v) ? null : 'expected number';
      case 'string': case 'ContentId': case 'Content': return typeof v === 'string' ? null : 'expected string';
      default: return null;
    }
  }

  function checkDoc(doc, API, opts = {}) {
    const errs = [], warns = [], names = new Set(), targets = [], images = [];
    const E = (path, msg) => errs.push({ path, msg }), W = (path, msg) => warns.push({ path, msg });
    if (doc && doc.ClassName === 'ScreenGui') doc = { format: 'rbxui', version: 1, screens: [doc] };
    if (!doc || !Array.isArray(doc.screens) || !doc.screens.length) { E('', 'no "screens"'); return { errs, warns, names, images, doc }; }
    const walk = (n, p, parent) => {
      const at = p ? `${p}.${n.Name || n.ClassName}` : String(n.Name || n.ClassName);
      if (!n.ClassName) { E(at, 'missing ClassName'); return; }
      if (!API.classes[n.ClassName]) W(at, `class ${n.ClassName} not in the UI API subset (check spelling)`);
      names.add(n.Name);
      const P = propsOf(API, n.ClassName);
      for (const [k, v] of Object.entries(n.props || {})) {
        if (!(k in P)) { if (API.classes[n.ClassName]) E(at, `${k}: not a writable property of ${n.ClassName}`); continue; }
        if (/deprecated/.test(P[k])) W(at, `${k}: deprecated (use the modern property)`);
        const e = checkValue(API, P[k], v); if (e) E(at, `${k} = ${JSON.stringify(v)}: ${e}`);
      }
      if (MOD.test(n.ClassName) && parent && MOD.test(parent.ClassName) && !(parent.ClassName === 'UIStroke' && n.ClassName === 'UIGradient')) W(at, 'modifier inside another modifier');
      if (n.ClassName === 'ScreenGui' && n.design) for (const k of Object.keys(n.design)) if (!DESIGN_KEYS.has(k)) W(at, `design.${k}: unknown design key`);
      for (const it of n.interactions || []) {
        if (!['open', 'close', 'toggle'].includes(it.action)) E(at, `interaction action "${it.action}" (open|close|toggle)`);
        if (it.target) targets.push([at, it.target]);
      }
      for (const k of ['Image', 'HoverImage', 'PressedImage']) {
        const v = n.props && n.props[k];
        if (typeof v === 'string' && v && !/^(rbxasset|rbxthumb|https?:)/.test(v)) images.push([at, v]);
      }
      const seen = new Set();
      for (const c of n.children || []) {
        const nm = c.Name || c.ClassName;
        if (seen.has(nm)) E(`${at}.${nm}`, 'duplicate sibling name');
        seen.add(nm); walk(c, at, n);
      }
    };
    for (const s of doc.screens) { if (s.ClassName !== 'ScreenGui') E(s.Name || '', 'root must be ScreenGui'); walk(s, '', null); }
    for (const [at, t] of targets) if (!names.has(t)) (opts.snippet ? W : E)(at, `interaction target "${t}" not found`);
    return { errs, warns, names, images, doc };
  }
  return { checkDoc, propsOf, checkValue };
});
