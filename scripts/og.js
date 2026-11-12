#!/usr/bin/env node
/**
 * og.js — Genera img/og.png (la vista previa al compartir el enlace por WhatsApp)
 * con el resumen de la última jornada, y actualiza las etiquetas og: de index.html.
 *
 * Uso:  node scripts/og.js
 * Requiere Playwright con Chromium (disponible en las sesiones de Claude Code).
 * Ejecutar después de actualizar data/ y antes del commit.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'img/og.png');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  // Se carga la propia web para reutilizar datos, escudos y fuentes
  await page.goto('file://' + HTML);
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  const info = await page.evaluate(() => {
    const j = lastR.j;
    const rk = jornadasRanking2627.find(r => r.j === j).ranking;
    const pts = jorStatsHistory.find(h => h.j === j).data;
    const table = standingsUpTo(played.length);
    const king = rk[0], last = rk[15], leader = table[0];
    const payers = rk.slice(10).reverse();

    document.body.innerHTML = `
    <div id="og">
      <div class="glow"></div>
      <div class="og-top">
        <div class="og-brand"><div class="logo">${document.querySelector('.logo').innerHTML}</div>
          <div><b>LIGA CLUBES AMIGOS</b><small>TEMPORADA ${TEMPORADA}</small></div></div>
        <div class="og-j">JORNADA <span>${jorNum(j)}</span></div>
      </div>
      <div class="og-duo">
        <div class="og-spot king"><small>REY DE LA JORNADA</small><div class="og-who">${crest(king, 86)}<div><b>${esc(king)}</b><span>${pts[king]} pts</span></div></div></div>
        <div class="og-spot last"><small>FAROLILLO ROJO</small><div class="og-who">${crest(last, 86)}<div><b>${esc(last)}</b><span>${pts[last]} pts</span></div></div></div>
      </div>
      <div class="og-foot">
        <div><small>LÍDER</small><b>${esc(leader.name)} · ${leader.pts} pts</b></div>
        <div><small>PAGAN</small><b>${payers.map(t => esc(t)).join(' · ')}</b></div>
      </div>
    </div>`;
    const st = document.createElement('style');
    st.textContent = `
      html,body{margin:0;padding:0;background:var(--bg)}
      #og{position:relative;width:1200px;height:630px;box-sizing:border-box;padding:48px 60px 44px;overflow:hidden;
        display:grid;grid-template-rows:auto 1fr auto;gap:28px;font-family:var(--font-body);color:var(--ink);background:var(--bg)}
      #og .glow{position:absolute;width:900px;height:900px;border-radius:50%;top:-420px;right:-300px;background:radial-gradient(circle,rgba(245,200,66,.16),transparent 62%)}
      #og::after{content:"";position:absolute;left:0;right:0;bottom:0;height:10px;background:var(--accent)}
      .og-top{display:flex;align-items:center;justify-content:space-between;position:relative}
      .og-brand{display:flex;align-items:center;gap:16px}
      .og-brand .logo{width:58px;height:58px;border-radius:14px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center}
      .og-brand .logo svg{width:32px;height:32px}
      .og-brand b{display:block;font-family:var(--font-display);font-size:34px;font-weight:800;letter-spacing:.02em;line-height:1}
      .og-brand small{display:block;color:var(--muted);font-size:16px;letter-spacing:.14em;font-weight:600;margin-top:4px}
      .og-j{font-family:var(--font-display);font-weight:800;font-size:64px;line-height:1}
      .og-j span{color:var(--accent)}
      .og-duo{display:grid;grid-template-columns:1fr 1fr;gap:24px;position:relative}
      .og-spot{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:24px 28px;display:grid;gap:14px;align-content:center}
      .og-spot small{font-size:17px;font-weight:700;letter-spacing:.14em}
      .og-spot.king small{color:var(--gold)} .og-spot.last small{color:var(--loss)}
      .og-who{display:flex;align-items:center;gap:22px}
      .og-who b{display:block;font-size:34px;line-height:1.1;font-weight:700}
      .og-who span{display:block;font-family:var(--font-display);font-weight:800;font-size:64px;line-height:1;margin-top:4px}
      .og-spot.king span{color:var(--gold)} .og-spot.last span{color:var(--loss)}
      .og-foot{display:grid;grid-template-columns:auto 1fr;gap:40px;position:relative}
      .og-foot small{display:block;color:var(--muted);font-size:15px;font-weight:700;letter-spacing:.14em;margin-bottom:4px}
      .og-foot b{font-size:21px;font-weight:600}`;
    document.head.appendChild(st);
    return { j, king, kingPts: pts[king], last, lastPts: pts[last], leader: leader.name };
  });

  await page.waitForTimeout(300);
  await page.locator('#og').screenshot({ path: OUT });
  await browser.close();

  // Etiquetas para compartir: texto de la jornada y ?v= para que WhatsApp no use la imagen vieja
  let html = fs.readFileSync(HTML, 'utf8');
  const desc = `${info.j}: rey ${info.king} (${info.kingPts}), farolillo ${info.last} (${info.lastPts}). Líder: ${info.leader}.`;
  const setMeta = (prop, val) => {
    const re = new RegExp(`(<meta (?:property|name)="${prop}" content=")[^"]*(")`);
    if (!re.test(html)) throw new Error(`No se encontró la etiqueta ${prop}`);
    html = html.replace(re, `$1${val.replace(/"/g, '&quot;')}$2`);
  };
  setMeta('og:description', desc);
  setMeta('og:image', `https://liguilla-clubes-amigos.vercel.app/img/og.png?v=${info.j.toLowerCase()}`);
  fs.writeFileSync(HTML, html);
  console.log(`✅ img/og.png generado para ${info.j}\n   ${desc}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
