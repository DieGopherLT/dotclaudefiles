#!/usr/bin/env bash
# PreToolUse hook: nudges Grep/Glob/grep-flavored Bash calls that look like symbol
# lookups toward the LSP tool, but only when an LSP plugin is actually installed
# for a language present in the project. Escalation tracks the session transcript
# instead of a blind counter: block until the LSP tool is loaded, warn once when
# it's loaded but unused, go silent for the rest of the session once it's warned
# or once it's actually been used.
#
# Every terminal outcome (no LSP available, already warned, already used) is
# cached in a session-scoped marker so the expensive work -- the project-wide
# extension scan and the transcript parse -- runs at most once per session
# instead of on every single matched Grep/Glob/grep call.
#
# Design constraint: a nudge hook must never break a turn on its own bug -- any
# unexpected failure degrades to "allow, no output" instead of surfacing a hook
# error or blocking real work.
set -euo pipefail
trap 'exit 0' ERR

INPUT=$(cat)

TOOL_NAME=$(jq -r '.tool_name // ""' <<<"$INPUT")
SESSION_ID=$(jq -r '.session_id // ""' <<<"$INPUT")
TRANSCRIPT_PATH=$(jq -r '.transcript_path // ""' <<<"$INPUT")
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // "."' <<<"$INPUT")}"

SYMBOL_REGEX='\b(const|class|struct|function|func|def|interface|type|enum|trait|impl|namespace)\b'

case "$TOOL_NAME" in
  Grep|Glob)
    SEARCH_STRING=$(jq -r '.tool_input.pattern // ""' <<<"$INPUT")
    ;;
  Bash)
    SEARCH_STRING=$(jq -r '.tool_input.command // ""' <<<"$INPUT")
    grep -qE '\bgrep\b' <<<"$SEARCH_STRING" || exit 0
    ;;
  *)
    exit 0
    ;;
esac

# Gate 1: only symbol-declaration-shaped searches are worth an LSP nudge.
grep -qE "$SYMBOL_REGEX" <<<"$SEARCH_STRING" || exit 0

# Session-scoped cache, not project state -- intentionally outside $CLAUDE_PROJECT_DIR.
MARKER_DIR="/tmp/claude-hooks"
MARKER_PREFIX="${MARKER_DIR}/${SESSION_ID}-lsp-nudge"
USED_MARKER="${MARKER_PREFIX}-used"
WARNED_MARKER="${MARKER_PREFIX}-warned"
NO_MATCH_MARKER="${MARKER_PREFIX}-no-match"
MATCH_CACHE="${MARKER_PREFIX}-match"

# Every one of these is a terminal outcome for the rest of the session -- once
# any of them exists, skip straight past both the extension scan and the
# transcript parse instead of redoing them on every matched call.
[ -f "$USED_MARKER" ] && exit 0
[ -f "$WARNED_MARKER" ] && exit 0
[ -f "$NO_MATCH_MARKER" ] && exit 0

declare -A EXT_TO_LANGUAGE=(
  [go]="Go" [ts]="TypeScript" [tsx]="TypeScript" [js]="TypeScript" [jsx]="TypeScript"
  [py]="Python" [cs]="C#" [c]="C/C++" [h]="C/C++" [cpp]="C/C++" [cc]="C/C++" [hpp]="C/C++"
  [java]="Java" [kt]="Kotlin" [kts]="Kotlin" [lua]="Lua" [php]="PHP" [rs]="Rust" [swift]="Swift"
)
declare -A LANGUAGE_TO_PLUGIN=(
  [Go]="gopls-lsp" [TypeScript]="typescript-lsp" [Python]="pyright-lsp" ["C#"]="csharp-lsp"
  ["C/C++"]="clangd-lsp" [Java]="jdtls-lsp" [Kotlin]="kotlin-lsp" [Lua]="lua-lsp"
  [PHP]="php-lsp" [Rust]="rust-analyzer-lsp" [Swift]="swift-lsp"
)

is_plugin_enabled() {
  # is_plugin_enabled <plugin-prefix>
  # Checks local -> project -> global settings, in that precedence order, for the
  # first explicit true/false on a "<prefix>@<marketplace>" key.
  local prefix="$1" settings_file value
  for settings_file in \
    "${PROJECT_DIR}/.claude/settings.local.json" \
    "${PROJECT_DIR}/.claude/settings.json" \
    "${HOME}/.claude/settings.json"
  do
    [ -f "$settings_file" ] || continue
    value=$(jq -r --arg prefix "$prefix" \
      '(.enabledPlugins // {}) | to_entries[] | select(.key | startswith($prefix + "@")) | .value' \
      "$settings_file" 2>/dev/null | head -1)
    [ "$value" = "true" ] && return 0
    [ "$value" = "false" ] && return 1
  done
  return 1
}

