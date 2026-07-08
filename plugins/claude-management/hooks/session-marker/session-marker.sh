#!/usr/bin/env bash
# Event: SessionStart
# Drops a timestamp marker file other hooks use with `find -newer` to scope
# their scans to files touched during THIS session.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
[ -z "$SESSION_ID" ] && exit 0

MARKER="${HOOK_STATE_DIR}/${SESSION_ID}.start-marker"

# SessionStart also fires on resume/clear; keeping the earliest marker preserves
# the full session window for the -newer scans.
mkdir -p "$HOOK_STATE_DIR"
[ -f "$MARKER" ] || touch "$MARKER"

exit 0
