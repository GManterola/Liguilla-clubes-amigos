#!/usr/bin/env node
/**
 * fetch-jornada.js
 * Llama a la API de Biwenger y extrae los puntos de la última jornada cerrada.
 * Uso: node fetch-jornada.js
 * Variables de entorno requeridas: BIWENGER_TOKEN, BIWENGER_LEAGUE, BIWENGER_USER
 */

const https = require('https');

const TOKEN  = process.env.BIWENGER_TOKEN;
const LEAGUE = process.env.BIWENGER_LEAGUE || '1699656';
const USER   = process.env.BIWENGER_USER   || '10477021';

if (!TOKEN) {
  console.error('❌ Falta BIWENGER_TOKEN. Exporta la variable antes de ejecutar.');
  process.exit(1);
}

function biwengerGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'biwenger.as.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-league':  LEAGUE,
        'x-user':    USER,
        'x-version': '632',
        'x-lang':    'es',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Obteniendo rondas de la liga...');

  // Endpoint que devuelve todas las rondas con puntos de los participantes
  const data = await biwengerGet(
    `/api/v2/leagues/${LEAGUE}/rounds?fields=*,participants(*,user(id,name),team(*))`
  );

  if (data.status !== 200 && data.status !== undefined) {
    console.error('❌ Error API:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  // Buscar la última ronda con resultados (scored = true o status = "played")
  const rounds = data.data || data;
  if (!Array.isArray(rounds)) {
    console.log('📄 Respuesta completa:', JSON.stringify(data, null, 2).slice(0, 1000));
    process.exit(0);
  }

  // Filtrar rondas jugadas
  const played = rounds.filter(r => r.status === 'played' || r.score > 0);
  if (!played.length) {
    console.log('⚠️  No hay rondas jugadas todavía.');
    console.log('Rondas disponibles:', rounds.slice(0, 3).map(r => ({id: r.id, status: r.status, name: r.name})));
    process.exit(0);
  }

  // La última jugada
  const lastRound = played[played.length - 1];
  console.log(`\n✅ Última jornada jugada: ${lastRound.name || lastRound.id}`);
  console.log('\n📊 Puntos por equipo:');

  const points = {};
  (lastRound.participants || []).forEach(p => {
    const name = p.user?.name || p.name || `User${p.id}`;
    const pts  = p.points ?? p.score ?? 0;
    points[name] = pts;
    console.log(`  ${name}: ${pts}`);
  });

  // Guardar resultado para que update-site.js lo consuma
  const fs = require('fs');
  const output = {
    jornada: lastRound.name || `J${lastRound.id}`,
    roundId: lastRound.id,
    points,
    fetchedAt: new Date().toISOString(),
  };
  fs.writeFileSync('jornada-data.json', JSON.stringify(output, null, 2));
  console.log('\n💾 Guardado en jornada-data.json');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
