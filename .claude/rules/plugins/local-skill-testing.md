---
paths:
  - "plugins/**"
---

# Testing a Skill Before Committing

A globally-scoped skill — the kind that lives in `dotclaudefiles`: general, daily-use skills meant to be
available in every session — can be exercised before it is committed to the repo by symlinking it into the
personal skills directory:

```bash
ln -sfn <repo>/plugins/<plugin>/skills/<skill> ~/.claude/skills/<skill>
```

Claude Code loads skills from `~/.claude/skills/`, so the symlink makes the in-development skill available
in every session immediately. A symlink beats a copy: the repo stays the single source of truth, and edits
to the skill reflect instantly with nothing to re-sync. Remove the link with `rm ~/.claude/skills/<skill>`
once the skill is promoted and installed through the plugin marketplace.

This applies to globally-scoped skills. A skill that only makes sense inside a specific plugin's flow or a
particular project context is not a good fit for a global symlink test.

## Limit: Workflow scripts with namespaced agents need the plugin installed

The symlink trick covers the skill's prose, but NOT a bundled Workflow script that spawns the plugin's
own agents. `agentType: "<plugin>:<agent>"` (e.g. `task-harness:diff-line-scanner`) resolves against
the session's installed-plugin registry — running the script from the repo without the plugin installed
leaves every namespaced agent unrecognized and the whole fan-out fails (agents show red in /workflows).

To exercise such a Workflow end to end, install the plugin first (`/plugin install <plugin>@diegopher`,
bumped to the version under test) and run it in a fresh session. Syntax-level checks (`node --check`,
launching with a stub `extraAuditors`-style arg) are the most a non-installed run can validate.
