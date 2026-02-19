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

# Backup and remove existing files (if they exist and are not symlinks)
# This ensures the module version is always used (module is source of truth)

BACKED_UP=0

# Check CLAUDE.md
if [ -f "${TARGET}/.claude/CLAUDE.md" ] && [ ! -L "${TARGET}/.claude/CLAUDE.md" ]; then
    BACKUP_FILE="${TARGET}/.claude/CLAUDE.md.backup.${BACKUP_TIMESTAMP}"
    echo "📦 Backing up existing CLAUDE.md..."
    mv "${TARGET}/.claude/CLAUDE.md" "$BACKUP_FILE"
    echo "   Saved to: $BACKUP_FILE"
    BACKED_UP=$((BACKED_UP + 1))
fi

# Check ccstatusline settings
if [ -f "${TARGET}/.config/ccstatusline/settings.json" ] && [ ! -L "${TARGET}/.config/ccstatusline/settings.json" ]; then
    BACKUP_FILE="${TARGET}/.config/ccstatusline/settings.json.backup.${BACKUP_TIMESTAMP}"
    echo "📦 Backing up existing ccstatusline settings..."
    mv "${TARGET}/.config/ccstatusline/settings.json" "$BACKUP_FILE"
    echo "   Saved to: $BACKUP_FILE"
    BACKED_UP=$((BACKED_UP + 1))
fi

if [ $BACKED_UP -gt 0 ]; then
    echo ""
    echo "ℹ️  $BACKED_UP file(s) backed up. The module version will be used (module is source of truth)."
    echo ""
fi

RULES_SOURCE="${DOTFILES_DIR}/${MODULE}/.claude/rules"
RULES_TARGET="${TARGET}/.claude/rules"

# Ensure rules/ exists as a real directory
mkdir -p "${RULES_TARGET}"

# Remove stale broken file symlinks from old structure
for f in css.md go.md html-semantics.md react.md ts.md; do
    if [ -L "${RULES_TARGET}/${f}" ] && [ ! -e "${RULES_TARGET}/${f}" ]; then
        rm "${RULES_TARGET}/${f}"
        echo "Removed stale symlink: rules/${f}"
    fi
done

# Create symlinks for each managed subdirectory inside rules/
for subdir in code-standards languages tools; do
    sub_source="${RULES_SOURCE}/${subdir}"
    sub_target="${RULES_TARGET}/${subdir}"
    if [ -d "${sub_source}" ]; then
        if [ -L "${sub_target}" ]; then
            echo "✓ rules/${subdir} symlink already exists"
        elif [ -d "${sub_target}" ]; then
            echo "⚠️  rules/${subdir} exists as real directory, backing up..."
            mv "${sub_target}" "${sub_target}.backup.${BACKUP_TIMESTAMP}"
            ln -s "${sub_source}" "${sub_target}"
            echo "✓ rules/${subdir} symlink created"
        else
            ln -s "${sub_source}" "${sub_target}"
            echo "✓ rules/${subdir} symlink created"
        fi
    fi
done

echo ""

# Execute stow (without --adopt to preserve module version)
echo "Running stow..."
stow -d "$DOTFILES_DIR" -t "$TARGET" "$MODULE"

# Validate symlinks were created
echo ""
echo "Verifying symlinks..."
ERRORS=0

if [ -L "${TARGET}/.claude/CLAUDE.md" ]; then
    echo "✓ CLAUDE.md symlink created"
    echo "  $(ls -la "${TARGET}/.claude/CLAUDE.md")"
else
    echo "✗ Error: CLAUDE.md symlink not created"
    ERRORS=$((ERRORS + 1))
fi

if [ -L "${TARGET}/.config/ccstatusline/settings.json" ]; then
    echo "✓ ccstatusline settings.json symlink created"
    echo "  $(ls -la "${TARGET}/.config/ccstatusline/settings.json")"
else
    echo "✗ Error: ccstatusline settings.json symlink not created"
    ERRORS=$((ERRORS + 1))
fi

for subdir in code-standards languages tools; do
    sub_source="${DOTFILES_DIR}/${MODULE}/.claude/rules/${subdir}"
    sub_target="${TARGET}/.claude/rules/${subdir}"
    if [ -d "${sub_source}" ]; then
        if [ -L "${sub_target}" ]; then
            echo "✓ rules/${subdir} symlink verified"
        else
            echo "✗ Error: rules/${subdir} symlink not created"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All symlinks created successfully!"
    echo ""
    echo "Your configuration is now managed by stow."
    echo "Edit files in: $DOTFILES_DIR/$MODULE/"
    echo "Changes will be reflected immediately in $TARGET"
    exit 0
else
    echo "❌ Failed to create $ERRORS symlink(s)"
    exit 1
fi
