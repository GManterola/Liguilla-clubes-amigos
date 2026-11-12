# Liga Clubes Amigos

Web de la liga fantasy Liga Clubes Amigos (16 equipos, temporada 2026-27).

**Web:** https://liguilla-clubes-amigos.vercel.app

## Estructura

```
index.html                    diseño y lógica (no se toca cada jornada)
data/temporada-2026-27.js     datos de la temporada: resultados, rankings, pagos, crónicas
scripts/validar.js            comprobación de coherencia de los datos
img/, manifest.webmanifest    iconos, imagen para compartir, app instalable
```

## Actualizar una jornada

1. Editar `data/temporada-2026-27.js` (ver `CLAUDE.md` y `.claude/skills/actualizar-jornada-liga/SKILL.md`).
2. `node scripts/validar.js`
3. Push a `main` → Vercel publica solo. GitHub Actions valida cada push.

Para ver la web en local basta con abrir `index.html` en el navegador.
