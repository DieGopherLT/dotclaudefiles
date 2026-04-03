---
paths:
  - "**/skills/**"
---

# Skill Language Split - Diego's Personalization

For skill creation methodology, structure, and what goes in body vs frontmatter: **invoke `/skill-creator`**. This file defines Diego's language convention applied on top of that process.

## Language Split Rule

| Component | Language | Rationale |
|-----------|----------|-----------|
| Frontmatter `description` | **Spanish** | Diego interacts in Spanish; improves activation accuracy |
| Body content | **English** | Reduces token consumption; standard for technical docs |

### Frontmatter (Spanish)

- Third-person form: "Esta skill debe usarse cuando el usuario pide..."
- Include trigger phrases in both Spanish and English (bilingual user)
- Keep concise (~300-500 characters)

### Body (English)

- Follow `/skill-creator` writing patterns
- Start directly with workflow -- no preamble, no "Purpose" section

### Example applying the split

```markdown
---
name: code-review
description: Esta skill debe usarse cuando el usuario pide "review the code", "check code quality", "haz review de los cambios", o despues de implementacion. Ejecuta quality review con reviewers paralelos.
---

# Code Review

Execute quality review with parallel reviewers.

## Workflow

1. Read modified files from git status.
2. Launch 3 reviewers in parallel.
3. Consolidate findings into a single report.
```

Note: frontmatter in Spanish with bilingual triggers, body in English with imperative form. This is the only convention this file enforces -- everything else (`/skill-creator` handles).
