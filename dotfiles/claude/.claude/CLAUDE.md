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
- When launching sub-agents, always call them on foreground; it has less issues with permissions. Unless you want to perform something while the agent works, then you can call it on background.
  - The golden rule is: if you'll just wait for the agent to finish, then call it on foreground. If you'll do something else while waiting, then call it on background.

