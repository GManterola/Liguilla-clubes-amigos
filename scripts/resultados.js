#!/usr/bin/env node
/**
 * resultados.js — Imagen vertical (1080×1350, para WhatsApp) con los resultados de la
 * última jornada disputada: marcadores con escudos, rey, farolillo, quién paga y el top 4.
 *
 * Uso:  node scripts/resultados.js <salida.png>
 * Requiere Playwright con Chromium. No modifica el repo.
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
if (!OUT) { console.error('Uso: node scripts/resultados.js <salida.png>'); process.exit(1); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  const info = await page.evaluate(() => {
    const r = lastR, j = r.j;
    const rk = jornadasRanking2627.find(x => x.j === j).ranking;
    const pts = jorStatsHistory.find(h => h.j === j).data;
    const table = standingsUpTo(played.length);
    const king = rk[0], last = rk[15];
    const payers = rk.slice(10).map((t, i) => [t, payFor(11 + i)]).reverse();
    const eur = n => n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

    const row = ([h, hs, as, a]) => {
      const x = +hs, y = +as, cls = (me, ot) => me > ot ? 'w' : me < ot ? 'l' : 'd';
      return `<div class="rs-m">
        <div class="rs-t ${cls(x, y)}">${crest(h, 46)}<span>${esc(h)}</span></div>
        <div class="rs-sc"><b class="${cls(x, y)}">${hs}</b><i>-</i><b class="${cls(y, x)}">${as}</b></div>
        <div class="rs-t r ${cls(y, x)}"><span>${esc(a)}</span>${crest(a, 46)}</div></div>`;
    };

    document.body.innerHTML = `
    <div id="rs">
      <div class="glow"></div>
      <div class="rs-head">
        <div class="rs-brand"><div class="logo">${document.querySelector('.logo').innerHTML}</div>
          <div><b>LIGA CLUBES AMIGOS</b><small>TEMPORADA ${TEMPORADA}</small></div></div>
        <div class="rs-title">RESULTADOS <span>J${jorNum(j)}</span></div>
      </div>
      <div class="rs-duo">
        <div class="rs-spot king"><small>REY DE LA JORNADA</small><div>${crest(king, 52)}<b>${esc(king)}</b><em>${pts[king]}</em></div></div>
        <div class="rs-spot last"><small>FAROLILLO ROJO</small><div>${crest(last, 52)}<b>${esc(last)}</b><em>${pts[last]}</em></div></div>
      </div>
      <div class="rs-list">${r.matches.map(row).join('')}</div>
      <div class="rs-foot">
        <div class="rs-pay"><small>PAGAN</small><div>${payers.map(([t, a]) => `<span>${crest(t, 22)}${esc(t)} <b>${eur(a)}</b></span>`).join('')}</div></div>
        <div class="rs-top"><small>CLASIFICACIÓN</small><div>${table.slice(0, 4).map((t, i) => `<span><em>${i + 1}º</em>${esc(t.name)} <b>${t.pts}</b></span>`).join('')}</div></div>
      </div>
    </div>`;
    const css = document.createElement('style');
    css.textContent = `
      html,body{margin:0;padding:0;background:var(--bg)}
      #rs{position:relative;width:1080px;height:1350px;box-sizing:border-box;padding:50px 56px 44px;overflow:hidden;
        display:grid;grid-template-rows:auto auto 1fr auto;gap:22px;background:var(--bg);color:var(--ink);font-family:var(--font-body)}
      #rs .glow{position:absolute;width:1000px;height:1000px;border-radius:50%;top:-520px;right:-380px;background:radial-gradient(circle,rgba(245,200,66,.17),transparent 62%)}
      #rs::after{content:"";position:absolute;left:0;right:0;bottom:0;height:12px;background:var(--accent)}
      .rs-head{position:relative;display:grid;gap:8px}
      .rs-brand{display:flex;align-items:center;gap:14px}
      .rs-brand .logo{width:48px;height:48px;border-radius:12px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center}
      .rs-brand .logo svg{width:26px;height:26px}
      .rs-brand b{display:block;font-family:var(--font-display);font-size:28px;font-weight:800;line-height:1}
      .rs-brand small{display:block;color:var(--muted);font-size:14px;letter-spacing:.14em;font-weight:600;margin-top:4px}
      .rs-title{font-family:var(--font-display);font-weight:800;font-size:92px;line-height:.9;margin-top:10px}
      .rs-title span{color:var(--accent)}
      .rs-duo{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .rs-spot{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 18px;display:grid;gap:8px}
      .rs-spot small{font-size:14px;font-weight:800;letter-spacing:.14em}
      .rs-spot.king small{color:var(--gold)} .rs-spot.last small{color:var(--loss)}
      .rs-spot>div{display:flex;align-items:center;gap:12px}
      .rs-spot b{font-size:24px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-spot em{font-style:normal;font-family:var(--font-display);font-weight:800;font-size:48px;line-height:1}
      .rs-spot.king em{color:var(--gold)} .rs-spot.last em{color:var(--loss)}
      .rs-list{position:relative;display:grid;gap:9px;align-content:center}
      .rs-m{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:9px 16px}
      .rs-t{display:flex;align-items:center;gap:12px;min-width:0;font-size:23px;color:var(--muted);font-weight:500}
      .rs-t.r{justify-content:flex-end;text-align:right}
      .rs-t span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-t.w{color:var(--ink);font-weight:700}
      .rs-sc{display:flex;align-items:center;gap:6px;font-family:var(--font-display);font-weight:800;font-size:34px}
      .rs-sc b{min-width:58px;text-align:center;padding:2px 6px;border-radius:9px;background:var(--surface-2);color:var(--muted)}
      .rs-sc b.w{background:var(--accent);color:var(--accent-ink)}
      .rs-sc b.d{color:var(--ink)}
      .rs-sc i{font-style:normal;color:var(--muted)}
      .rs-foot{position:relative;display:grid;grid-template-columns:1.35fr 1fr;gap:24px}
      .rs-foot small{display:block;color:var(--muted);font-size:13px;font-weight:800;letter-spacing:.14em;margin-bottom:8px}
      .rs-pay>div{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}
      .rs-pay span,.rs-top span{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;white-space:nowrap}
      .rs-pay b{color:var(--pay);margin-left:auto}
      .rs-top>div{display:grid;gap:6px}
      .rs-top em{font-style:normal;color:var(--muted);width:30px}
      .rs-top b{color:var(--accent);margin-left:auto;font-family:var(--font-display);font-size:22px}`;
    document.head.appendChild(css);
    return { j, king, last };
  });
  await page.waitForTimeout(300);
  await page.locator('#rs').screenshot({ path: OUT });
  await browser.close();
  console.log(`✅ Resultados ${info.j} → ${OUT} (rey ${info.king}, farolillo ${info.last})`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
