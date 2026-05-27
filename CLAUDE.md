# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins** containing five specialized plugins:

1. **dotclaudefiles** - Core productivity plugin (agents, commands, skills, output-styles)
2. **dotclaudehooks** - Standalone hooks plugin (commit validation, auto-formatting)
3. **smart-plan** - Intelligent feature planning and execution workflow (6 agents, 2 commands, 2 skills)
4. **tdd** - Test-Driven Development automation (4 agents, 2 commands, 1 skill, language rules)
5. **claude-management** - Claude Code memory file management (rulify, claudify, remember)

Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Repository Structure

To see the current repository structure, run:

```bash
tree -L 3 -I '.git|.claude' .
```

Key directories:

- **`plugins/`**: Contains the 5 plugins (dotclaudefiles, dotclaudehooks, smart-plan, tdd, claude-management)
- **`dotfiles/claude/`**: Stow-managed configuration files
- **`scripts/`**: Stow setup scripts for bash, fish, and PowerShell

## Plugin Descriptions

### dotclaudefiles

Core productivity plugin with daily-use commands, quality agents, and specialized workflows:

- **Agents**: `dependency-docs-collector`
- **Commands**: `/claudify`, `/dry-run`, `/explain-like-senior`, `/git-context`, `/journal`, `/language-evaluation`, `/predict-issues`, `/refactor-conditional-jsx`, `/remove-comments`
- **Skills**: `check-third-party-docs`, `deep-reason`, `document`, `team-setup`
- **Output Styles**: `mentor`, `personal-preference`
- **MCP Servers**: Sequential-thinking server for deep reasoning

### dotclaudehooks

Standalone hooks plugin for automated quality enforcement:

- **Hooks**:
  - `commit-validator` (PreToolUse on `git commit`) — enforces conventional commits, blocks emojis and co-author attribution, integrates with commitlint if available
  - `format-dispatcher` (PostToolUse on `Edit|Write`) — auto-runs ESLint, Prettier, gofmt, markdownlint based on project config detection

### smart-plan

Intelligent feature planning and execution workflow with LSP-powered semantic analysis:

- **Planning Phases (skill plan-feature)**: Discovery → Exploration → Clarification → Architecture → Plan Mode
- **Agents**: `code-explorer`, `code-indexer`, `code-architect`, `code-implementer`, `code-reviewer`, `code-refactorer`
- **Commands**: `/smart-delegation` (execute approved plan), `/smart-review` (quality review)
- **Skills**: `plan-feature` (5-phase planning + auto-invokes smart-delegation after approval), `post-implementation` (quality review + refactoring + finalization)
- **Key Features**: Parallel agent execution, LSP semantic analysis, plan template in references/, confidence-scored reviews (>=80%), automatic refactoring

### claude-management

Skills for managing Claude Code memory files:

- **Skills**: `rulify` (split heavy CLAUDE.md into on-demand `.claude/rules/` files), `claudify` (generate token-efficient module-level CLAUDE.md documentation), `remember` (classify and route a piece of information to the correct memory destination)

### tdd

Test-Driven Development automation with strict Red-Green-Refactor enforcement:

- **Agents**: `testability-auditor`, `code-adapter`, `testing-deps-investigator`, `test-implementer`
- **Commands**: `/add-testing`, `/tdd-feature`
- **Skill**: `tdd-workflow`
- **Language Rules**: Go, TypeScript/JavaScript, C# testing patterns and conventions

## Choosing the Right Plugin

**Use claude-management when:**

- CLAUDE.md has grown past 200 lines and needs splitting into `.claude/rules/` files
- Generating or updating a module-level CLAUDE.md with non-obvious documentation
- Deciding where to persist a piece of project information (local env, project-wide context, path-scoped rule, or memory)

**Use dotclaudefiles when:**

- Doing code reviews, refactoring, or daily development tasks
- Checking third-party documentation or integrating libraries
- Creating pull requests with structured descriptions
- Deep reasoning on complex architectural decisions
- Documenting patterns, problems, or decisions

**Use dotclaudehooks when:**

- You want automatic commit message validation without the rest of dotclaudefiles
- You want auto-formatting after file edits (ESLint, Prettier, gofmt, markdownlint)
- Installing hooks independently on a machine or project

**Use smart-plan when:**

- Planning complex features that span multiple files/modules
- Need LSP-powered semantic analysis before implementation
- Want a structured plan with parallelization groups and model recommendations
- Need to execute an approved plan with parallel implementer agents
- Require confidence-scored code reviews (>=80%) and automatic refactoring

**Use tdd when:**

- Starting a new feature with test-first approach
- Adding test coverage to existing modules
- Need testability audit before writing tests
- Want automated test dependency investigation
- Require strict Red-Green-Refactor workflow enforcement

## Installing Plugins

Each plugin can be installed independently:

```bash
# Add marketplace (once)
/plugin marketplace add https://github.com/DieGopherLT/dotclaudefiles diegopher

# Install individual plugins
/plugin install dotclaudefiles@diegopher
/plugin install dotclaudehooks@diegopher
/plugin install smart-plan@diegopher
/plugin install tdd@diegopher
/plugin install claude-management@diegopher
```

## Configuration Files

Each plugin has its own configuration:

- **`plugins/<plugin-name>/.claude-plugin/plugin.json`**: Plugin metadata (name, version, description, keywords)
- **`plugins/dotclaudefiles/.mcp.json`**: MCP server configurations (sequential-thinking server)
- **`plugins/tdd/rules/*.md`**: Language-specific testing conventions (Go, TypeScript, C#)
- **`.claude/settings.local.json`**: Plugin-specific settings (in repo root for local development)
- **`.gitignore`**: Excludes `.claude/` directory (local development sandbox)

## MCP Servers

The `dotclaudefiles` plugin includes the `sequential-thinking` MCP server configured in `plugins/dotclaudefiles/.mcp.json`. This enables deep reasoning for complex problems through dynamic thought processes. Use the `/deep-reason` skill to leverage this capability with structured analysis and documentation generation.
