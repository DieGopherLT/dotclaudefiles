---
paths:
  - "**/skills/**"
  - "**/commands/**"
---

# Skill Frontmatter Reference

## Fields

| Campo | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `name` | string | No | nombre del directorio | Identificador kebab-case. Se convierte en `/slash-command`. |
| `description` | string | Recomendado | primer parrafo del body | Cuando usar la skill. Claude lo lee para decidir activacion automatica. |
| `model` | string | No | modelo por defecto | Modelo especifico para esta skill. Ver IDs validos abajo. |
| `version` | string | No | — | Version de la skill (semver). Informativo. |
| `user-invocable` | bool | No | `true` | `false` = oculta del menu `/`, solo Claude puede invocarla. |
| `disable-model-invocation` | bool | No | `false` | `true` = Claude no la activa automaticamente; solo invocacion manual. |
| `allowed-tools` | string | No | — | Herramientas permitidas sin pedir permiso. Comma-separated. Soporta especificadores: `Bash(git *)`. |
| `argument-hint` | string | No | — | Hint en autocomplete, ej: `[filename] [format]`. |
| `context` | string | No | — | `fork` = ejecuta la skill en subagente aislado. |
| `agent` | string | No | `general-purpose` | Tipo de subagente cuando `context: fork`. Opciones: `Explore`, `Plan`, `general-purpose`, o nombre de agente custom. |

## Model IDs validos

```
claude-opus-4-6
claude-sonnet-4-6
claude-haiku-4-5-20251001
```

## Comportamiento segun configuracion

| Configuracion | Usuario invoca | Claude invoca | Description en contexto |
|---------------|---------------|---------------|------------------------|
| (defaults) | Si | Si | Siempre cargada |
| `disable-model-invocation: true` | Si | No | No se carga automaticamente |
| `user-invocable: false` | No | Si | Siempre cargada |

## Variables disponibles en el body

| Variable | Descripcion |
|----------|-------------|
| `$ARGUMENTS` | Todos los argumentos pasados al invocar |
| `$ARGUMENTS[N]` | Argumento por indice base-0 |
| `$N` | Shorthand: `$0`, `$1`, etc. |
| `${CLAUDE_SESSION_ID}` | ID de sesion actual |
| `${CLAUDE_PLUGIN_ROOT}` | Ruta absoluta al directorio raiz del plugin |

## Ejemplos rapidos

```yaml
# Skill manual-only (deploy, commit, etc.)
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
allowed-tools: Bash(*)
---
```

```yaml
# Skill solo para Claude (conocimiento de contexto)
---
name: legacy-context
description: Explains the legacy payment system internals
user-invocable: false
---
```

```yaml
# Skill con modelo especifico y herramientas restringidas
---
name: deep-reason
description: Deep structured reasoning for complex problems
model: claude-opus-4-6
user-invocable: true
---
```

```yaml
# Skill en subagente aislado
---
name: research
description: Research a topic in isolation
context: fork
agent: Explore
---
```
