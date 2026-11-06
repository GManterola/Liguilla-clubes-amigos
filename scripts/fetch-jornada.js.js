#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

const TOKEN  = process.env.BIWENGER_TOKEN;
const LEAGUE = process.env.BIWENGER_LEAGUE || '1699656';
const USER   = process.env.BIWENGER_USER   || '10477021';

if (!TOKEN) {
  console.error('❌ Falta BIWENGER_TOKEN.');
  process.exit(1);
}

function biwengerGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'biwenger.as.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'x-league': LEAGUE,
        'x-user': USER,
        'x-version': '632',
        'x-lang': 'es',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://biwenger.as.com/round',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Parse error: ' + data.slice(0, 300)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Obteniendo ronda actual...');
  const data = await biwengerGet('/api/v2/rounds/league');

  if (data.status !== 200) {
    console.error('❌ Error API:', JSON.stringify(data));
    process.exit(1);
  }

  const round = data.data && data.data.round;
  const standings = data.data && data.data.league && data.data.league.standings;

  if (!round || !standings) {
    console.error('❌ Estructura inesperada:', JSON.stringify(data.data).slice(0, 500));
    process.exit(1);
  }

  const roundName = 'J' + round.id;
  console.log('✅ Ronda: ' + roundName);
  console.log('📊 Puntos por equipo:');

  const points = {};
  standings.forEach(function(p) {
    const name = p.name;
    const pts = p.points || 0;
    points[name] = pts;
    console.log('  ' + name + ': ' + pts);
  });

  const output = {
    jornada: roundName,
    roundId: round.id,
    points: points,
    fetchedAt: new Date().toISOString()
  };

  fs.writeFileSync('jornada-data.json', JSON.stringify(output, null, 2));
  console.log('💾 Guardado en jornada-data.json');
}

main().catch(function(err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
