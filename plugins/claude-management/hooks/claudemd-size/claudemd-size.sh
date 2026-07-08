#!/usr/bin/env bash
# Event: PostToolUse (matcher: Edit|Write)
# When an edit leaves a CLAUDE.md above the line ceiling, suggest running the
# rulify skill on it. Suggestion only — enforcement is deliberately out of
# scope: the goal is that the file heals itself, not blocking the agent.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

main() {
  local session_id file_path ceiling line_count marker tsv_line

  # Split with `cut -f`, not `IFS=$'\t' read -r`: tab is always treated as IFS
  # whitespace in bash regardless of what IFS is set to, so `read` would
  # collapse consecutive tabs and silently drop an empty field.
  tsv_line=$(jq -r '[.session_id // "", .tool_input.file_path // ""] | @tsv')
  session_id=$(cut -f1 <<< "$tsv_line")
  file_path=$(cut -f2 <<< "$tsv_line")

  [ -z "$session_id" ] && exit 0
  [ -z "$file_path" ] && exit 0
  [ "$(basename "$file_path")" != "CLAUDE.md" ] && exit 0
  [ -f "$file_path" ] || exit 0

  ceiling=$(config_positive_int '.claudemd_ceiling' 200)
  line_count=$(wc -l < "$file_path" | tr -d ' ')
  [ "$line_count" -le "$ceiling" ] && exit 0

  # Once per file per session — without this, rulify's own intermediate edits
  # to the CLAUDE.md it is splitting would re-trigger the suggestion.
  marker="${session_id}.claudemd-$(path_fingerprint "$file_path")"
  marker_present "$marker" && exit 0
  set_marker "$marker"

  emit_additional_context "PostToolUse" \
"${file_path} is now at ${line_count} lines, above the ${ceiling}-line ceiling where CLAUDE.md attention starts to dilute. Invoke the rulify skill on it to extract scoped sections into on-demand .claude/rules/ files."
}

main
