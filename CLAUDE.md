# Liga Clubes Amigos — instrucciones del proyecto

Web estática de una liga fantasy de 16 equipos (temporada 2026-27).
Producción: https://liguilla-clubes-amigos.vercel.app — Vercel despliega solo cada push a `main`.
Copia de trabajo: artefacto "Liga Clubes Amigos 26-27" → https://claude.ai/artifact/6VYUukdk2BaqxYsYmbc4FG

## Estructura

| Archivo | Qué es | ¿Se toca cada jornada? |
|---|---|---|
| `data/temporada-2026-27.js` | Todos los datos: equipos, jornadas, rankings, puntos, próxima jornada, escala de pagos y crónicas | **Sí, solo este** |
| `index.html` | Diseño y lógica (pestañas Inicio, Tabla, Jornadas, Crónica, Pagos, Equipos y ficha `#equipo-<nombre>`). Todo se calcula a partir de los datos: portada, premios, rachas, pagos. Los escudos se configuran en `CRESTS` (equipo nuevo sin entrada → escudo automático) | No |
| `scripts/validar.js` | Validación de coherencia de los datos (también corre en GitHub Actions) | No |
| `img/`, `manifest.webmanifest` | Iconos y app instalable. `img/og.png` (vista previa de WhatsApp) se regenera cada jornada con `scripts/og.js` | `og.png`, sí |
| `scripts/biwenger-fetch.js`, `.github/workflows/biwenger.yml` | Lee Biwenger desde GitHub Actions (secreto `BIWENGER_TOKEN`) y guarda `data/biwenger/ultima.json`. Se lanza modificando `.github/biwenger-trigger` | No |
| `scripts/biwenger-jornada.js` | Compara Biwenger con la web y da puntos y fechas de la jornada (solo lectura) | No |
| `vercel.json` | Rutas limpias: `/pagos`, `/equipo-sors`… sirven `index.html` | No |

## Actualizar una jornada

**Fuente principal: Biwenger** (sin capturas). Equivalencia: **nuestra JN = Jornada N+1 de LaLiga**. Las "(aplazada)" de Biwenger son partidos sueltos de una jornada anterior.
1. `date -u +%FT%TZ > .github/biwenger-trigger`, commit y push → espera a que termine el workflow "📡 Leer Biwenger" (`gh run list --workflow biwenger.yml`) → `git pull`.
2. `node scripts/biwenger-jornada.js` → si la jornada sale "🟢 TERMINADA", usa esos puntos. Si sale "en juego", no la publiques como cerrada.
3. Actualiza `fechas2627` con las fechas que imprime el script.
4. Si Biwenger falla (token caducado: HTTP 401), pide al usuario que renueve el secreto `BIWENGER_TOKEN` en GitHub o que mande captura.

**Alternativa: captura** del usuario con la columna "Jor.".

Usa el skill `actualizar-jornada-liga` (`.claude/skills/actualizar-jornada-liga/SKILL.md`). Reglas fijas del dueño de la liga:

- Si un nombre o número de la captura no se lee con claridad, **pregunta; no supongas**.
- Actualiza siempre los cuatro arrays: `rounds2627`, `jornadasRanking2627`, `jorStatsHistory` y `nextMatches2627`, y añade la crónica en `cronicas2627`.
- Pagos: pagan los 6 últimos de la jornada con `PAY_RULES_2627` (11º 1,00 · 12º 1,00 · 13º 1,50 · 14º 1,50 · 15º 2,00 · 16º 2,50 €). **No se cambia.**
- Si falta algún partido por disputar, la jornada queda con `partialPending:true` y `pendingMatches:N` (aviso ámbar visible). Nunca se oculta.
- Crónica nueva al principio de `cronicas2627` (historia principal); la anterior pasa sola al archivo desplegable.
- Tono irónico, futbolero y gamberro. Running jokes obligatorios: el **-1 histórico de Se vende Cuenta** (J6, antes "Paco Buyo") y **Vicentine Zidane gestionando a Sors en la sombra**.
- Antes de entregar: `node scripts/validar.js` debe terminar en ✅ y V/E/D/puntos deben cuadrar con la jornada anterior.
- Publicar en los dos sitios: push a `main` (Vercel) y el artefacto (misma URL, con `files`).

## Publicar

1. `node scripts/validar.js` → ✅
1b. `node scripts/og.js` → regenera `img/og.png` y las etiquetas `og:` de `index.html` con la jornada nueva
2. Commit y `git push origin main` → Vercel despliega en ~1 min. GitHub Actions vuelve a validar.
3. Artefacto: `node scripts/build-artifact.js <scratchpad>/build/index.html` (incrusta los datos) y publicar ese archivo con `url` del artefacto (misma URL). `img/*` y `manifest.webmanifest` ya están publicados.
4. Recordar al usuario: recarga forzada (Cmd/Ctrl+Shift+R) para ver los cambios.

**Nunca** subas a GitHub un `index.html` descargado del artefacto: lleva un envoltorio extra (doble `<!doctype>`). La fuente de verdad es este repo. `validar.js` lo detecta.

## Entrega al usuario

Resumen breve: ganador de la jornada, cambios en la clasificación, quién paga y cuánto. Respuestas directas, en español.

## Nueva temporada

Copiar `data/temporada-2026-27.js` a `data/temporada-2027-28.js`, vaciar resultados/rankings/crónicas, actualizar equipos y calendario, y cambiar el `<script src>` de `index.html`. La temporada anterior queda como archivo.
