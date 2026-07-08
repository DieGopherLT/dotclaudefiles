#!/usr/bin/env bash
# Event: Stop
# Scans the session transcript for repeated tool failures and, when a pattern
# shows the agent fought something until fixing it, suggests the remember skill
# so the gotcha survives into future sessions.
#
# Signal-over-noise rules (the whole point of this hook):
# - Only Bash and MCP tool failures count. Read/Glob/Grep misses are normal
#   exploratory probing; Edit old_string misses are mechanical retries.
# - Permission denials are user decisions, not gotchas.
# - A single failure is transient; the signal is >= MIN_REPEATS failures of the
#   same command family (same executable) within one session.
# - Fires at most once per session. Stop runs at the end of EVERY turn, and a
#   suggestion repeated every turn trains the agent to ignore it.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

[ "$STOP_HOOK_ACTIVE" = "true" ] && exit 0
[ -z "$SESSION_ID" ] && exit 0
[ -s "$TRANSCRIPT_PATH" ] || exit 0

MARKER="${SESSION_ID}.failure-scan-suggested"
marker_present "$MARKER" && exit 0

MIN_REPEATS=$(config_value '.failure_min_repeats' 2)

# Failed tool_results live in type=="user" lines with is_error==true; the tool
# name and command only live in the originating assistant tool_use, so the scan
# joins both sides through tool_use_id.
REPEATED_FAILURES=$(jq -rn --argjson min_repeats "$MIN_REPEATS" '
  [inputs] as $lines
  | ($lines
     | map(select(.type == "assistant")
           | .message.content[]?
           | select(type == "object" and .type == "tool_use")
           | {key: .id, value: {name, command: (.input.command // "")}})
     | from_entries) as $uses
  | [ $lines[]
      | select(.type == "user")
      | .message.content[]?
      | select(type == "object" and .type == "tool_result" and .is_error == true)
      | . as $result
      | ($uses[$result.tool_use_id] // empty)
      | select(.name == "Bash" or (.name | startswith("mcp__")))
      | { family: (if .name == "Bash" then (.command | split(" ")[0]) else .name end),
          error: ($result.content
                  | if type == "array"
                    then (map(select(type == "object" and .type == "text") | .text) | join(" "))
                    else tostring
                    end
                  | gsub("</?tool_use_error>"; "")
                  | .[0:150]) }
      | select(.error | test("does not want to proceed|doesn.t want to proceed|user rejected"; "i") | not)
    ]
  | group_by(.family)
  | map({family: .[0].family, count: length, samples: (map(.error) | unique | .[0:3])})
  | map(select(.count >= $min_repeats))
  | sort_by(-.count)
  | .[0:10]
  | map("- \(.family) failed \(.count) times: \(.samples | join(" | "))")
  | join("\n")
' "$TRANSCRIPT_PATH")

[ -z "$REPEATED_FAILURES" ] && exit 0

# Marker only set when a suggestion actually fires — earlier turns without a
# qualifying pattern must stay eligible as failures accumulate.
set_marker "$MARKER"

emit_additional_context "Stop" \
"This session had repeated tool failures of the same command family:
${REPEATED_FAILURES}

If any of these was a non-obvious gotcha you fixed along the way (not a transient or expected error), invoke the remember skill to persist it so future sessions do not trip on it again. If none is worth keeping, ignore this and finish normally."
