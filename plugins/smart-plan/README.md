# smart-plan

Workflow inteligente para planear y ejecutar features con 6 agentes especializados, paralelizacion, analisis semantico via LSP, y quality gates automaticos. La skill `plan-feature` guia el planning en 5 fases, genera un plan autocontenido, e invoca automaticamente `smart-delegation` para ejecutar la implementacion. La skill `smart-interview` elicita requerimientos cuantificables, reglas de negocio, y flujos del sistema antes de disenar.

## Instalacion

```bash
/plugin install smart-plan
```

## Uso

Invocar la skill de planning describiendo la feature en lenguaje natural:

```
Planea la feature: <descripcion del feature>
```

La skill `plan-feature` se activa automaticamente por contexto e invoca `smart-delegation` al aprobar el plan. La skill `smart-interview` tambien se activa de forma standalone cuando el usuario pregunta si hay dudas antes de planear o implementar:

```
¿Preguntas? / ¿Tienes dudas? / ¿Quieres aclarar algo?
```

Para ejecutar un plan ya existente manualmente:

```
/smart-plan:smart-delegation
```

## Workflow de Planning - 5 Fases (skill plan-feature)

| Fase | Nombre               | Descripcion                                                                       |
|------|----------------------|-----------------------------------------------------------------------------------|
| 1    | Discovery            | Entiende el request, crea tareas, confirma con usuario                            |
| 2    | Codebase Exploration | 2 code-explorer + 1 code-indexer en paralelo                                      |
| 3    | Smart Interview      | Entrevista estructurada: requerimientos cuantificables, reglas de negocio, flujos |
| 4    | Architecture Design  | 2-3 code-architect con enfoques distintos                                         |
| 5    | Plan Mode            | Plan formal con dependencias y plantilla, aprobado por usuario                    |

**Nota**: Al aprobar el plan, `plan-feature` invoca `smart-delegation` automaticamente. El plan incluye instrucciones para `/smart-plan:post-implementation` al finalizar la implementacion.

## Post-Implementation (3 Fases - Sesion Separada)

Ejecutadas via skill `/smart-plan:post-implementation` despues de completar la implementacion:

| Fase | Nombre         | Descripcion                                            |
|------|----------------|--------------------------------------------------------|
| 7    | Quality Review | 3 code-reviewer con focos distintos (confianza >= 80%) |
| 8    | Refactoring    | code-refactorer auto-corrige hallazgos + validacion    |
| 9    | Finalization   | Resumen, commit opcional, proximos pasos               |

## Agentes

### code-explorer (yellow)

Exploracion textual del codebase. Combina Glob/Grep/Read con LSP Chain para archivos soportados (.ts/.js/.tsx/.jsx/.go). Produce mapa de arquitectura, patrones, y features similares.

### code-indexer (cyan)

Analisis semantico puro via LSP. Construye grafos de dependencia de tipos, call hierarchy, e interface contracts. Solo para lenguajes con soporte LSP.

### code-architect (green)

Disena arquitectura del feature desde un enfoque especifico (minimal, clean, pragmatico). Produce blueprint con plan de dependencias, file ownership map, grupos de paralelizacion, y recomendacion de modelo por tarea.

### code-implementer (blue)

Agente de ejecucion enfocado. Recibe una tarea especifica y la implementa siguiendo el plan. Usa LSP para verificar tipos. No compila ni ejecuta tests.

### code-reviewer (red)

Revisa codigo con sistema de confidence scoring. Solo reporta hallazgos con confianza >= 80%. Cada hallazgo incluye fix concreto y accionable.

### code-refactorer (magenta)

Aplica correcciones automaticas de hallazgos del review. Verifica tipos con LSP despues de cada fix. Ejecuta build/tests/linter al finalizar.

## Seleccion de Modelo por Tarea

| Modelo | Cuando usar                                               |
|--------|-----------------------------------------------------------|
| haiku  | Tareas mecanicas: copiar patrones, renombrar, boilerplate |
| sonnet | Modulo individual, logica de negocio estandar (DEFAULT)   |
| opus   | Multi-modulo, archivos interconectados, tests complejos   |

## Diferencias con feature-dev

| Aspecto            | feature-dev                    | smart-plan                               |
|--------------------|--------------------------------|------------------------------------------|
| Implementacion     | Agente principal               | Delegada a code-implementer              |
| Fases              | 3 (explore, architect, review) | 9 completas                              |
| Analisis semantico | No                             | LSP Chain via code-indexer               |
| Paralelizacion     | No                             | Grupos con dependencias                  |
| Review             | Solo texto                     | Confidence scoring >= 80%                |
| Auto-fix           | No                             | code-refactorer automatico               |
| Plan mode          | Nunca                          | Siempre (Fase 5)                         |
| Entrevista         | No                             | Fase 3 con requerimientos cuantificables |
| Commit             | No                             | Fase 9 con convenciones                  |
| Dependencias       | No                             | Plan de dependencias explicito           |
