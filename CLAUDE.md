# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins** containing three specialized plugins:

1. **dotclaudefiles** - Core productivity plugin (3 agents, 9 commands, 6 skills, hooks, output-styles)
2. **smart-plan** - Intelligent feature planning and execution workflow (6 agents, 2 commands, 2 skills)
3. **tdd** - Test-Driven Development automation (4 agents, 2 commands, 1 skill, language rules)

Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Repository Structure

To see the current repository structure, run:

```bash
tree -L 3 -I '.git|.claude' .
```

Key directories:

- **`plugins/`**: Contains the 3 plugins (dotclaudefiles, smart-plan, tdd)
- **`dotfiles/claude/`**: Stow-managed configuration files
- **`scripts/`**: Stow setup scripts for bash, fish, and PowerShell

## Plugin Descriptions

### dotclaudefiles

Core productivity plugin with daily-use commands, quality agents, and specialized workflows:

- **Agents**: `consistency-auditor`, `dependency-docs-collector`, `dockerify`
- **Commands**: `/claudify`, `/dry-run`, `/explain-like-senior`, `/git-context`, `/journal`, `/language-evaluation`, `/predict-issues`, `/refactor-conditional-jsx`, `/remove-comments`
- **Skills**: `check-third-party-docs`, `create-pr`, `deep-reason`, `document`, `dropletify`, `typescript-advanced-types`
- **Hooks**: Format dispatcher for auto-linting/formatting after code changes
- **MCP Servers**: Sequential-thinking server for deep reasoning

### smart-plan

Intelligent feature planning and execution workflow with LSP-powered semantic analysis:

- **Planning Phases (skill plan-feature)**: Discovery → Exploration → Clarification → Architecture → Plan Mode
- **Agents**: `code-explorer`, `code-indexer`, `code-architect`, `code-implementer`, `code-reviewer`, `code-refactorer`
- **Commands**: `/smart-delegation` (execute approved plan), `/smart-review` (quality review)
- **Skills**: `plan-feature` (5-phase planning + auto-invokes smart-delegation after approval), `post-implementation` (quality review + refactoring + finalization)
- **Key Features**: Parallel agent execution, LSP semantic analysis, plan template in references/, confidence-scored reviews (>=80%), automatic refactoring

### tdd

Test-Driven Development automation with strict Red-Green-Refactor enforcement:

- **Agents**: `testability-auditor`, `code-adapter`, `testing-deps-investigator`, `test-implementer`
- **Commands**: `/add-testing`, `/tdd-feature`
- **Skill**: `tdd-workflow`
- **Language Rules**: Go, TypeScript/JavaScript, C# testing patterns and conventions

## Choosing the Right Plugin

**Use dotclaudefiles when:**

- Doing code reviews, refactoring, or daily development tasks
- Checking third-party documentation or integrating libraries
- Creating pull requests with structured descriptions
- Deep reasoning on complex architectural decisions
- Dockerizing applications for deployment
- Documenting patterns, problems, or decisions

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
/plugin install smart-plan@diegopher
/plugin install tdd@diegopher
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
