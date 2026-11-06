#!/usr/bin/env node
/**
 * update-site.js
 * Lee jornada-data.json (generado por fetch-jornada.js) y actualiza index.html.
 * También llama a la API de Claude para generar la crónica.
 *
 * Uso: node update-site.js [--dry-run]
 * Variables de entorno: ANTHROPIC_API_KEY
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────
const HTML_PATH     = path.resolve(__dirname, '../../outputs/index.html');
const DATA_PATH     = path.resolve(__dirname, 'jornada-data.json');
const DRY_RUN       = process.argv.includes('--dry-run');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractBlock(html, varName) {
  // Extrae el contenido de una variable JS del HTML (array/object multilínea)
  const start = html.indexOf(`const ${varName}`);
  if (start === -1) throw new Error(`No se encontró: const ${varName}`);
  // Encuentra el primer [ o {
  const openIdx = html.indexOf('[', start);
  let depth = 0, i = openIdx;
  for (; i < html.length; i++) {
    if (html[i] === '[' || html[i] === '{') depth++;
    else if (html[i] === ']' || html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return { raw: html.slice(openIdx, i + 1), start: openIdx, end: i + 1 };
}

function jsEval(code) {
  // Evalúa un literal JS de forma segura (solo arrays/objects con datos primitivos)
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${code})`)();
}

function claudeRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          resolve(r.content?.[0]?.text || '');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Leer datos de la jornada
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ No se encontró ${DATA_PATH}. Ejecuta primero fetch-jornada.js`);
    process.exit(1);
  }
  const jornadaData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const { jornada, points } = jornadaData;
  console.log(`\n📋 Procesando ${jornada}...`);
  console.log('Puntos recibidos:', points);

  // 2. Leer HTML
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  // 3. Extraer rounds2627 y encontrar la jornada a actualizar
  const roundsBlock = extractBlock(html, 'rounds2627');
  const rounds = jsEval(roundsBlock.raw);

  const roundIdx = rounds.findIndex(r => r.j === jornada);
  if (roundIdx === -1) {
    console.error(`❌ No se encontró ${jornada} en rounds2627`);
    console.log('Jornadas disponibles:', rounds.map(r => r.j).join(', '));
    process.exit(1);
  }

  const round = rounds[roundIdx];
  if (!round.pending) {
    console.log(`⚠️  ${jornada} ya está marcada como jugada. Nada que actualizar.`);
    process.exit(0);
  }

  // 4. Rellenar marcadores con los puntos de la jornada
  round.matches = round.matches.map(([home, , , away]) => {
    const hPts = points[home] ?? null;
    const aPts = points[away] ?? null;
    if (hPts === null || aPts === null) {
      const missing = hPts === null ? home : away;
      console.warn(`⚠️  No se encontró puntuación para: ${missing}`);
    }
    return [home, String(hPts ?? ''), String(aPts ?? ''), away];
  });
  delete round.pending;
  console.log(`\n✅ Partidos de ${jornada}:`);
  round.matches.forEach(([h, hs, as_, a]) => console.log(`  ${h} ${hs}–${as_} ${a}`));

  // 5. Calcular ranking de la jornada (ordenar por puntos desc)
  const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]).map(([name]) => name);
  console.log('\n📊 Ranking semanal:', sorted.join(', '));

  // 6. Pagos (pagan puestos 11-16)
  const PAY_RULES = [
    {pos:11,amount:1.00},{pos:12,amount:1.00},
    {pos:13,amount:1.50},{pos:14,amount:1.50},
    {pos:15,amount:2.00},{pos:16,amount:2.50},
  ];
  console.log('\n💸 Pagadores:');
  sorted.slice(10).forEach((team, i) => {
    console.log(`  ${i+11}º ${team}: ${PAY_RULES[i].amount.toFixed(2)}€`);
  });

  // 7. Actualizar rounds2627 en el HTML
  const newRoundsJson = JSON.stringify(rounds, null, 2)
    .replace(/"matches": \[/g, 'matches:[')   // estilo compacto similar al original
    .replace(/]/g, ']');

  // Reemplazar el bloque directamente con una representación limpia
  const roundsStr = rounds.map(r => {
    const flags = [
      r.pending       ? 'pending:true' : null,
      r.partialPending ? 'partialPending:true' : null,
    ].filter(Boolean);
    const flagStr = flags.length ? flags.join(', ') + ', ' : '';
    const matchesStr = r.matches.map(m => `    ${JSON.stringify(m)}`).join(',\n');
    return `  { j:${JSON.stringify(r.j)}, ${flagStr}matches:[\n${matchesStr},\n  ]}`;
  }).join(',\n');

  html = html.slice(0, roundsBlock.start - 1) +
    `[\n${roundsStr},\n]` +
    html.slice(roundsBlock.end);

  // 8. Actualizar jornadasRanking2627
  const rankBlock = extractBlock(html, 'jornadasRanking2627');
  const rankings  = jsEval(rankBlock.raw);
  const rankIdx   = rankings.findIndex(r => r.j === jornada);
  const newEntry  = { j: jornada, ranking: sorted };
  if (rankIdx === -1) rankings.push(newEntry);
  else rankings[rankIdx] = newEntry;

  const rankStr = rankings.map(r => {
    const flags = r.partialPending ? 'partialPending:true, ' : '';
    const top10 = r.ranking.slice(0,10).join('","');
    const bot6  = r.ranking.slice(10).join('","');
    return `  { j:${JSON.stringify(r.j)}, ${flags}ranking:[\n    "${top10}",\n    "${bot6}",\n  ]}`;
  }).join(',\n');

  html = html.slice(0, rankBlock.start - 1) +
    `[\n${rankStr},\n]` +
    html.slice(rankBlock.end);

  // 9. Actualizar jorStatsHistory
  const statsBlock = extractBlock(html, 'jorStatsHistory');
  const stats      = jsEval(statsBlock.raw);
  const statsIdx   = stats.findIndex(s => s.j === jornada);
  const statsEntry = { j: jornada, data: points };
  if (statsIdx === -1) stats.push(statsEntry);
  else stats[statsIdx] = statsEntry;

  const statsStr = stats.map(s => {
    const flags = s.partialPending ? 'partialPending:true, ' : '';
    const dataEntries = Object.entries(s.data)
      .map(([k, v]) => `    ${JSON.stringify(k)}:${v}`)
      .join(',\n');
    return `  { j:${JSON.stringify(s.j)}, ${flags}data:{\n${dataEntries},\n  }}`;
  }).join(',\n');

  html = html.slice(0, statsBlock.start - 1) +
    `[\n${statsStr},\n]` +
    html.slice(statsBlock.end);

  // 10. Actualizar header badge
  const jNum = jornada.match(/\d+/)?.[0] || jornada;
  html = html.replace(
    /(<div class="header-badge">)[^<]*/,
    `$1J${jNum} disputada`
  );

  // 11. Actualizar nextMatches2627 y sección Próxima
  // Encontrar la siguiente jornada pendiente
  const roundsUpdated = jsEval(extractBlock(html, 'rounds2627').raw);
  const nextRound = roundsUpdated.find(r => r.pending);
  if (nextRound) {
    const nextNum = nextRound.j.match(/\d+/)?.[0];
    // Actualizar nextMatches
    const nextMatchesBlock = extractBlock(html, 'nextMatches2627');
    const newNextMatches = nextRound.matches.map(([h,,, a]) => [h, a]);
    const nextMatchesStr = newNextMatches.map(pair => `  ${JSON.stringify(pair)}`).join(',\n');
    html = html.slice(0, nextMatchesBlock.start - 1) +
      `[\n${nextMatchesStr},\n]` +
      html.slice(nextMatchesBlock.end);

    // Actualizar subtítulo y card de próxima
    html = html.replace(
      /(<div class="section-sub" id="next-sub">)[^<]*/,
      `$1Jornada ${nextNum} · Pendiente`
    );
    html = html.replace(
      /(<span class="card-title">⏳ Jornada )\d+(.*?Pendiente<\/span>)/,
      `$1${nextNum}$2`
    );
    console.log(`\n⏭  Próxima: ${nextRound.j}`);
  }

  // 12. Generar crónica con Claude API
  let cronica = '';
  if (ANTHROPIC_KEY) {
    console.log('\n✍️  Generando crónica con Claude...');
    const payerLines = sorted.slice(10).map((t, i) =>
      `${i+11}º ${t}: ${PAY_RULES[i].amount.toFixed(2)}€`
    ).join(', ');
    const matchLines = round.matches.map(([h, hs, as_, a]) =>
      `${h} ${hs}–${as_} ${a}`
    ).join('\n');

    const prompt = `Eres el cronista de la Liga Clubes Amigos, una liga fantasy de fútbol entre amigos.
Escribe la crónica de ${jornada} en HTML (solo el contenido interior, sin etiquetas html/body).

Resultados:
${matchLines}

Ranking semanal (1º al 16º):
${sorted.map((t,i) => `${i+1}º ${t}: ${points[t]} pts`).join('\n')}

Pagadores: ${payerLines}

Instrucciones:
- Tono irónico, futbolero y gamberro
- Running jokes: el histórico -1 de Se vende Cuenta (si es relevante), Vicentine Zidane gestiona "dos equipos en la sombra" (también gestiona Sors)
- Titular llamativo con <strong style="color:var(--gold)">TITULAR</strong>
- 3-5 párrafos con <p> etiquetas
- Último párrafo siempre: "En pagos: [lista de pagadores con importe]"
- Sin markdown, solo HTML con etiquetas <p> y <strong>`;

    try {
      cronica = await claudeRequest(prompt);
      console.log('✅ Crónica generada');
    } catch (e) {
      console.warn('⚠️  No se pudo generar crónica:', e.message);
      cronica = `<p><strong style="color:var(--gold)">${jornada.toUpperCase()} · CRÓNICA PENDIENTE</strong></p>
<p>Resultados introducidos automáticamente. Crónica pendiente de redacción.</p>
<p>En pagos: ${payerLines}.</p>`;
    }
  } else {
    console.warn('⚠️  ANTHROPIC_API_KEY no definida, crónica genérica');
    cronica = `<p><strong style="color:var(--gold)">${jornada.toUpperCase()} · RESULTADOS ACTUALIZADOS</strong></p>
<p>Jornada actualizada automáticamente desde Biwenger.</p>`;
  }

  // Insertar crónica: nueva jornada como principal, anterior va al archivo
  const cronicaMainRe = /(<div class="cronica-main">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/;
  const cronicaArchiveRe = /(<div class="archive-title">📚 Archivo<\/div>)/;

  const oldMainMatch = html.match(cronicaMainRe);
  if (oldMainMatch) {
    // Convertir la main anterior en un item de archivo
    const oldMainHtml = oldMainMatch[1];
    // Extraer título de la crónica anterior
    const oldTitleMatch = oldMainHtml.match(/cronica-main-title">([^<]+)</);
    const oldTitle = oldTitleMatch ? oldTitleMatch[1].trim() : 'Jornada anterior';

    // Extraer el body de la crónica anterior
    const oldBodyMatch = oldMainHtml.match(/cronica-main-body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    const oldBody = oldBodyMatch ? oldBodyMatch[1].trim() : '';

    const newArchiveItem = `  <div class="cronica-item" onclick="this.classList.toggle('open')">
    <div class="cronica-item-header">
      <span class="cronica-item-label">${oldTitle}</span>
      <span class="cronica-item-toggle">▼</span>
    </div>
    <div class="cronica-item-body">
      ${oldBody}
    </div>
  </div>`;

    const newMain = `<div class="cronica-main">
    <div class="cronica-main-header">
      <div class="cronica-main-title">📰 ${jornada} · Temporada 2026-27</div>
    </div>
    <div class="cronica-main-body">
      ${cronica}
    </div>
  </div>`;

    html = html.replace(cronicaMainRe, newMain);
    html = html.replace(cronicaArchiveRe, `$1\n  ${newArchiveItem}`);
  }

  // 13. Guardar o mostrar
  if (DRY_RUN) {
    fs.writeFileSync('index-preview.html', html);
    console.log('\n🔍 DRY RUN: guardado en index-preview.html (no se modifica el original)');
  } else {
    fs.writeFileSync(HTML_PATH, html);
    console.log(`\n✅ index.html actualizado correctamente`);
  }

  console.log('\n📌 Resumen:');
  console.log(`  Jornada: ${jornada}`);
  console.log(`  Ganador semanal: ${sorted[0]} (${points[sorted[0]]} pts)`);
  console.log(`  Paga más: ${sorted[15]} (${PAY_RULES[5].amount.toFixed(2)}€)`);
  console.log(`  Próxima: ${nextRound?.j || 'pendiente'}`);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
