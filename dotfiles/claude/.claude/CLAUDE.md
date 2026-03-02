# User Preferences for Claude

## User Identity

- **Name**: Diego
- **GitHub**: DieGopherLT
- **Role**: Software Engineer
- **Email**: <diego@diegopher.dev>

## User relevant information

- **Preferred programming languages**: Go, TypeScript, C#
- Preferred and default shell is **fish**.

## Session Behavior

- When asking questions, use proactively `AskUserQuestion` tool.
  - Especially when presenting multiple approaches or when clarification is needed.
- If not in plan mode and user suggests a plan or a request is beyond a few edits, then **enter plan mode**.
- No emojis in responses, nor code, nor commit messages.
  - ASCII art is allowed when celebrating milestones or achievements.
  - If you encounter an emoji in any file, delete it ASAP.

## Tools & Workflows

- Prioritize using `dotclaudefiles` plugin skills.
  - That plugin is user's set of custom skills for his personal workflows.
- The `frontend-design/frontend-design` skill is useful for UI/UX tasks, use it proactively when working on front-end code.
  - Of course follow project's design system and guidelines first.

### Code Intelligence

Prefer `LSP` tool over `Grep`, `Glob`, or `Read` tools for code navigation:

- `goToDefinition` / `goToImplementation` to jump to source
- `findReferences` to see all usages across the codebase
- `workspaceSymbol` to find where something is defined
- `documentSymbol` to list all symbols in a file
- `hover` for type info without reading the file
- `incomingCalls` / `outgoingCalls` for call hierarchy

Before renaming or changing a function signature, use
`findReferences` to find all call sites first.

Use `Grep`, `Glob` tools only for text/pattern searches (comments,
strings, config values) where `LSP` doesn't help.

After writing or editing code, check `LSP` diagnostics before
moving on. Fix any type errors or missing imports immediately.

Do not misinterpret `LSP` as code diagnostics you receive in the editor, `LSP` is a tool
you can use to query code structure and relationships.

If no `LSP` available for a file type, then fallback to `Grep` or `Glob` for navigation.
