#!/usr/bin/env node
/**
 * validar.js — Comprueba que los datos de la temporada son coherentes.
 *
 * Uso:   node scripts/validar.js [data/temporada-2026-27.js]
 * Sale con código 1 si hay ERRORES (los AVISOS no bloquean).
 * Se ejecuta en GitHub Actions en cada push y PR (.github/workflows/validar.yml).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.argv[2] || path.join(ROOT, 'data/temporada-2026-27.js'));
const HTML = path.join(ROOT, 'index.html');

const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

// Escala de pagos acordada. NO se cambia durante la temporada.
const PAY_RULES_ESPERADAS = { 11: 1.0, 12: 1.0, 13: 1.5, 14: 1.5, 15: 2.0, 16: 2.5 };

// Excepciones conocidas: jornadas cuyo ranking no sigue el orden de puntos a propósito.
const RANKING_MANUAL = {
  J3: 'Tano Amunt penalizado manualmente al 16º por fichar mal el último día',
};

// ── 1. Sintaxis ───────────────────────────────────────────────────
const dataSrc = fs.readFileSync(DATA, 'utf8');
try { new vm.Script(dataSrc, { filename: DATA }); }
catch (e) { console.error(`❌ Error de sintaxis en ${path.relative(ROOT, DATA)}:\n${e.message}`); process.exit(1); }

const html = fs.readFileSync(HTML, 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
inline.forEach((code, i) => {
  try { new vm.Script(code, { filename: `index.html <script> #${i + 1}` }); }
  catch (e) { err(`Sintaxis en index.html (script inline #${i + 1}): ${e.message}`); }
});
if ((html.match(/<!doctype/gi) || []).length !== 1) err('index.html debe tener exactamente un <!DOCTYPE html> (¿se ha colado el envoltorio del artefacto?)');
if (!html.includes(`src="data/${path.basename(DATA)}"`)) warn(`index.html no carga data/${path.basename(DATA)}`);

// ── 2. Cargar datos ───────────────────────────────────────────────
const ctx = {};
vm.runInNewContext(dataSrc + `
;this.D = { TEMPORADA, TEAMS_2627, rounds2627, nextMatches2627, PAY_RULES_2627,
           jornadasRanking2627, jorStatsHistory, cronicas2627,
           fechas: typeof fechas2627 !== 'undefined' ? fechas2627 : {} };`, ctx);
const { TEAMS_2627: TEAMS, rounds2627: rounds, nextMatches2627: next, PAY_RULES_2627: pay,
        jornadasRanking2627: rankings, jorStatsHistory: history, cronicas2627: cronicas } = ctx.D;

const teamSet = new Set(TEAMS);
const sameSet = (arr, label) => {
  const missing = TEAMS.filter(t => !arr.includes(t));
  const unknown = arr.filter(t => !teamSet.has(t));
  const dupes = arr.filter((t, i) => arr.indexOf(t) !== i);
  if (missing.length) err(`${label}: faltan ${missing.join(', ')}`);
  if (unknown.length) err(`${label}: nombre desconocido ${unknown.map(t => `"${t}"`).join(', ')}`);
  if (dupes.length) err(`${label}: repetido ${[...new Set(dupes)].join(', ')}`);
};

// ── 3. Equipos ────────────────────────────────────────────────────
if (TEAMS.length !== 16) err(`TEAMS_2627 tiene ${TEAMS.length} equipos (deben ser 16)`);
if (teamSet.size !== TEAMS.length) err('TEAMS_2627 tiene nombres repetidos');

// ── 4. Escala de pagos ────────────────────────────────────────────
const payMap = Object.fromEntries(pay.map(r => [r.pos, r.amount]));
if (JSON.stringify(payMap) !== JSON.stringify(PAY_RULES_ESPERADAS))
  err(`PAY_RULES_2627 ha cambiado: ${JSON.stringify(payMap)} (esperado ${JSON.stringify(PAY_RULES_ESPERADAS)})`);

// ── 5. Jornadas (rounds2627) ─────────────────────────────────────
const jorNumOf = l => parseInt((/^J(\d+)/.exec(l) || [])[1], 10);
const isNum = v => /^-?\d+$/.test(String(v));
let seenPending = false;
const played = [];
rounds.forEach((r, idx) => {
  const label = r.j;
  const num = parseInt((/^J(\d+)/.exec(label) || [])[1], 10);
  if (num !== idx + 1) err(`rounds2627[${idx}] se llama "${label}" (se esperaba J${idx + 1})`);
  if (r.matches.length !== 8) err(`${label}: ${r.matches.length} partidos (deben ser 8)`);
  sameSet(r.matches.flatMap(([h, , , a]) => [h, a]), `${label} (enfrentamientos)`);
  if (r.pending) {
    seenPending = true;
    if (r.partialPending) err(`${label}: no puede ser pending y partialPending a la vez`);
    r.matches.forEach(([h, hs, as_, a]) => { if (hs !== '' || as_ !== '') err(`${label}: ${h}-${a} tiene marcador pero la jornada está pendiente`); });
  } else {
    if (seenPending) err(`${label} está disputada pero hay una jornada anterior pendiente`);
    r.matches.forEach(([h, hs, as_, a]) => { if (!isNum(hs) || !isNum(as_)) err(`${label}: marcador no numérico en ${h} "${hs}"-"${as_}" ${a}`); });
    if (r.partialPending && !(r.pendingMatches >= 1)) warn(`${label}: partialPending sin pendingMatches (se mostrará "1 partido")`);
    played.push(r);
  }
});

// ── 6. Próxima jornada ───────────────────────────────────────────
const firstPending = rounds.find(r => r.pending);
if (firstPending) {
  const exp = firstPending.matches.map(([h, , , a]) => `${h} vs ${a}`).join(' | ');
  const got = next.map(([h, a]) => `${h} vs ${a}`).join(' | ');
  if (exp !== got) err(`nextMatches2627 no coincide con ${firstPending.j}:\n     esperado: ${exp}\n     actual:   ${got}`);
} else if (next.length) warn('No quedan jornadas pendientes pero nextMatches2627 no está vacío');

// ── 7. Rankings, puntos y pagos por jornada ─────────────────────
const labels = arr => arr.map(x => x.j).join(',');
if (labels(rankings) !== labels(played)) err(`jornadasRanking2627 (${labels(rankings)}) no coincide con las jornadas disputadas (${labels(played)})`);
if (labels(history) !== labels(played)) err(`jorStatsHistory (${labels(history)}) no coincide con las jornadas disputadas (${labels(played)})`);

played.forEach(r => {
  const rk = rankings.find(x => x.j === r.j);
  const hs = history.find(x => x.j === r.j);
  if (!rk || !hs) return;
  sameSet(rk.ranking, `${r.j} (jornadasRanking2627)`);
  sameSet(Object.keys(hs.data), `${r.j} (jorStatsHistory)`);
  if (!!r.partialPending !== !!rk.partialPending || !!r.partialPending !== !!hs.partialPending)
    warn(`${r.j}: la marca partialPending no es la misma en rounds2627, jornadasRanking2627 y jorStatsHistory`);

  // Puntos de jorStatsHistory = marcadores de los partidos
  r.matches.forEach(([h, hsc, asc, a]) => {
    [[h, hsc], [a, asc]].forEach(([t, sc]) => {
      if (hs.data[t] !== undefined && hs.data[t] !== parseInt(sc, 10))
        err(`${r.j}: ${t} tiene ${hs.data[t]} en jorStatsHistory pero ${sc} en el partido`);
    });
  });

  // Ranking ordenado por puntos (los empates pueden ir en cualquier orden)
  const bad = [];
  for (let i = 1; i < rk.ranking.length; i++) {
    const p0 = hs.data[rk.ranking[i - 1]], p1 = hs.data[rk.ranking[i]];
    if (p1 > p0) bad.push(`${rk.ranking[i - 1]} (${p0}) por delante de ${rk.ranking[i]} (${p1})`);
  }
  if (bad.length) {
    if (RANKING_MANUAL[r.j]) warn(`${r.j}: ranking manual — ${RANKING_MANUAL[r.j]}`);
    else err(`${r.j}: ranking no sigue los puntos: ${bad.join('; ')}`);
  }

  // Empates de puntos en la frontera de pago (10º/11º)
  const p10 = hs.data[rk.ranking[9]], p11 = hs.data[rk.ranking[10]];
  if (p10 === p11) warn(`${r.j}: empate a ${p10} entre ${rk.ranking[9]} (10º, no paga) y ${rk.ranking[10]} (11º, paga) — revisa el desempate`);
});

// ── 8. Clasificación: V/E/D y puntos ─────────────────────────────
const st = Object.fromEntries(TEAMS.map(t => [t, { pg: 0, pe: 0, pp: 0, pts: 0 }]));
played.forEach(r => r.matches.forEach(([h, hs, as_, a]) => {
  if (!st[h] || !st[a]) return; // nombre desconocido: ya reportado arriba
  const x = +hs, y = +as_;
  if (x > y) { st[h].pg++; st[h].pts += 3; st[a].pp++; }
  else if (x < y) { st[a].pg++; st[a].pts += 3; st[h].pp++; }
  else { st[h].pe++; st[a].pe++; st[h].pts++; st[a].pts++; }
}));
const tot = Object.values(st).reduce((s, t) => ({ pg: s.pg + t.pg, pe: s.pe + t.pe, pp: s.pp + t.pp }), { pg: 0, pe: 0, pp: 0 });
TEAMS.forEach(t => {
  const s = st[t];
  if (s.pg + s.pe + s.pp !== played.length) err(`${t}: ${s.pg + s.pe + s.pp} partidos jugados (deberían ser ${played.length})`);
});
if (tot.pg !== tot.pp) err(`Victorias totales (${tot.pg}) ≠ derrotas totales (${tot.pp})`);
if (tot.pg + tot.pe / 2 !== played.length * 8) err('El total de partidos no cuadra con las jornadas disputadas');

// ── 8b. Fechas de jornadas (opcional)
Object.entries(ctx.D.fechas).forEach(([j, f]) => {
  if (!rounds.some(r => jorNumOf(r.j) === jorNumOf(j))) err(`fechas2627: ${j} no existe en rounds2627`);
  if (isNaN(Date.parse(f.inicio)) || isNaN(Date.parse(f.fin)) || Date.parse(f.fin) < Date.parse(f.inicio)) err(`fechas2627: fechas no válidas en ${j}`);
});

// ── 9. Crónicas ───────────────────────────────────────────────────
if (!cronicas.length) warn('No hay crónicas');
else {
  const lastPlayed = played[played.length - 1];
  if (lastPlayed && cronicas[0].j !== lastPlayed.j) warn(`La crónica principal es de ${cronicas[0].j}, pero la última jornada disputada es ${lastPlayed.j}`);
  const cl = cronicas.map(c => c.j);
  if (new Set(cl).size !== cl.length) err('Hay crónicas repetidas para la misma jornada');
  cronicas.forEach(c => { if (!c.titular || !c.parrafos?.length) err(`Crónica ${c.j}: falta titular o párrafos`); });
}

// ── Resumen ───────────────────────────────────────────────────────
const order = TEAMS.slice().sort((a, b) => st[b].pts - st[a].pts);
console.log(`Temporada ${ctx.D.TEMPORADA} · ${played.length} jornadas disputadas · próxima: ${firstPending ? firstPending.j : '—'}`);
console.log(`Líder: ${order[0]} (${st[order[0]].pts} pts) · V/E/D totales: ${tot.pg}/${tot.pe}/${tot.pp}`);
const lastRk = rankings[rankings.length - 1];
if (lastRk) console.log(`Pagan ${lastRk.j}: ` + lastRk.ranking.slice(10).map((t, i) => `${t} ${PAY_RULES_ESPERADAS[11 + i].toFixed(2)}€`).join(', '));
warnings.forEach(w => console.log(`⚠️  ${w}`));
errors.forEach(e => console.log(`❌ ${e}`));
console.log(errors.length ? `\n${errors.length} error(es).` : '\n✅ Datos correctos.');
process.exit(errors.length ? 1 : 0);
