---
paths:
  - "plugins/**"
---

# Plugin Development - CRITICAL

## Using plugin-dev Resources

**ALWAYS use the `plugin-dev` plugin for developing this repository.** It provides:

- **Skills**: `/plugin-dev:create-plugin`, `/plugin-dev:skill-development`, `/plugin-dev:agent-development`, `/plugin-dev:command-development`, `/plugin-dev:hook-development`, `/plugin-dev:mcp-integration`, `/plugin-dev:plugin-settings`, `/plugin-dev:plugin-structure`
- **Agents**: `plugin-validator`, `skill-reviewer`, `agent-creator`
- **Best Practices**: Frontmatter guidelines, progressive disclosure, auto-discovery patterns

**The plugin-dev plugin was created by the Claude Code team specifically to make plugin development easier and follow official best practices.**

**WARNING**: Failing to use `plugin-dev` resources means ignoring official Claude Code plugin development standards. Always consult these resources when creating or modifying plugin components.

## Mandatory Workflows

- **Hook creation/modification**: When the user asks to create or modify a hook, invoke `/plugin-dev:hook-development` immediately before writing any code. The skill provides the correct structure and patterns.
- **Post-change validation**: After finishing ANY plugin change (commands, agents, skills, hooks, config), run the `plugin-validator` agent to verify the plugin structure remains valid. Do not skip this step.

## Component Review

After creating/modifying plugin components, use the reviewer tools from `plugin-dev`:

- `skill-reviewer` agent for skill definitions
- `agent-creator` agent for new agent generation
- `plugin-validator` agent for overall plugin structure validation (MANDATORY after any change)

## Quality Standards

When creating new resources:

- **Agents**: Must include clear trigger examples, tool requirements, and specific instructions
- **Commands**: Must have argument hints, clear descriptions, and user-invocable flag if needed
- **Skills**: Must include step-by-step workflows, reference files/templates where applicable
- **Naming**: Descriptive, intent-focused (avoid generic terms like handler, manager, helper)
- **Documentation**: Token-efficient, focus on non-obvious information
