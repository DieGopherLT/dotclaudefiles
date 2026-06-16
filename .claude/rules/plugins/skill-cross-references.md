---
paths:
  - "plugins/**"
---

# Skill Cross-References

Skills and plugins are distributed independently — each plugin is installed on its own, so any
resource it does not ship is not guaranteed to exist in the environment where the skill runs.
Referencing another plugin's internals from inside a skill creates a fragile, often false coupling.

## The rule

**Never reference a specific resource of another skill from inside a skill unless both belong to the
same plugin.** A "specific resource" means a particular field, section, line, file, agent, or internal
detail of the other skill — anything that can drift or be absent.

Two ways to reference another skill are allowed:

1. **Same plugin.** If both skills ship in the same plugin, you may point at concrete internals — they
   travel together and version together.
2. **Advocate invocation, not a field.** Across plugins, do not cite a particular field or section.
   Instead, advocate invoking the other skill for a practical use case, so the reader acquires that
   skill's full context by running it — never by reading one extracted detail out of context.

## Why

A cross-plugin pointer to a specific field breaks in two ways: the target plugin may not be installed,
and its internal content can change without notice, leaving a stale or incorrect citation. Pointing at
a practical invocation is resilient — the skill is loaded whole, in its current form, only when the
reader actually needs it.

## Example of the violation

Citing `domain-restructure`'s single-owner partitioning detail inside the `workflow-creator` skill:
the two live in different plugins, the cited behavior was specific to that plugin's internals, and the
claim turned out to be factually wrong about how that plugin works. The fix was to state the concept
generically rather than borrow another plugin's internal as an authority.
