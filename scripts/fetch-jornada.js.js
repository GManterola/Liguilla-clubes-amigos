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
        'x-league':  LEAGUE,
        'x-user':    USER,
        'x-version': '632',
        'x-lang':    'es',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://biwenger.as.com/round',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Obteniendo rondas de la liga...');

  const data = await biwengerGet('/api/v2/rounds/league');
  console.log('📄 Respuesta:', JSON.stringify(data, null, 2).slice(0, 500));

  const rounds = data.data || data;
  if (!Array.isArray(rounds)) {
    console.error('❌ Respuesta inesperada');
    process.exit(1);
  }

  const played = rounds.filter(r => r.status === 'played' || r.score > 0);
  if (!played.length) {
    console.log('⚠️  No hay rondas jugadas todavía.');
    process.exit(0);
  }

  const lastRound = played[played.length - 1];
  console.log(`\n✅ Última jornada: ${lastRound.name || lastRound.id}`);

  const points = {};
  (lastRound.participants || []).forEach(p => {
    const name = p.user?.name || p.name || `User${p.id}`;
    const pts  = p.points ?? p.score ?? 0;
    points[name] = pts;
    console.log(`  ${name}: ${pts}`);
  });

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
