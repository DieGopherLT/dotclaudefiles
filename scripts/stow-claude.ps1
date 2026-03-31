#Requires -Version 7.0

<#
.SYNOPSIS
    Creates symbolic links for Claude Code configuration on Windows
.DESCRIPTION
    This script creates symbolic links from the dotfiles/claude directory
    to the Windows Claude Code configuration directory (~/.claude)
.NOTES
    Requires Administrator privileges to create symbolic links on Windows
    Compatible with PowerShell 7.0+
#>

# Stop on any error
$ErrorActionPreference = "Stop"

# Get the directory where this script lives (PS7+ uses $PSScriptRoot)
$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $ScriptDir
$DotfilesDir = Join-Path $RepoRoot "dotfiles"
$Module = "claude"
$SourceDir = Join-Path $DotfilesDir $Module
$TargetBase = $env:USERPROFILE
$BackupTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Check if running as Administrator
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "ERROR: This script requires Administrator privileges to create symbolic links." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Verify dotfiles directory exists
if (-not (Test-Path $DotfilesDir)) {
    Write-Host "Error: Dotfiles directory not found at $DotfilesDir" -ForegroundColor Red
    exit 1
}

# Verify module exists
if (-not (Test-Path $SourceDir)) {
    Write-Host "Error: Module $Module not found in $DotfilesDir" -ForegroundColor Red
    exit 1
}

Write-Host "Setting up symbolic links for $Module..." -ForegroundColor Cyan
Write-Host "Source: $SourceDir"
Write-Host "Target: $TargetBase"
Write-Host ""

# ============================================================
# Prevent disaster: ensure critical directories are real, not symlinks
# ============================================================

$ClaudeTarget = Join-Path $TargetBase ".claude"
$CcStatusLineTarget = Join-Path $TargetBase ".config\ccstatusline"

