#!/usr/bin/env bash
# Event: SessionStart
# Drops a timestamp marker file other hooks use with `find -newer` to scope
# their scans to files touched during THIS session.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

main() {
  local session_id marker

  session_id=$(jq -r '.session_id // empty')
  [ -z "$session_id" ] && exit 0

  marker=$(start_marker_path "$session_id")

  # SessionStart also fires on resume/clear; keeping the earliest marker
  # preserves the full session window for the -newer scans.
  mkdir -p "$HOOK_STATE_DIR"
  [ -f "$marker" ] || touch "$marker"
}

main
