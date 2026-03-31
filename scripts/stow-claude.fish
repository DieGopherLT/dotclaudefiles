#!/bin/fish

# Get the directory where this script lives
set SCRIPT_DIR (dirname (status --current-filename))
set REPO_ROOT (dirname $SCRIPT_DIR)
set DOTFILES_DIR "$REPO_ROOT/dotfiles"
set MODULE "claude"
set TARGET "$HOME"
set BACKUP_TIMESTAMP (date +%Y%m%d_%H%M%S)

# Verify dotfiles directory exists
if not test -d $DOTFILES_DIR
    echo "Error: Dotfiles directory not found at $DOTFILES_DIR"
    exit 1
end

# Verify module exists
if not test -d "$DOTFILES_DIR/$MODULE"
    echo "Error: Module $MODULE not found in $DOTFILES_DIR"
    exit 1
end

echo "Setting up stow for $MODULE..."
echo "Source: $DOTFILES_DIR"
echo "Target: $TARGET"
echo ""

# ============================================================
# Prevent tree folding on critical directories
# ============================================================
# Stow uses "tree folding": if a target directory doesn't exist,
# it creates a symlink to the entire source directory. For ~/.claude
# and ~/.config/ccstatusline this would cause ALL runtime data to be
# written into the repo. Pre-creating them forces stow to descend
# and link individually. ~/.claude/rules is intentionally NOT
# pre-created so stow folds it into a single symlink.
# ============================================================

# Check if ~/.claude is a symlink to a directory (THE DISASTER SCENARIO)
if test -L "$TARGET/.claude"
    echo ""
    echo "DANGER: ~/.claude is a symlink to a directory!"
    echo "   This means ALL Claude Code data is being written to your repo."
    echo ""
    echo "   Current target: "(readlink "$TARGET/.claude")
    echo ""
    echo "   To fix this:"
    echo "   1. rm ~/.claude"
    echo "   2. mkdir ~/.claude"
    echo "   3. Move runtime files from the old location to ~/.claude"
    echo "   4. Run this script again"
    echo ""
    exit 1
end

# Check if ~/.config/ccstatusline is a symlink to a directory
if test -L "$TARGET/.config/ccstatusline"
    echo ""
    echo "DANGER: ~/.config/ccstatusline is a symlink to a directory!"
    echo ""
    echo "   Current target: "(readlink "$TARGET/.config/ccstatusline")
    echo ""
    echo "   To fix this:"
    echo "   1. rm ~/.config/ccstatusline"
    echo "   2. mkdir ~/.config/ccstatusline"
    echo "   3. Run this script again"
    echo ""
    exit 1
end

# Ensure target directories exist as real directories
if not test -d "$TARGET/.claude"
    echo "Creating $TARGET/.claude directory..."
    mkdir -p "$TARGET/.claude"
end

if not test -d "$TARGET/.config/ccstatusline"
    echo "Creating $TARGET/.config/ccstatusline directory..."
    mkdir -p "$TARGET/.config/ccstatusline"
end

set BACKED_UP 0

# CLAUDE.md - must be a symlink, back up if it is a real file
if test -f "$TARGET/.claude/CLAUDE.md" -a ! -L "$TARGET/.claude/CLAUDE.md"
    set BACKUP_FILE "$TARGET/.claude/CLAUDE.md.backup.$BACKUP_TIMESTAMP"
    echo "Backing up existing CLAUDE.md..."
    mv "$TARGET/.claude/CLAUDE.md" $BACKUP_FILE
    echo "   Saved to: $BACKUP_FILE"
    set BACKED_UP (math $BACKED_UP + 1)
end

# rules/ - must be a symlink (stow folding). Back up and remove if it is a real directory
# so stow can fold it into a single symlink pointing to the entire dotfiles rules/ tree.
if test -d "$TARGET/.claude/rules" -a ! -L "$TARGET/.claude/rules"
    set BACKUP_FILE "$TARGET/.claude/rules.backup.$BACKUP_TIMESTAMP"
    echo "Backing up existing rules/ directory..."
    mv "$TARGET/.claude/rules" $BACKUP_FILE
    echo "   Saved to: $BACKUP_FILE"
    set BACKED_UP (math $BACKED_UP + 1)
end

# ccstatusline settings.json - must be a symlink, back up if it is a real file
if test -f "$TARGET/.config/ccstatusline/settings.json" -a ! -L "$TARGET/.config/ccstatusline/settings.json"
    set BACKUP_FILE "$TARGET/.config/ccstatusline/settings.json.backup.$BACKUP_TIMESTAMP"
    echo "Backing up existing ccstatusline settings..."
    mv "$TARGET/.config/ccstatusline/settings.json" $BACKUP_FILE
    echo "   Saved to: $BACKUP_FILE"
    set BACKED_UP (math $BACKED_UP + 1)
end

if test $BACKED_UP -gt 0
    echo ""
    echo "$BACKED_UP file(s) backed up. The module version will be used (module is source of truth)."
    echo ""
end

echo "Running stow..."
stow -d $DOTFILES_DIR -t $TARGET $MODULE

echo ""
echo "Verifying symlinks..."
set ERRORS 0

if test -L "$TARGET/.claude/CLAUDE.md"
    echo "  CLAUDE.md symlink verified"
else
    echo "  Error: CLAUDE.md symlink not created"
    set ERRORS (math $ERRORS + 1)
end

if test -L "$TARGET/.claude/rules"
    echo "  rules/ symlink verified"
else
    echo "  Error: rules/ symlink not created"
    set ERRORS (math $ERRORS + 1)
end

if test -L "$TARGET/.config/ccstatusline/settings.json"
    echo "  ccstatusline settings.json symlink verified"
else
    echo "  Error: ccstatusline settings.json symlink not created"
    set ERRORS (math $ERRORS + 1)
end

echo ""
if test $ERRORS -eq 0
    echo "All symlinks created successfully!"
    echo ""
    echo "Your configuration is now managed by stow."
    echo "Edit files in: $DOTFILES_DIR/$MODULE/"
    echo "Changes will be reflected immediately in $TARGET"
    exit 0
else
    echo "Failed to create $ERRORS symlink(s)"
    exit 1
end
