---
paths:
  - "**/agents/**/*.md"
  - "**/skills/**/*.md"
  - "**/commands/**/*.md"
---

# Frontmatter Format - Diego's Conventions

For the complete skill/agent creation methodology: **invoke `/skill-creator`**. This file defines Diego's formatting conventions for frontmatter descriptions.

## Language: Spanish

All agent and skill frontmatter descriptions must be written in Spanish. Diego interacts in Spanish; matching the language improves activation accuracy.

## Description Format

### Skills (Third Person)

```yaml
description: Esta skill debe usarse cuando el usuario pide "frase 1", "frase 2", "frase 3", o menciona [contextos relevantes]. Proporciona [breve descripcion].
```

- Start with "Esta skill debe usarse cuando el usuario pide..."
- 5-8 trigger phrases between quotes (bilingual: Spanish + English)
- Contextual mentions after "o menciona..."
- Value proposition at the end ("Proporciona...")

**Example:**

```yaml
description: Esta skill debe usarse cuando el usuario pide "dominar el sistema de tipos de TypeScript", "implementar tipos genericos", "crear tipos condicionales", "refactorizar tipados", "migrar de JavaScript a TypeScript", o menciona tipos mapeados, tipos literales de plantilla, o tipos utilitarios. Proporciona guia completa para construir aplicaciones type-safe.
```

### Agents (Third Person)

```yaml
description: Este agente debe usarse cuando [condicion 1], [condicion 2], o cuando se necesite [capacidad]. [Descripcion de lo que hace].
```

- Start with "Este agente debe usarse cuando..."
- Describe conditions and scenarios (agents are invoked by Claude, not users)
- Be specific about what the agent analyzes, generates, or validates

## Validation Checklist

Before finalizing agent/skill:

- [ ] Description in Spanish (this file's convention)
- [ ] Third-person format ("Esta skill debe usarse cuando..." / "Este agente debe usarse cuando...")
- [ ] Body in English (see `skill-body-content.md`)
- [ ] Full methodology followed via `/skill-creator`
