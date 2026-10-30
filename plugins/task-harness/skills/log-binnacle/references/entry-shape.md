# Forma de una entrada de la bitácora

La entrada que log-binnacle inserta bajo el marcador `## Entradas`. El orden interno es fijo:
primero lo caro de reconstruir (estado, decisiones, desviaciones), al final los punteros baratos.

```markdown
## [S1] <fecha ISO> — alcance: A, B

**Estado al cierre:** <un párrafo: dónde quedó el run, lo primero que un lector frío debe saber>

**Hecho:**
- A1: <qué cambió y por qué importa> — <sha>
- B1: ... — <sha>

**Decisiones:**
- <decisión> — <porqué; el razonamiento es la parte cara, escríbelo completo>

**Desviaciones y sorpresas:**
- <qué difirió del plan o se descubrió; 'ninguna' si fue limpio>

**Siguiente:**
- <la primera acción exacta de la siguiente sesión>

**Referencias:** <path::Symbol, SHAs de commits, docs — punteros, no prosa>
```

Para una entrada de recuperación (la sesión anterior murió sin cerrar), el header es
`## [S<n>-recuperada] <fecha ISO> — alcance: <bloques con commits>`, el **Estado al cierre**
declara que fue reconstruida desde los commits, **Hecho** lista solo lo que `git show` prueba, y
**Decisiones** dice `no recuperables — la sesión murió sin cerrar`.

Para la Sesión R el header es `## [SR] <fecha ISO> — alcance: review`, **Hecho** lista el effort
declarado con su cálculo, las revisiones que corrieron y los fixes con su SHA, **Decisiones** recoge
cada hallazgo descartado con la decisión que lo cubre, y **Referencias** incluye
el conteo de hallazgos preexistentes anotados en `.claude/preexisting-findings.md` y el resultado de /simplify. Si la Sesión R murió sin cerrar, la entrada de
recuperación lleva header `[SR-recuperada]` con las mismas reglas que `[S<n>-recuperada]`.
