---
name: "actualizar-jornada-liga"
description: "Actualiza la web de la Liga Clubes Amigos con una nueva jornada a partir de capturas de puntos: resultados, clasificación, pagos, próxima jornada y crónica. Edita data/temporada-2026-27.js, valida, hace push a main y republica el artefacto."
---

# Actualizar jornada – Liga Clubes Amigos

Los datos viven en `data/temporada-2026-27.js`. `index.html` no se toca para una jornada normal.

## Entrada
- Captura(s) con los puntos de la jornada (columna "Jor.").
- Si el usuario indica una corrección de una jornada anterior, aplícala antes de añadir la nueva.

## Pasos
1. **Leer la captura.** Si algún nombre o número no se lee con claridad, pregunta en lugar de suponer. Los nombres deben coincidir exactamente con `TEAMS_2627`.
2. **`rounds2627`**: en la jornada siguiente pendiente, rellena los marcadores (strings, p. ej. `"43"`) con los emparejamientos ya cargados y quita `pending:true`.
   - Si falta algún partido por disputar: `partialPending:true, pendingMatches:N` (también en las entradas de esa jornada en `jornadasRanking2627` y `jorStatsHistory`). El aviso ámbar sale solo.
3. **`jorStatsHistory`**: añade `{ j:"Jxx", data:{ equipo:puntos, ... } }` con los 16 equipos, ordenados de más a menos puntos.
4. **`jornadasRanking2627`**: añade `{ j:"Jxx", ranking:[...] }` con los 16 equipos de 1º a 16º según los puntos de la jornada. Si hay empate en la frontera 10º/11º (zona de pago), pregunta al usuario el desempate.
5. **`nextMatches2627`**: copia los emparejamientos de la siguiente jornada con `pending:true` en `rounds2627`.
6. **Pagos**: los calcula la web con `PAY_RULES_2627` (11º 1,00 · 12º 1,00 · 13º 1,50 · 14º 1,50 · 15º 2,00 · 16º 2,50 €). No cambies la escala.
7. **Crónica**: añade un objeto al PRINCIPIO de `cronicas2627`: `{ j:"Jxx", titular:"...", parrafos:["...", ...] }`. La anterior pasa sola al archivo.
   - Tono irónico, futbolero y gamberro.
   - Running jokes: el histórico -1 de Se vende Cuenta (J6), la gestión "en la sombra" de Vicentine Zidane con Sors.
   - El titular refleja la historia más llamativa de la semana; si dudas entre dos enfoques, elige uno y menciona la alternativa al usuario.
   - Último párrafo: "En pagos: Equipo (16º, 2,50€), ... y Equipo (11º, 1,00€)."
   - Los párrafos admiten `<strong>` y `<em>`.

## Verificación antes de entregar
- `node scripts/validar.js` → debe acabar en `✅ Datos correctos.` (comprueba sintaxis, nombres, 8 partidos y 16 equipos por jornada, que los puntos coinciden con los marcadores, el orden del ranking, `nextMatches2627`, la escala de pagos y que V/E/D cuadran).
- Compara la clasificación con la de la jornada anterior: cada equipo +1 PJ, y PTS sube 3/1/0 según su resultado.
- Opcional: abrir `index.html` con Playwright y comprobar que no hay errores de consola.

## Publicar
0. `node scripts/og.js` → regenera la imagen de WhatsApp (`img/og.png`) y el texto `og:description` con el rey, el farolillo y el líder de la jornada. Revisa la imagen antes del commit.
1. Commit (`Jxx: resultados, clasificación, pagos y crónica`) y `git push origin main` → Vercel despliega solo.
2. Artefacto (misma URL https://claude.ai/artifact/6VYUukdk2BaqxYsYmbc4FG): `node scripts/build-artifact.js <scratchpad>/build/index.html` y publica ese archivo pasando `url` del artefacto. El build incrusta los datos; los iconos ya están publicados.

## Entrega
- Resumen breve: ganador de la jornada, cambios en la clasificación, quién paga y cuánto.
- Recuerda al usuario la recarga forzada (Cmd/Ctrl+Shift+R) para ver los cambios en Vercel.
