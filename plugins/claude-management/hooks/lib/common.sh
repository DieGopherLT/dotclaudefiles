#!/usr/bin/env bash
# Shared helpers for claude-management hooks.
#
# Design constraint: a suggestion hook must never break a turn. Callers install
# `trap 'exit 0' ERR` so any unexpected failure degrades to "no suggestion"
# instead of surfacing a hook error in the session.

HOOK_STATE_DIR="/tmp/claude-hooks"

# Cross-session state (harvest queue) lives outside /tmp so it survives reboots.
HARVEST_STATE_DIR="${HOME}/.claude/claude-management/harvest"

CONFIG_RELATIVE_PATH=".claude/claude-management.local.json"

config_value() {
  # config_value <jq-path> <default-scalar>
  # Project config is optional; defaults are baked into each hook. A malformed
  # config file (e.g. a trailing comma) must degrade to the default rather
  # than aborting the hook through `set -e`.
  local jq_path="$1" default_value="$2"
  local config_file="${CLAUDE_PROJECT_DIR:-.}/${CONFIG_RELATIVE_PATH}"

  if [ -f "$config_file" ]; then
    jq -r "${jq_path} // ${default_value}" "$config_file" 2>/dev/null || echo "$default_value"
  else
    echo "$default_value"
  fi
}

config_array() {
  # config_array <jq-path> <default-json-array>
  # Prints one element per line. Malformed config degrades to the default array.
  local jq_path="$1" default_json="$2"
  local config_file="${CLAUDE_PROJECT_DIR:-.}/${CONFIG_RELATIVE_PATH}"

  if [ -f "$config_file" ]; then
    jq -r "(${jq_path} // ${default_json}) | .[]" "$config_file" 2>/dev/null \
      || jq -nr "${default_json} | .[]"
  else
    jq -nr "${default_json} | .[]"
  fi
}

config_positive_int() {
  # config_positive_int <jq-path> <default-int>
  # config_value already degrades a malformed config file to the default; this
  # further guards against a well-formed but non-numeric or non-positive value
  # (a string, zero, or a negative number) that would break the `-lt`/`-ge`
  # numeric comparisons at every call site.
  local jq_path="$1" default_value="$2" value
  value=$(config_value "$jq_path" "$default_value")

  case "$value" in
    [1-9]|[1-9][0-9]*) echo "$value" ;;
    *) echo "$default_value" ;;
  esac
}

marker_present() {
  [ -f "${HOOK_STATE_DIR}/$1" ]
}

set_marker() {
  mkdir -p "$HOOK_STATE_DIR"
  touch "${HOOK_STATE_DIR}/$1"
}

start_marker_path() {
  # start_marker_path <session_id>
  # Shared by session-marker.sh (writer, on SessionStart) and
  # contextualizable-dirs.sh (reader, via `find -newer`).
  echo "${HOOK_STATE_DIR}/$1.start-marker"
}

path_fingerprint() {
  # Stable short id for per-file/per-dir markers. Uses POSIX cksum instead of
  # md5sum, which is GNU-only and absent from BSD/macOS coreutils.
  printf '%s' "$1" | cksum | cut -d' ' -f1
}

read_hook_input() {
  # Parses stdin ONCE with a single jq call into globals shared by the three
  # Stop-event hooks, instead of each hook re-piping the same JSON through jq
  # once per field. Split with `cut -f`, not `IFS=$'\t' read -r`: tab is always
  # treated as IFS whitespace in bash regardless of what IFS is set to, so
  # `read` collapses consecutive tabs and silently drops empty fields (e.g. a
  # missing "cwd") — `cut` splits on every literal tab instead.
  local tsv_line
  tsv_line=$(jq -r '[.session_id // "", .cwd // "", .transcript_path // "", .stop_hook_active // false] | @tsv')
  HOOK_SESSION_ID=$(cut -f1 <<< "$tsv_line")
  HOOK_CWD=$(cut -f2 <<< "$tsv_line")
  HOOK_TRANSCRIPT_PATH=$(cut -f3 <<< "$tsv_line")
  HOOK_STOP_ACTIVE=$(cut -f4 <<< "$tsv_line")
}

stop_guards_pass() {
  # Shared Stop-hook guard: skip re-entrant Stop invocations (stop_hook_active)
  # and payloads missing a session id. Each hook layers its own extra guards
  # (transcript -s check, cwd -d check) on top of this.
  [ "$HOOK_STOP_ACTIVE" = "true" ] && return 1
  [ -z "$HOOK_SESSION_ID" ] && return 1
  return 0
}

emit_additional_context() {
  # emit_additional_context <hook-event-name> <context-text>
  # additionalContext on Stop was verified against the hooks guide; if a future
  # Claude Code release stops delivering it there, the fallback is emitting a
  # top-level {"systemMessage": ...} instead.
  jq -n --arg event "$1" --arg context "$2" \
    '{hookSpecificOutput: {hookEventName: $event, additionalContext: $context}}'
}
