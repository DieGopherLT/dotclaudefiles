#!/usr/bin/env bash
set -euo pipefail

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DOTFILES_DIR="${REPO_ROOT}/dotfiles"
MODULE="claude"
TARGET="${HOME}"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Verify dotfiles directory exists
if [ ! -d "$DOTFILES_DIR" ]; then
    echo "Error: Dotfiles directory not found at $DOTFILES_DIR"
    exit 1
fi

# Verify module exists
if [ ! -d "$DOTFILES_DIR/$MODULE" ]; then
    echo "Error: Module $MODULE not found in $DOTFILES_DIR"
    exit 1
fi

echo "Setting up stow for $MODULE..."
echo "Source: $DOTFILES_DIR"
echo "Target: $TARGET"
echo ""

# Ensure target directories exist as real directories.
# Stow uses tree folding: if a directory does not exist in the target, it creates
# a symlink to the entire source directory. For ~/.claude and ~/.config/ccstatusline
# this would cause ALL runtime data to be written into the repo.
# Pre-creating them as real directories forces stow to descend and link individually.
mkdir -p "${TARGET}/.claude"
mkdir -p "${TARGET}/.config/ccstatusline"

BACKED_UP=0

# CLAUDE.md - must be a symlink, back up if it is a real file
if [ -f "${TARGET}/.claude/CLAUDE.md" ] && [ ! -L "${TARGET}/.claude/CLAUDE.md" ]; then
    BACKUP_FILE="${TARGET}/.claude/CLAUDE.md.backup.${BACKUP_TIMESTAMP}"
    echo "Backing up existing CLAUDE.md..."
    mv "${TARGET}/.claude/CLAUDE.md" "$BACKUP_FILE"
    echo "   Saved to: $BACKUP_FILE"
    BACKED_UP=$((BACKED_UP + 1))
fi

# rules/ - must be a symlink (stow folding). Back up and remove if it is a real directory
# so stow can fold it into a single symlink pointing to the entire dotfiles rules/ tree.
if [ -d "${TARGET}/.claude/rules" ] && [ ! -L "${TARGET}/.claude/rules" ]; then
    BACKUP_FILE="${TARGET}/.claude/rules.backup.${BACKUP_TIMESTAMP}"
    echo "Backing up existing rules/ directory..."
    mv "${TARGET}/.claude/rules" "$BACKUP_FILE"
    echo "   Saved to: $BACKUP_FILE"
    BACKED_UP=$((BACKED_UP + 1))
fi

# ccstatusline settings.json - must be a symlink, back up if it is a real file
if [ -f "${TARGET}/.config/ccstatusline/settings.json" ] && [ ! -L "${TARGET}/.config/ccstatusline/settings.json" ]; then
    BACKUP_FILE="${TARGET}/.config/ccstatusline/settings.json.backup.${BACKUP_TIMESTAMP}"
    echo "Backing up existing ccstatusline settings..."
    mv "${TARGET}/.config/ccstatusline/settings.json" "$BACKUP_FILE"
    echo "   Saved to: $BACKUP_FILE"
    BACKED_UP=$((BACKED_UP + 1))
fi

if [ $BACKED_UP -gt 0 ]; then
    echo ""
    echo "$BACKED_UP file(s) backed up. The module version will be used (module is source of truth)."
    echo ""
fi

echo "Running stow..."
stow -d "$DOTFILES_DIR" -t "$TARGET" "$MODULE"

echo ""
echo "Verifying symlinks..."
ERRORS=0

if [ -L "${TARGET}/.claude/CLAUDE.md" ]; then
    echo "  CLAUDE.md symlink verified"
else
    echo "  Error: CLAUDE.md symlink not created"
    ERRORS=$((ERRORS + 1))
fi

if [ -L "${TARGET}/.claude/rules" ]; then
    echo "  rules/ symlink verified"
else
    echo "  Error: rules/ symlink not created"
    ERRORS=$((ERRORS + 1))
fi

if [ -L "${TARGET}/.config/ccstatusline/settings.json" ]; then
    echo "  ccstatusline settings.json symlink verified"
else
    echo "  Error: ccstatusline settings.json symlink not created"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "All symlinks created successfully!"
    echo ""
    echo "Your configuration is now managed by stow."
    echo "Edit files in: $DOTFILES_DIR/$MODULE/"
    echo "Changes will be reflected immediately in $TARGET"
    exit 0
else
    echo "Failed to create $ERRORS symlink(s)"
    exit 1
fi
