#!/usr/bin/env node
/**
 * biwenger-jornada.js — Lee data/biwenger/ultima.json (lo deja GitHub Actions) y
 * lo compara con data/temporada-2026-27.js. Solo lee; no modifica nada.
 *
 * Uso: node scripts/biwenger-jornada.js
 *
 * Equivalencia: nuestra jornada N = Jornada N+1 de LaLiga en Biwenger
 * (la liga empezó en la J2 de LaLiga). Las "(aplazada)" de Biwenger son partidos
 * sueltos de una jornada anterior: nuestra J(N-1) queda provisional mientras siga pendiente.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OFFSET = 1;
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/temporada-2026-27.js'), 'utf8') +
  ';this.D={TEAMS_2627,rounds2627,jorStatsHistory};', ctx);
const { TEAMS_2627: TEAMS, rounds2627: rounds, jorStatsHistory: hist } = ctx.D;
const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/biwenger/ultima.json'), 'utf8'));

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const BY = Object.fromEntries(TEAMS.map(t => [norm(t), t]));
const ourJ = short => 'J' + (parseInt(short.slice(1), 10) - OFFSET);
const fmt = t => new Date(t * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const iso = t => new Date(t * 1000).toISOString();

console.log(`Datos de Biwenger leídos el ${new Date(b.fetchedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}\n`);

const nextPending = rounds.find(r => r.pending);
const fechas = {};
for (const r of Object.values(b.rounds || {})) {
  if (!r.info || /aplazada/i.test(r.info.name)) continue;
  const j = ourJ(r.info.short);
  const games = (r.games || []).slice().sort((a, c) => a.date - c.date);
  const done = games.filter(g => g.status === 'finished').length;
  const span = games.length ? `${fmt(games[0].date)} → ${fmt(games[games.length - 1].date)}` : 'sin fechas';
  if (games.length) fechas[j] = { inicio: iso(games[0].date), fin: iso(games[games.length - 1].date) };
  const pts = r.standings.filter(s => s.roundPoints != null);
  const unknown = r.standings.filter(s => !BY[norm(s.name)]).map(s => s.name);
  const h = hist.find(x => x.j === j);

  let estado;
  if (!pts.length) estado = 'sin puntos todavía';
  else if (h) {
    const diffs = pts.filter(s => h.data[BY[norm(s.name)]] !== s.roundPoints).map(s => `${s.name}: Biwenger ${s.roundPoints} / web ${h.data[BY[norm(s.name)]]}`);
    estado = diffs.length ? `⚠️ DIFERENCIAS → ${diffs.join('; ')}` : `✅ ${pts.length}/16 coinciden con la web`;
  } else {
    estado = r.info.status === 'finished' && done === games.length ? '🟢 TERMINADA: lista para actualizar la web' : `🟡 en juego (${done}/${games.length} partidos terminados): puntos provisionales`;
  }
  console.log(`${j} (${r.info.name} de LaLiga) · ${span}\n   ${estado}`);
  if (unknown.length) console.log(`   ⚠️ Nombres que no están en la web: ${unknown.join(', ')}`);
  if (!h && pts.length) {
    const sorted = pts.map(s => [BY[norm(s.name)] || s.name, s.roundPoints]).sort((a, c) => c[1] - a[1]);
    console.log('   Puntos: ' + sorted.map(([t, p]) => `${t} ${p}`).join(' · '));
    if (nextPending && nextPending.j === j) {
      console.log('   Enfrentamientos (calendario de la web):');
      nextPending.matches.forEach(([hm, , , aw]) => {
        const x = pts.find(s => BY[norm(s.name)] === hm)?.roundPoints, y = pts.find(s => BY[norm(s.name)] === aw)?.roundPoints;
        console.log(`     ${hm} ${x ?? '?'} - ${y ?? '?'} ${aw}`);
      });
    }
  }
}

const ap = (b.calendar || []).filter(r => /aplazada/i.test(r.name) && r.status !== 'finished');
if (ap.length) console.log(`\nAplazadas pendientes: ${ap.map(r => `${r.name} de LaLiga (nuestra ${ourJ(r.short)})`).join(' · ')}`);
console.log(`\nFechas para data/ (fechas2627): ${JSON.stringify(fechas)}`);
