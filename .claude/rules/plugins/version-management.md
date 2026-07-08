---
paths:
  - "plugins/**"
---

# CRITICAL: Plugin Lifecycle Rules

## Updating an existing plugin

**ALWAYS bump the version in the affected plugin's `plugin.json` BEFORE committing changes.**

If you commit without updating the version, the plugin will not update on the marketplace. This is not negotiable.

```bash
# 1. Edit plugins/<plugin-name>/.claude-plugin/plugin.json
# 2. Increment version (e.g., 1.3.0 → 1.3.1 or 1.4.0)
# 3. THEN commit
git add plugins/<plugin-name>/.claude-plugin/plugin.json <other-files>
git commit -m "chore(<plugin-name>): bump version to X.Y.Z - <description>"
```

### Version Bumping Guidelines

- **Patch (1.3.0 → 1.3.1)**: Bug fixes, small tweaks, documentation updates
- **Minor (1.3.0 → 1.4.0)**: New commands, agents, or skills
- **Major (1.3.0 → 2.0.0)**: Breaking changes, major restructuring

When changes affect multiple plugins, bump all affected plugin versions.

Commit the bump along the changes that triggered the bump to happen. Do not commit a version bump in isolation.
Also, do not include the version bump in the commit message, just the description of the change.

## Creating a new plugin

When adding a brand new plugin to the repository, the version bump is not enough. Complete this
checklist before committing:

1. **Register in the marketplace** — add an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "<plugin-name>",
  "description": "<one or two sentences describing what the plugin does>",
  "source": "./plugins/<plugin-name>"
}
```

2. **Document in CLAUDE.md** — update the project root `CLAUDE.md`:
   - Increment the plugin count in the Repository Overview paragraph
   - Add a `### <plugin-name>` section under Plugin Descriptions
   - Add a `**Use <plugin-name> when:**` block under Choosing the Right Plugin
   - Add `/plugin install <plugin-name>@diegopher` to the Installing Plugins code block
   - Update the key directories line that lists plugin names

3. **Bump the version** — same rule as above; start at `1.0.0` for new plugins.

Missing any of these steps means the plugin exists on disk but is invisible to the marketplace and
to future sessions reading the project context.
