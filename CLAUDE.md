# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins** containing twelve specialized plugins:

1. **dotclaudefiles** - Skills plugin for team setup and Claude Code authoring (team-setup, claude-code-agent-creator, workflow-creator, create-report)
2. **dotclaudehooks** - Standalone hooks plugin (LSP-first navigation nudges)
3. **claude-management** - Claude Code memory file management and self-improvement harness (rulify, claudify, remember, end-session, stabilize, suggestion hooks)
4. **document-api** - API contract documentation (REST endpoints, socket.io events) for frontend handoff
5. **react-dev** - React development helpers (conditional JSX refactoring, component splitting)
6. **testing** - Retrofit testing pipeline for existing code (testability auditing, seams, characterization tests, test-quality auditing)
7. **typescript-migration** - Autonomous JS-to-TS migration pipeline (audit, tooling setup, shared types extraction, parallel per-chunk typing, progressive strict-mode consolidation)
8. **git-toolkit** - Git workflow enforcement (commit standards, branch naming, conflict resolution for rebases and merges, squash planning for interactive rebases)
9. **domain-restructure** - Autonomous layer-first to feature-first restructurer (strategic-DDD domain discovery, subdomain classification, parallel per-domain moves, import consolidation with build gate)
10. **spec-kit** - Spec-driven workflow toolkit (closed self-contained specs, design-closure loop via closed-design-enforcer, implement-spec dispatcher across direct/agent-waves/workflow strategies)
11. **refactoring-guru** - Reactive code-smell analysis and guided refactoring over the refactoring.guru taxonomy (parallel per-category smell-scan, smell→technique mapping, step-by-step refactor applier)
12. **task-harness** - The full lifecycle of a substantial task as three chainable, independently invocable skills (task-planning, task-execution, task-quality-gate) plus the twelve read-only auditors the gate fans out through a dynamic Workflow

Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Repository Structure

To see the current repository structure, run:

```bash
tree -L 3 -I '.git|.claude' .
```

Key directories:

- **`plugins/`**: Contains the 12 plugins (dotclaudefiles, dotclaudehooks, claude-management, document-api, react-dev, testing, typescript-migration, git-toolkit, domain-restructure, spec-kit, refactoring-guru, task-harness)
- **`dotfiles/claude/`**: Stow-managed configuration files
- **`scripts/`**: Stow setup scripts for bash, fish, and PowerShell

## Configuration Files

Each plugin has its own configuration:

- **`plugins/<plugin-name>/.claude-plugin/plugin.json`**: Plugin metadata (name, version, description, keywords)
- **`plugins/testing/skills/retrofit-testing/references/*.md`**: Coverage strategies, test anti-patterns, and project rules template
- **`plugins/typescript-migration/skills/typescript-migration/fixtures/*.json`**: tsconfig templates per project type (react-vite, nextjs, node, generic)
- **`.claude/settings.local.json`**: Plugin-specific settings (in repo root for local development) — gitignored, unlike the rest of `.claude/`
- **`.claude/rules/`** and **`.claude/agents/`**: versioned; they are how this repo configures the agent working on it
- **`.gitignore`**: excludes only `.claude/settings.local.json`, `.claude/worktrees/`, and `.claude/refactoring-guru/` — not `.claude/` as a whole

## Skill Authoring

For skill creation, modification, structure, frontmatter fields, and writing conventions, invoke `/skill-creator` — it is the single source of truth.
