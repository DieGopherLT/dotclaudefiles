---
task: <título>
branch: <nombre>
worktree: <ruta absoluta>
base_ref: <rama> @ <SHA del merge-base>
plan_path: <~/.claude/plans/<nombre>.md | none>
status: in-progress | ready-for-review | done
current_session: <n> of <total>
read_until_line: <N>   # Read con limit: N → frontmatter + convenciones + plan de sesiones + última entrada
last_updated: <timestamp ISO>
---

# Bitácora: <título de la tarea>

> Changelog de un run multi-sesión, la entrada más reciente primero. Las entradas son
> inmutables — ninguna se depreca, edita ni resume. Una sesión fría retoma leyendo hasta
> `read_until_line`, re-registrando las tareas de la sesión en curso con TaskCreate desde el
> plan de sesiones de abajo, y continuando desde la sección **Siguiente** de la última entrada.
> Lee entradas viejas solo cuando la última entrada apunte a ellas.

## Convenciones de ejecución

- Ejecuta en el contexto principal; commit en cada frontera de bloque vía la skill `commit`.
- `TaskUpdate` en el momento en que cada tarea se completa.
- La última tarea de cada sesión es: invocar `log-binnacle` y escribir la entrada de la sesión.
- Al cerrar la última sesión de trabajo, poner `status: ready-for-review`; el usuario ejecuta el
  code review manualmente en una sesión limpia.

## Plan de sesiones

- [ ] Sesión 1 — A, B: <alcance corto>
- [ ] Sesión 2 — C, D, E: <alcance corto>
- [ ] Sesión R — code review: la ejecuta el usuario, manualmente, en una sesión limpia

### Bloques

A: <título del bloque>
  A1: <acción concreta y observable>
  A2: ...
B: ...

## Entradas (la más reciente primero — insertar entradas nuevas justo bajo esta línea)

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
