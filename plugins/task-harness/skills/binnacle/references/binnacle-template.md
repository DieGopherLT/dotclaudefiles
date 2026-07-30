---
task: <título>
branch: <nombre>
worktree: <ruta absoluta>
base_branch: <rama base — solo contexto humano, no usable como revisión>
base_sha: <SHA del merge-base — congelado, nunca se reescribe>
plan_path: </ruta/absoluta/al/plan.md | none>   # absoluta y expandida, nunca con ~
status: in-progress | ready-for-review | done
current_session: <n> of <total>   # total = solo sesiones de trabajo; la Sesión R nunca cuenta
read_until_line: <N>   # Read con limit: N → frontmatter + convenciones + plan de sesiones + última entrada
last_updated: <timestamp ISO>
---

# Bitácora: <título de la tarea>

> Changelog de un run multi-sesión, la entrada más reciente primero. Las entradas son
> inmutables — ninguna se depreca, edita ni resume. Para retomar este run: invoca la skill
> `binnacle` y ejecuta su sección *Resuming* completa, en orden y sin resumirla — status gate,
> Read acotado por `read_until_line`, reconciliación contra git, recuperación, lectura del plan
> en `plan_path`, re-registro de tareas. No improvises el procedimiento desde este texto.

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

## Entradas
<!-- la más reciente primero — insertar cada entrada nueva justo debajo de este comentario -->
