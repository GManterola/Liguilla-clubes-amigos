#!/usr/bin/env node
/**
 * biwenger-fetch.js — Lee de Biwenger los datos de la liga y los guarda en
 * data/biwenger/ultima.json. Lo ejecuta GitHub Actions (.github/workflows/biwenger.yml)
 * con el secreto BIWENGER_TOKEN.
 *
 * IMPORTANTE: el repo y los registros de Actions son PÚBLICOS. Solo se guarda y se
 * imprime información de la liga (equipos, puntos, jornadas, fechas). Nada de la cuenta.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BIWENGER_TOKEN;
const LEAGUE = process.env.BIWENGER_LEAGUE || '1699656';
const USER = process.env.BIWENGER_USER || '10477021';
if (!TOKEN) { console.error('❌ Falta el secreto BIWENGER_TOKEN'); process.exit(1); }

function get(host, p, auth = true) {
  return new Promise((resolve) => {
    const headers = { 'Accept': 'application/json', 'x-lang': 'es', 'x-version': '632',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
    if (auth) Object.assign(headers, { 'Authorization': `Bearer ${TOKEN}`, 'x-league': LEAGUE, 'x-user': USER });
    https.get({ host, path: p, headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { let json = null; try { json = JSON.parse(d); } catch (_) {}
        resolve({ http: res.statusCode, json }); });
    }).on('error', e => resolve({ http: 0, error: e.message }));
  });
}

// Estructura sin valores (para adaptar el lector sin exponer datos)
function shape(v, depth = 0) {
  if (depth > 6) return '…';
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `×${v.length}`] : [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).slice(0, 40).map(k => [k, shape(v[k], depth + 1)]));
  return typeof v;
}

const pick = (o, keys) => o ? Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]])) : null;
const teamRow = s => pick(s, ['id', 'name', 'points', 'position', 'teamValue', 'roundPoints', 'lastPoints']);

(async () => {
  const out = { fetchedAt: new Date().toISOString(), league: LEAGUE, calls: {} };

  // 1. Jornada en curso de la liga (la que usaba el script antiguo)
  const r1 = await get('biwenger.as.com', '/api/v2/rounds/league');
  out.calls.roundsLeague = { http: r1.http, status: r1.json?.status, shape: shape(r1.json?.data) };
  const d1 = r1.json?.data;
  if (d1) {
    out.round = pick(d1.round, ['id', 'name', 'short', 'status', 'start', 'end']);
    const st = d1.league?.standings || d1.standings || [];
    out.roundStandings = st.map(teamRow);
  }

  // 2. Liga: clasificación y, si existen, enfrentamientos
  const r2 = await get('biwenger.as.com', `/api/v2/league/${LEAGUE}?fields=*,standings,group,settings`);
  out.calls.league = { http: r2.http, status: r2.json?.status, shape: shape(r2.json?.data) };
  const d2 = r2.json?.data;
  if (d2) {
    out.leagueInfo = pick(d2, ['id', 'name', 'type', 'mode', 'competition', 'scoreID']);
    out.leagueStandings = (d2.standings || []).map(teamRow);
  }

  // 3. Calendario de LaLiga (público)
  const r3 = await get('cf.biwenger.com', '/api/v2/competitions/la-liga/data?lang=es&score=5', false);
  out.calls.competition = { http: r3.http, status: r3.json?.status, shape: shape(r3.json?.data) };
  const season = r3.json?.data?.season;
  if (season) {
    out.season = pick(season, ['id', 'name']);
    out.calendar = (season.rounds || []).map(r => ({
      ...pick(r, ['id', 'name', 'short', 'status', 'start', 'end']),
      games: (r.games || []).map(g => ({ date: g.date, status: g.status,
        home: g.home?.name || g.home?.team?.name, away: g.away?.name || g.away?.team?.name,
        homeScore: g.home?.score, awayScore: g.away?.score })),
    }));
  }

  const dir = path.resolve(__dirname, '../data/biwenger');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ultima.json'), JSON.stringify(out, null, 2) + '\n');

  console.log(`rounds/league: HTTP ${r1.http} · league: HTTP ${r2.http} · calendario: HTTP ${r3.http}`);
  if (out.round) console.log(`Jornada en curso: ${out.round.name || out.round.id}`);
  if (out.roundStandings) console.log(`Equipos leídos: ${out.roundStandings.length}`);
  if (r1.http === 401 || r2.http === 401) { console.error('❌ Biwenger rechaza el token (401): hay que renovarlo'); process.exit(1); }
})();
