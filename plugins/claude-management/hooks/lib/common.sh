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
  # Project config is optional; defaults are baked into each hook.
  local jq_path="$1" default_value="$2"
  local config_file="${CLAUDE_PROJECT_DIR:-.}/${CONFIG_RELATIVE_PATH}"

  if [ -f "$config_file" ]; then
    jq -r "${jq_path} // ${default_value}" "$config_file"
  else
    echo "$default_value"
  fi
}

config_array() {
  # config_array <jq-path> <default-json-array>
  # Prints one element per line.
  local jq_path="$1" default_json="$2"
  local config_file="${CLAUDE_PROJECT_DIR:-.}/${CONFIG_RELATIVE_PATH}"

  if [ -f "$config_file" ]; then
    jq -r "(${jq_path} // ${default_json}) | .[]" "$config_file"
  else
    jq -nr "${default_json} | .[]"
  fi
}

marker_present() {
  [ -f "${HOOK_STATE_DIR}/$1" ]
}

set_marker() {
  mkdir -p "$HOOK_STATE_DIR"
  touch "${HOOK_STATE_DIR}/$1"
}

path_fingerprint() {
  # Stable short id for per-file/per-dir markers.
  printf '%s' "$1" | md5sum | cut -c1-12
}

emit_additional_context() {
  # emit_additional_context <hook-event-name> <context-text>
  jq -n --arg event "$1" --arg context "$2" \
    '{hookSpecificOutput: {hookEventName: $event, additionalContext: $context}}'
}