# Check if Claude directory is a symlink to a directory (THE DISASTER SCENARIO)
if ((Test-Path $ClaudeTarget) -and ((Get-Item $ClaudeTarget -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $LinkTarget = (Get-Item $ClaudeTarget -Force).Target
    Write-Host ""
    Write-Host "DANGER: $ClaudeTarget is a symlink to a directory!" -ForegroundColor Red
    Write-Host "   This means ALL Claude Code data is being written to your repo." -ForegroundColor Red
    Write-Host ""
    Write-Host "   Current target: $LinkTarget" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To fix this:" -ForegroundColor Yellow
    Write-Host "   1. Remove-Item '$ClaudeTarget'" -ForegroundColor Yellow
    Write-Host "   2. New-Item -ItemType Directory '$ClaudeTarget'" -ForegroundColor Yellow
    Write-Host "   3. Move runtime files from the old location to $ClaudeTarget" -ForegroundColor Yellow
    Write-Host "   4. Run this script again" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check if ccstatusline directory is a symlink to a directory
if ((Test-Path $CcStatusLineTarget) -and ((Get-Item $CcStatusLineTarget -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $LinkTarget = (Get-Item $CcStatusLineTarget -Force).Target
    Write-Host ""
    Write-Host "DANGER: $CcStatusLineTarget is a symlink to a directory!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Current target: $LinkTarget" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To fix this:" -ForegroundColor Yellow
    Write-Host "   1. Remove-Item '$CcStatusLineTarget'" -ForegroundColor Yellow
    Write-Host "   2. New-Item -ItemType Directory '$CcStatusLineTarget'" -ForegroundColor Yellow
    Write-Host "   3. Run this script again" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Ensure target directories exist as real directories
if (-not (Test-Path $ClaudeTarget)) {
    Write-Host "Creating $ClaudeTarget directory..."
    $null = New-Item -ItemType Directory -Path $ClaudeTarget -Force
}

if (-not (Test-Path $CcStatusLineTarget)) {
    Write-Host "Creating $CcStatusLineTarget directory..."
    $null = New-Item -ItemType Directory -Path $CcStatusLineTarget -Force
}

Write-Host ""

$BackedUp = 0
$RulesSource = Join-Path $SourceDir ".claude\rules"
$RulesTarget = Join-Path $ClaudeTarget "rules"

# CLAUDE.md - must be a symlink, back up if it is a real file
$ClaudeMdTarget = Join-Path $ClaudeTarget "CLAUDE.md"
if ((Test-Path $ClaudeMdTarget) -and -not ((Get-Item $ClaudeMdTarget -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $BackupFile = "$ClaudeMdTarget.backup.$BackupTimestamp"
    Write-Host "Backing up existing CLAUDE.md..." -ForegroundColor Yellow
    Move-Item -Path $ClaudeMdTarget -Destination $BackupFile -Force
    Write-Host "   Saved to: $BackupFile" -ForegroundColor Gray
    $BackedUp++
}

# rules/ - must be a symlink. Back up and remove if it is a real directory
# so we can create a single symlink pointing to the entire dotfiles rules/ tree.
if ((Test-Path $RulesTarget) -and -not ((Get-Item $RulesTarget -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $BackupFile = "$RulesTarget.backup.$BackupTimestamp"
    Write-Host "Backing up existing rules/ directory..." -ForegroundColor Yellow
    Move-Item -Path $RulesTarget -Destination $BackupFile -Force
    Write-Host "   Saved to: $BackupFile" -ForegroundColor Gray
    $BackedUp++
}

# ccstatusline settings.json - must be a symlink, back up if it is a real file
$SettingsTarget = Join-Path $CcStatusLineTarget "settings.json"
$SettingsSource = Join-Path $SourceDir ".config\ccstatusline\settings.json"
if ((Test-Path $SettingsTarget) -and -not ((Get-Item $SettingsTarget -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $BackupFile = "$SettingsTarget.backup.$BackupTimestamp"
    Write-Host "Backing up existing ccstatusline settings..." -ForegroundColor Yellow
    Move-Item -Path $SettingsTarget -Destination $BackupFile -Force
    Write-Host "   Saved to: $BackupFile" -ForegroundColor Gray
    $BackedUp++
}

if ($BackedUp -gt 0) {
    Write-Host ""
    Write-Host "$BackedUp file(s) backed up. The module version will be used (module is source of truth)." -ForegroundColor Cyan
    Write-Host ""
}

# Create symbolic links
Write-Host "Creating symbolic links..." -ForegroundColor Cyan
$Errors = 0

# Define all symlinks to create: Source (in dotfiles) -> Target (in $HOME)
$SymlinksToCreate = @(
    @{
        Source = Join-Path $SourceDir ".claude\CLAUDE.md"
        Target = $ClaudeMdTarget
        Description = "CLAUDE.md"
    },
    @{
        Source = $RulesSource
        Target = $RulesTarget
        Description = "rules/"
    },
    @{
        Source = $SettingsSource
        Target = $SettingsTarget
        Description = "ccstatusline settings.json"
    }
)

foreach ($Link in $SymlinksToCreate) {
    # Verify source exists
    if (-not (Test-Path $Link.Source)) {
        Write-Host "  Error: Source not found: $($Link.Source)" -ForegroundColor Red
        $Errors++
        continue
    }

    # Remove existing symlink so it can be recreated cleanly
    if ((Test-Path $Link.Target) -and ((Get-Item $Link.Target -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Remove-Item -Path $Link.Target -Force
    }

    # Create symlink
    try {
        $null = New-Item -ItemType SymbolicLink -Path $Link.Target -Target $Link.Source -Force
        Write-Host "  $($Link.Description) symlink created" -ForegroundColor Green
    } catch {
        Write-Host "  Error creating symlink for $($Link.Description): $_" -ForegroundColor Red
        $Errors++
    }
}

# Verify symlinks
Write-Host ""
Write-Host "Verifying symlinks..." -ForegroundColor Cyan

foreach ($Link in $SymlinksToCreate) {
    if ((Test-Path $Link.Target) -and ((Get-Item $Link.Target -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        $LinkTarget = (Get-Item $Link.Target -Force).Target
        Write-Host "  $($Link.Description) symlink verified" -ForegroundColor Green
        Write-Host "    $($Link.Target) -> $LinkTarget" -ForegroundColor Gray
    } else {
        Write-Host "  Error: $($Link.Description) symlink not created" -ForegroundColor Red
        $Errors++
    }
}

Write-Host ""
if ($Errors -eq 0) {
    Write-Host "All symlinks created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your configuration is now managed via symbolic links." -ForegroundColor Cyan
    Write-Host "Edit files in: $SourceDir" -ForegroundColor Cyan
    Write-Host "Changes will be reflected immediately in $TargetBase" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Failed to create $Errors symlink(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're running PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host "2. Check that Developer Mode is enabled (Settings > Update & Security > For developers)" -ForegroundColor Yellow
    Write-Host "3. Verify that the source files exist in $SourceDir" -ForegroundColor Yellow
    exit 1
}
