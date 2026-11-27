#!/usr/bin/env node
/**
 * previa.js — Genera una imagen vertical (1080×1350, para WhatsApp) con la previa de la
 * próxima jornada: los 8 partidos con escudos, puesto, puntos y racha de cada equipo.
 *
 * Uso:  node scripts/previa.js <salida.png>
 * Requiere Playwright con Chromium. No modifica el repo.
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
if (!OUT) { console.error('Uso: node scripts/previa.js <salida.png>'); process.exit(1); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  const info = await page.evaluate(() => {
    const next = rounds2627.find(r => r.pending);
    if (!next) return null;
    const table = standingsUpTo(played.length);
    const pos = Object.fromEntries(table.map((t, i) => [t.name, i + 1]));
    const st = Object.fromEntries(table.map(t => [t.name, t]));
    const leader = table[0];

    // Etiquetas automáticas (cada partido, como mucho una; por orden de prioridad)
    const sumPaid = m => PAID[m[0]].amt + PAID[m[3]].amt;
    const streak = t => { const f = st[t].form; let n = 0; for (let i = f.length - 1; i >= 0 && f[i] === f[f.length - 1]; i--) n++; return { r: f[f.length - 1], n }; };
    const tags = new Map();
    const free = () => next.matches.filter(m => !tags.has(m));
    // 1. Duelo de altura: los dos en el top 4
    free().filter(m => pos[m[0]] <= 4 && pos[m[3]] <= 4).forEach(m => tags.set(m, 'Duelo de altura'));
    // 2. Duelo directo: empatados a puntos
    free().filter(m => st[m[0]].pts === st[m[3]].pts).forEach(m => tags.set(m, 'Duelo directo'));
    // 3. Duelo del sótano: los dos en los tres últimos puestos
    free().filter(m => pos[m[0]] >= 14 && pos[m[3]] >= 14).forEach(m => tags.set(m, 'Duelo del sótano'));
    // 4. Racha contra racha: uno con 3+ victorias seguidas contra otro con 3+ derrotas seguidas
    free().filter(m => { const a = streak(m[0]), b = streak(m[3]); return a.n >= 3 && b.n >= 3 && a.r !== b.r; }).forEach(m => tags.set(m, 'Racha contra racha'));
    // 5. Duelo de pagadores: los que más han pagado entre los partidos que quedan
    if (free().length) { const r = free().reduce((b, m) => sumPaid(m) > sumPaid(b) ? m : b); if (sumPaid(r) >= 15) tags.set(r, 'Duelo de pagadores'); }
    // 6. En racha: algún equipo con 4+ resultados iguales seguidos
    free().forEach(m => { const a = streak(m[0]), b = streak(m[3]); const x = [a, b].find(s => s.n >= 4 && s.r !== 'D');
      if (x) tags.set(m, x.r === 'W' ? 'Racha de victorias' : 'Racha negra'); });
    const tag = m => tags.get(m) || '';

    const side = (t, right) => `
      <div class="pv-team ${right ? 'r' : ''}">
        ${crest(t, 62)}
        <div class="pv-tn"><b>${esc(t)}</b>
          <span class="pv-meta"><em>${pos[t]}º · ${st[t].pts} pts</em>
            <span class="pv-form">${st[t].form.slice(-5).map(f => `<i class="${f}"></i>`).join('')}</span></span></div>
      </div>`;

    document.body.innerHTML = `
    <div id="pv">
      <div class="glow"></div>
      <div class="pv-head">
        <div class="pv-brand"><div class="logo">${document.querySelector('.logo').innerHTML}</div>
          <div><b>LIGA CLUBES AMIGOS</b><small>TEMPORADA ${TEMPORADA}</small></div></div>
        <div class="pv-title">PREVIA <span>J${jorNum(next.j)}</span></div>
        <div class="pv-dates">${rangoFechas(next.j) || 'Próxima jornada'}</div>
      </div>
      <div class="pv-list">
        ${next.matches.map(m => `<div class="pv-m">${tag(m) ? `<div class="pv-tag">${tag(m)}</div>` : ''}${side(m[0], false)}<div class="pv-vs">VS</div>${side(m[3], true)}</div>`).join('')}
      </div>
      <div class="pv-foot">
        <div><small>LÍDER</small><b>${esc(leader.name)} · ${leader.pts} pts${leader.pe+leader.pp===0?` · pleno: ${leader.pg} de ${leader.pg}`:` (${leader.pg}V ${leader.pe}E ${leader.pp}D)`}</b>
          <div class="pv-leg">Racha, últimas 5: <i class="W"></i>victoria <i class="D"></i>empate <i class="L"></i>derrota</div></div>
        <div class="pv-url">liguilla-clubes-amigos.vercel.app</div>
      </div>
    </div>`;
    const css = document.createElement('style');
    css.textContent = `
      html,body{margin:0;padding:0;background:var(--bg)}
      #pv{position:relative;width:1080px;height:1350px;box-sizing:border-box;padding:56px 56px 48px;overflow:hidden;
        display:grid;grid-template-rows:auto 1fr auto;gap:30px;background:var(--bg);color:var(--ink);font-family:var(--font-body)}
      #pv .glow{position:absolute;width:1000px;height:1000px;border-radius:50%;top:-520px;right:-380px;background:radial-gradient(circle,rgba(245,200,66,.17),transparent 62%)}
      #pv::after{content:"";position:absolute;left:0;right:0;bottom:0;height:12px;background:var(--accent)}
      .pv-head{position:relative;display:grid;gap:10px}
      .pv-brand{display:flex;align-items:center;gap:14px}
      .pv-brand .logo{width:52px;height:52px;border-radius:13px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center}
      .pv-brand .logo svg{width:28px;height:28px}
      .pv-brand b{display:block;font-family:var(--font-display);font-size:30px;font-weight:800;letter-spacing:.02em;line-height:1}
      .pv-brand small{display:block;color:var(--muted);font-size:15px;letter-spacing:.14em;font-weight:600;margin-top:4px}
      .pv-title{font-family:var(--font-display);font-weight:800;font-size:112px;line-height:.9;margin-top:14px}
      .pv-title span{color:var(--accent)}
      .pv-dates{font-size:24px;font-weight:600;color:var(--muted)}
      .pv-dates::first-letter{text-transform:uppercase}
      .pv-list{position:relative;display:grid;gap:12px;align-content:center}
      .pv-m{position:relative;display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;gap:10px;
        background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 18px}
      .pv-tag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--accent);color:var(--accent-ink);
        font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:3px 12px;border-radius:999px;white-space:nowrap}
      .pv-team{display:flex;align-items:center;gap:14px;min-width:0}
      .pv-team.r{flex-direction:row-reverse;text-align:right}
      .pv-tn{min-width:0;display:grid;gap:5px}
      .pv-tn b{font-size:25px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pv-meta{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:17px;font-weight:600}
      .pv-team.r .pv-meta{flex-direction:row-reverse}
      .pv-meta em{font-style:normal}
      .pv-form{display:flex;gap:3px}
      .pv-form i{width:11px;height:11px;border-radius:3px}
      .pv-form .W{background:var(--win)} .pv-form .D{background:var(--draw)} .pv-form .L{background:var(--loss)}
      .pv-vs{text-align:center;font-family:var(--font-display);font-weight:800;font-size:26px;color:var(--muted)}
      .pv-foot{position:relative;display:flex;align-items:end;justify-content:space-between;gap:20px}
      .pv-foot small{display:block;color:var(--muted);font-size:14px;font-weight:700;letter-spacing:.14em;margin-bottom:4px}
      .pv-foot b{font-size:22px;font-weight:600}
      .pv-url{font-size:20px;font-weight:700;color:var(--accent)}
      .pv-leg{display:flex;align-items:center;gap:6px;margin-top:10px;color:var(--muted);font-size:15px;font-weight:600}
      .pv-leg i{width:11px;height:11px;border-radius:3px;margin-left:6px}
      .pv-leg .W{background:var(--win)} .pv-leg .D{background:var(--draw)} .pv-leg .L{background:var(--loss)}`;
    document.head.appendChild(css);
    return { j: next.j, tags: [...tags].map(([m, t]) => `${t}: ${m[0]} vs ${m[3]}`) };
  });
  if (!info) { console.error('No hay jornada pendiente'); process.exit(1); }
  await page.waitForTimeout(300);
  await page.locator('#pv').screenshot({ path: OUT });
  await browser.close();
  console.log(`✅ Previa ${info.j} → ${OUT}\n   ${info.tags.join('\n   ')}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
