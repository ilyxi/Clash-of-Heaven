#!/usr/bin/env node
'use strict';
// Builds dist/clash-of-heaven.html: one self-contained file (all CSS and JS
// inlined) that runs by double-clicking it, no server needed.
//   node tools/bundle.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  if (/^https?:/.test(href)) return m;
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  if (/^https?:/.test(src)) return m;
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  if (/<\/script/i.test(js)) throw new Error(`${src} contains a closing script tag; cannot inline it`);
  return `<script>\n// ---- ${src} ----\n${js}\n</script>`;
});

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'clash-of-heaven.html');
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB)`);
