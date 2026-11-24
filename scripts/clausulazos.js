#!/usr/bin/env node
/**
 * clausulazos.js — Imagen vertical (1080×1350, para WhatsApp) con los clausulazos del
 * tablón de Biwenger (data/biwenger/ultima.json): el bombazo, los más caros y quién
 * más ha clausulado y más le han robado.
 *
 * Uso:  node scripts/clausulazos.js <salida.png> [desde AAAA-MM-DD] [titulo]
 * Requiere Playwright con Chromium y una lectura reciente de Biwenger. No modifica el repo.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const [OUT, DESDE, TITULO] = process.argv.slice(2);
if (!OUT) { console.error('Uso: node scripts/clausulazos.js <salida.png> [desde AAAA-MM-DD] [titulo]'); process.exit(1); }

const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/biwenger/ultima.json'), 'utf8'));
const desde = DESDE ? Date.parse(DESDE + 'T00:00:00+01:00') / 1000 : 0;
const clauses = [];
for (const e of b.board?.entries || []) {
  if (e.date < desde) continue;
  for (const c of e.content) if (c.type === 'clause') {
    const p = b.players?.[String(c.player)] || {};
    clauses.push({ date: e.date, player: p.name || `Jugador ${c.player}`, position: p.position, from: c.from, to: c.to, amount: c.amount });
  }
}
if (!clauses.length) { console.error('No hay clausulazos en ese periodo'); process.exit(1); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  const info = await page.evaluate(({ clauses, titulo }) => {
    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const BYN = Object.fromEntries(TEAMS_2627.map(t => [norm(t), t]));
    const team = n => BYN[norm(n)] || n;
    clauses.forEach(c => { c.from = team(c.from); c.to = team(c.to); });
    const eur = n => n.toLocaleString('es-ES') + ' €';
    const mill = n => (n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' M€';
    const POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };
    const fecha = t => new Date(t * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });

    const sorted = clauses.slice().sort((a, c) => c.amount - a.amount);
    const bomb = sorted[0], rest = sorted.slice(1, 9), more = sorted.length - 9;
    const total = clauses.reduce((s, c) => s + c.amount, 0);
    const agg = key => { const m = {}; clauses.forEach(c => { m[c[key]] = m[c[key]] || { n: 0, amt: 0 }; m[c[key]].n++; m[c[key]].amt += c.amount; }); return Object.entries(m).sort((a, c) => c[1].n - a[1].n || c[1].amt - a[1].amt)[0]; };
    const [hunter, h] = agg('to'), [victim, v] = agg('from');
    const dates = clauses.map(c => c.date);

    const line = c => `<div class="cl-row">
      <div class="cl-pl"><b>${esc(c.player)}</b><small>${POS[c.position] || ''} · ${fecha(c.date)}</small></div>
      <div class="cl-mv">${crest(c.from, 34)}<i>→</i>${crest(c.to, 34)}</div>
      <div class="cl-amt">${eur(c.amount)}</div></div>`;

    document.body.innerHTML = `
    <div id="cl">
      <div class="glow"></div>
      <div class="cl-head">
        <div class="cl-brand"><div class="logo">${document.querySelector('.logo').innerHTML}</div>
          <div><b>LIGA CLUBES AMIGOS</b><small>TEMPORADA ${TEMPORADA}</small></div></div>
        <div class="cl-title">${esc(titulo || 'CLAUSULAZOS')}</div>
        <div class="cl-sub">${fecha(Math.min(...dates))} – ${fecha(Math.max(...dates))} · <b>${clauses.length} clausulazos</b> · <b>${mill(total)}</b></div>
      </div>
      <div class="cl-bomb">
        <small>💣 EL BOMBAZO</small>
        <div class="cl-bomb-in">
          <div class="cl-bomb-pl"><b>${esc(bomb.player)}</b><span>${esc(bomb.from)} → ${esc(bomb.to)}</span></div>
          <div class="cl-bomb-mv">${crest(bomb.from, 64)}<i>→</i>${crest(bomb.to, 64)}</div>
        </div>
        <div class="cl-bomb-amt">${eur(bomb.amount)}</div>
      </div>
      <div class="cl-list">${rest.map(line).join('')}${more > 0 ? `<div class="cl-more">y ${more} clausulazo${more !== 1 ? 's' : ''} más</div>` : ''}</div>
      <div class="cl-foot">
        <div><small>MÁS CLAUSULADOR</small><div class="cl-f">${crest(hunter, 40)}<span><b>${esc(hunter)}</b>${h.n} clausulazos · ${mill(h.amt)}</span></div></div>
        <div><small>MÁS SAQUEADO</small><div class="cl-f">${crest(victim, 40)}<span><b>${esc(victim)}</b>${v.n} jugadores perdidos</span></div></div>
      </div>
    </div>`;
    const css = document.createElement('style');
    css.textContent = `
      html,body{margin:0;padding:0;background:var(--bg)}
      #cl{position:relative;width:1080px;height:1350px;box-sizing:border-box;padding:50px 56px 44px;overflow:hidden;
        display:grid;grid-template-rows:auto auto 1fr auto;gap:20px;background:var(--bg);color:var(--ink);font-family:var(--font-body)}
      #cl .glow{position:absolute;width:1000px;height:1000px;border-radius:50%;top:-520px;right:-380px;background:radial-gradient(circle,rgba(248,113,113,.16),transparent 62%)}
      #cl::after{content:"";position:absolute;left:0;right:0;bottom:0;height:12px;background:var(--loss)}
      .cl-head{position:relative;display:grid;gap:8px}
      .cl-brand{display:flex;align-items:center;gap:14px}
      .cl-brand .logo{width:48px;height:48px;border-radius:12px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center}
      .cl-brand .logo svg{width:26px;height:26px}
      .cl-brand b{display:block;font-family:var(--font-display);font-size:28px;font-weight:800;line-height:1}
      .cl-brand small{display:block;color:var(--muted);font-size:14px;letter-spacing:.14em;font-weight:600;margin-top:4px}
      .cl-title{font-family:var(--font-display);font-weight:800;font-size:100px;line-height:.9;margin-top:10px;color:var(--loss)}
      .cl-sub{font-size:22px;color:var(--muted);font-weight:600}
      .cl-sub b{color:var(--ink)}
      .cl-bomb{position:relative;background:linear-gradient(135deg,rgba(248,113,113,.16),rgba(245,200,66,.08));border:1px solid rgba(248,113,113,.45);border-radius:20px;padding:18px 24px;display:grid;gap:8px}
      .cl-bomb small{font-size:15px;font-weight:800;letter-spacing:.14em;color:var(--loss)}
      .cl-bomb-in{display:flex;align-items:center;justify-content:space-between;gap:16px}
      .cl-bomb-pl b{display:block;font-family:var(--font-display);font-size:52px;font-weight:800;line-height:1}
      .cl-bomb-pl span{display:block;font-size:20px;color:var(--muted);font-weight:600;margin-top:6px}
      .cl-bomb-mv{display:flex;align-items:center;gap:10px}
      .cl-bomb-mv i,.cl-mv i{font-style:normal;color:var(--muted);font-size:26px;font-weight:700}
      .cl-bomb-amt{font-family:var(--font-display);font-weight:800;font-size:56px;color:var(--gold);line-height:1}
      .cl-list{position:relative;display:grid;gap:7px;align-content:start}
      .cl-row{display:grid;grid-template-columns:1fr auto 230px;align-items:center;gap:16px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 16px}
      .cl-pl b{display:block;font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cl-pl small{color:var(--muted);font-size:15px;font-weight:600}
      .cl-mv{display:flex;align-items:center;gap:8px}
      .cl-amt{text-align:right;font-family:var(--font-display);font-weight:800;font-size:28px;color:var(--pay)}
      .cl-more{text-align:center;color:var(--muted);font-size:17px;font-weight:600;padding-top:4px}
      .cl-foot{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .cl-foot small{display:block;color:var(--muted);font-size:13px;font-weight:800;letter-spacing:.14em;margin-bottom:8px}
      .cl-f{display:flex;align-items:center;gap:12px;font-size:17px;color:var(--muted);font-weight:600}
      .cl-f b{display:block;color:var(--ink);font-size:22px}`;
    document.head.appendChild(css);
    return { n: clauses.length, total, bomb: bomb.player };
  }, { clauses, titulo: TITULO });

  await page.waitForTimeout(300);
  await page.locator('#cl').screenshot({ path: OUT });
  await browser.close();
  console.log(`✅ Clausulazos → ${OUT} (${info.n} clausulazos, ${info.total.toLocaleString('es-ES')} €, bombazo: ${info.bomb})`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
