#!/usr/bin/env node
/**
 * build-artifact.js — Genera una copia de index.html con los datos incrustados,
 * para publicar en el artefacto de Claude (que no carga scripts locales con seguridad).
 * Uso: node scripts/build-artifact.js <salida.html>
 * La web de Vercel sigue usando index.html + data/ tal cual.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('Uso: node scripts/build-artifact.js <salida.html>'); process.exit(1); }
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<script src="(data\/[^"]+\.js)"><\/script>/g, (_, f) =>
  `<script>\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}</script>`);
if (/<script src="data\//.test(html)) { console.error('No se pudieron incrustar todos los datos'); process.exit(1); }
// En el artefacto no se pueden usar rutas tipo /pagos: se fuerza el modo #pagos
html = html.replace('<html lang="es">', '<html lang="es" data-routing="hash">');
if (!html.includes('data-routing="hash"')) { console.error('No se pudo activar el modo hash'); process.exit(1); }
fs.writeFileSync(out, html);
console.log(`✅ ${out} (${(html.length / 1024).toFixed(1)} KB)`);
