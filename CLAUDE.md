# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins**. Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Configuration Files

- **`.claude/rules/`** and **`.claude/agents/`**: versioned; they are how this repo configures the agent working on it

## Skill Authoring

For skill creation, modification, structure, frontmatter fields, and writing conventions, invoke `/skill-creator` — it is the single source of truth.

## Writing Claude Code resources

Before creating or modifying any skill, agent, or rule, invoke the
`claude-five-prompting-guide` skill and match its recommended style.
`/skill-creator` remains the authority on skill structure and frontmatter;
the guide governs prose and prompting style.
