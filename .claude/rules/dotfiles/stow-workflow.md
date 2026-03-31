---
paths:
  - "dotfiles/**"
  - "scripts/stow-*"
---

# Dotfiles Management with GNU Stow

## Dotfiles Structure

The `dotfiles/claude/` directory uses **GNU Stow** for symlink management:

- **Source of truth**: Files in `dotfiles/claude/` override local versions
- **Setup scripts**: `scripts/stow-claude.{sh,fish,ps1}` create symlinks to `$HOME`
- **Automatic backups**: Existing files are backed up before symlinking
- **Managed symlinks**:
  - `~/.claude/CLAUDE.md` → User preferences and code standards
  - `~/.claude/rules/` → Entire rules directory (code-standards, languages, tools, etc.)
  - `~/.config/ccstatusline/settings.json` → Status line configuration

## Stow Setup

The repository uses GNU Stow for dotfile management. Run setup scripts from repository root:

```bash
# Bash
./scripts/stow-claude.sh

# Fish
./scripts/stow-claude.fish

# PowerShell
.\scripts\stow-claude.ps1
```

Scripts will:

1. Backup existing non-symlinked files with timestamp
2. Create symlinks from `dotfiles/claude/` to `$HOME`
3. Verify symlinks were created successfully
4. Report any errors

## Symlinks to Watch For

When using `config-sync-analyzer`, symlinks are automatically excluded:

- `~/.claude/CLAUDE.md` (symlinked via stow)
- `~/.claude/rules/` (symlinked via stow, entire directory)
- `~/.config/ccstatusline/settings.json` (symlinked via stow)

## System Files Never Synced

These files in `~/.claude/` are system-managed and never part of the plugin:

- `.credentials.json`, `claude.json`, `history.jsonl`, `settings.json`
- Directories: `debug/`, `file-history/`, `downloads/`, `session-env/`, `shell-snapshots/`, `todos/`, `projects/`, `plugins/`, `ide/`, `statsig/`, `hooks/`, `config/`
