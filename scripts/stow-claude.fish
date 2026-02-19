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
# CRITICAL: Prevent tree folding disaster
# ============================================================
# Stow uses "tree folding" by default: if a target directory doesn't exist,
# it creates a symlink to the entire directory instead of individual files.
# This would cause ALL Claude Code runtime data to be written into the repo.
#
# Solution: Ensure target directories exist BEFORE running stow.
# ============================================================

echo "Preparing target directories (preventing tree folding)..."

# Check if ~/.claude is a symlink to a directory (THE DISASTER SCENARIO)
if test -L "$TARGET/.claude"
    echo ""
    echo "⚠️  DANGER: ~/.claude is a symlink to a directory!"
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
    echo "⚠️  DANGER: ~/.config/ccstatusline is a symlink to a directory!"
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

# Ensure ~/.claude directory exists (real directory, not symlink)
if not test -d "$TARGET/.claude"
    echo "Creating $TARGET/.claude directory..."
    mkdir -p "$TARGET/.claude"
end

# Handle rules/ subdirectory symlinks
# Each managed subdirectory inside rules/ gets its own symlink
set RULES_SOURCE "$DOTFILES_DIR/$MODULE/.claude/rules"
set RULES_TARGET "$TARGET/.claude/rules"

# Ensure rules/ exists as a real directory
if not test -d $RULES_TARGET
    mkdir -p $RULES_TARGET
    echo "✓ rules/ directory created"
end

# Create symlinks for each managed subdirectory
for subdir in code-standards languages tools
    set SUB_SOURCE "$RULES_SOURCE/$subdir"
    set SUB_TARGET "$RULES_TARGET/$subdir"
    if test -d $SUB_SOURCE
        if test -L $SUB_TARGET
            echo "✓ rules/$subdir symlink already exists"
        else if test -d $SUB_TARGET
            echo "⚠️  rules/$subdir exists as real directory, backing up..."
            mv $SUB_TARGET "$SUB_TARGET.backup.$BACKUP_TIMESTAMP"
            ln -s $SUB_SOURCE $SUB_TARGET
            echo "✓ rules/$subdir symlink created"
        else
            ln -s $SUB_SOURCE $SUB_TARGET
            echo "✓ rules/$subdir symlink created"
        end
    end
end

# Ensure ~/.config/ccstatusline directory exists
if not test -d "$TARGET/.config/ccstatusline"
    echo "Creating $TARGET/.config/ccstatusline directory..."
    mkdir -p "$TARGET/.config/ccstatusline"
end

echo ""

# Backup and remove existing files (if they exist and are not symlinks)
# This ensures the module version is always used (module is source of truth)

set BACKED_UP 0

# Check CLAUDE.md
if test -f "$TARGET/.claude/CLAUDE.md" -a ! -L "$TARGET/.claude/CLAUDE.md"
    set BACKUP_FILE "$TARGET/.claude/CLAUDE.md.backup.$BACKUP_TIMESTAMP"
    echo "📦 Backing up existing CLAUDE.md..."
    mv "$TARGET/.claude/CLAUDE.md" $BACKUP_FILE
    echo "   Saved to: $BACKUP_FILE"
    set BACKED_UP (math $BACKED_UP + 1)
end

# Check ccstatusline settings
if test -f "$TARGET/.config/ccstatusline/settings.json" -a ! -L "$TARGET/.config/ccstatusline/settings.json"
    set BACKUP_FILE "$TARGET/.config/ccstatusline/settings.json.backup.$BACKUP_TIMESTAMP"
    echo "📦 Backing up existing ccstatusline settings..."
    mv "$TARGET/.config/ccstatusline/settings.json" $BACKUP_FILE
    echo "   Saved to: $BACKUP_FILE"
    set BACKED_UP (math $BACKED_UP + 1)
end

if test $BACKED_UP -gt 0
    echo ""
    echo "ℹ️  $BACKED_UP file(s) backed up. The module version will be used (module is source of truth)."
    echo ""
end

# Execute stow
# --no-folding: CRITICAL - prevents stow from creating directory symlinks
#               (extra safety even though we create dirs above)
echo "Running stow..."
stow --no-folding -d $DOTFILES_DIR -t $TARGET $MODULE

# Validate symlinks were created
echo ""
echo "Verifying symlinks..."
set ERRORS 0

if test -L "$TARGET/.claude/CLAUDE.md"
    echo "✓ CLAUDE.md symlink created"
    echo "  "(ls -la "$TARGET/.claude/CLAUDE.md")
else
    echo "✗ Error: CLAUDE.md symlink not created"
    set ERRORS (math $ERRORS + 1)
end

for subdir in code-standards languages tools
    set SUB_SOURCE "$DOTFILES_DIR/$MODULE/.claude/rules/$subdir"
    set SUB_TARGET "$TARGET/.claude/rules/$subdir"
    if test -d $SUB_SOURCE
        if test -L $SUB_TARGET
            echo "✓ rules/$subdir symlink verified"
        else
            echo "✗ Error: rules/$subdir symlink not created"
            set ERRORS (math $ERRORS + 1)
        end
    end
end

if test -L "$TARGET/.config/ccstatusline/settings.json"
    echo "✓ ccstatusline settings.json symlink created"
    echo "  "(ls -la "$TARGET/.config/ccstatusline/settings.json")
else
    echo "✗ Error: ccstatusline settings.json symlink not created"
    set ERRORS (math $ERRORS + 1)
end

echo ""
if test $ERRORS -eq 0
    echo "✅ All symlinks created successfully!"
    echo ""
    echo "Your configuration is now managed by stow."
    echo "Edit files in: $DOTFILES_DIR/$MODULE/"
    echo "Changes will be reflected immediately in $TARGET"
    exit 0
else
    echo "❌ Failed to create $ERRORS symlink(s)"
    exit 1
end