# Gate 2: an LSP plugin must actually be installed for a language present in
# the project. Cache the outcome (match or no-match) the first time it's
# computed -- the project's language mix and enabled plugins don't change
# mid-session, so the filesystem walk below only ever needs to run once.
if [ -f "$MATCH_CACHE" ]; then
  IFS=$'\t' read -r MATCHED_LANGUAGE MATCHED_PLUGIN < "$MATCH_CACHE"
else
  EXT_PATTERN=$(printf '%s\n' "${!EXT_TO_LANGUAGE[@]}" | paste -sd '|' -)
  declare -A LANGUAGE_COUNTS=()
  while IFS= read -r ext; do
    [ -z "$ext" ] && continue
    language="${EXT_TO_LANGUAGE[$ext]:-}"
    [ -z "$language" ] && continue
    LANGUAGE_COUNTS[$language]=$(( ${LANGUAGE_COUNTS[$language]:-0} + 1 ))
  done < <(find "$PROJECT_DIR" -type f \
      -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/vendor/*' \
      -not -path '*/dist/*' -not -path '*/build/*' 2>/dev/null \
    | grep -E "\.(${EXT_PATTERN})$" \
    | sed -E 's/.*\.([^.]+)$/\1/')

  MATCHED_LANGUAGE=""
  MATCHED_PLUGIN=""
  BEST_COUNT=0
  for language in "${!LANGUAGE_COUNTS[@]}"; do
    plugin="${LANGUAGE_TO_PLUGIN[$language]:-}"
    [ -z "$plugin" ] && continue
    is_plugin_enabled "$plugin" || continue
    count="${LANGUAGE_COUNTS[$language]}"
    if [ "$count" -gt "$BEST_COUNT" ]; then
      MATCHED_LANGUAGE="$language"
      MATCHED_PLUGIN="$plugin"
      BEST_COUNT="$count"
    fi
  done

  mkdir -p "$MARKER_DIR"
  if [ -z "$MATCHED_LANGUAGE" ]; then
    touch "$NO_MATCH_MARKER"
    exit 0
  fi
  printf '%s\t%s\n' "$MATCHED_LANGUAGE" "$MATCHED_PLUGIN" > "$MATCH_CACHE"
fi

# Gate 3: escalate based on what this session's transcript already shows -- the
# LSP tool is deferred, so "loaded" means a ToolSearch call surfaced it, and
# "used" means it was actually invoked (name == "LSP", confirmed against a real
# transcript: it's called with an `operation` field, e.g. workspaceSymbol).
USED=false
LOADED=false
if [ -f "$TRANSCRIPT_PATH" ]; then
  while IFS=$'\t' read -r name query; do
    if [ "$name" = "LSP" ]; then
      USED=true
      break
    fi
    if [ "$name" = "ToolSearch" ] && grep -qi 'lsp' <<<"$query"; then
      LOADED=true
    fi
  done < <(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | [.name, (.input.query // "")] | @tsv' "$TRANSCRIPT_PATH" 2>/dev/null)
fi

if [ "$USED" = true ]; then
  mkdir -p "$MARKER_DIR"
  touch "$USED_MARKER"
  exit 0
fi

if [ "$LOADED" = true ]; then
  mkdir -p "$MARKER_DIR"
  touch "$WARNED_MARKER"
  jq -n --arg lang "$MATCHED_LANGUAGE" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext: ("The LSP tool is already loaded this session and has a " + $lang + " server available -- call it now (operations like findReferences/workspaceSymbol/goToDefinition/hover/incomingCalls) instead of grepping for this symbol; it resolves the actual definition/usages instead of a text match.")
    }
  }'
  exit 0
fi

jq -n --arg lang "$MATCHED_LANGUAGE" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("This looks like a symbol search over " + $lang + " code, and this project has an LSP plugin available for it. The LSP tool is deferred -- call ToolSearch (e.g. query \"select:LSP\") to load its schema first, then use it (findReferences/workspaceSymbol/goToDefinition/hover/incomingCalls) instead of grep for this query.")
  }
}'
exit 0
