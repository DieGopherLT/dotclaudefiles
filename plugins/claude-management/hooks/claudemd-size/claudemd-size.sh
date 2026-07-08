#!/usr/bin/env bash
# Event: PostToolUse (matcher: Edit|Write)
# When an edit leaves a CLAUDE.md above the line ceiling, suggest running the
# rulify skill on it. Suggestion only — enforcement is deliberately out of
# scope: the goal is that the file heals itself, not blocking the agent.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$SESSION_ID" ] && exit 0
[ -z "$FILE_PATH" ] && exit 0
[ "$(basename "$FILE_PATH")" != "CLAUDE.md" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0

CEILING=$(config_value '.claudemd_ceiling' 200)
LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')
[ "$LINE_COUNT" -le "$CEILING" ] && exit 0

# Once per file per session — without this, rulify's own intermediate edits to
# the CLAUDE.md it is splitting would re-trigger the suggestion.
MARKER="${SESSION_ID}.claudemd-$(path_fingerprint "$FILE_PATH")"
marker_present "$MARKER" && exit 0
set_marker "$MARKER"

emit_additional_context "PostToolUse" \
"${FILE_PATH} is now at ${LINE_COUNT} lines, above the ${CEILING}-line ceiling where CLAUDE.md attention starts to dilute. Invoke the rulify skill on it to extract scoped sections into on-demand .claude/rules/ files."
