#!/usr/bin/env bash
# Event: Stop
# Classifies the session as "harvestable" (big transcript with substantial
# generated work — the kind whose transcript contains mechanical flows worth
# stabilizing) and queues its transcript. When the queue reaches the threshold,
# notifies the user (systemMessage) that the queue is ready — running stabilize
# is the user's call, never this hook's.
#
# The queue is keyed by the git common dir so sessions run inside worktrees
# accumulate into the SAME queue as the main checkout.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

main() {
  local queue_file pending_count threshold

  read_hook_input
  stop_guards_pass || exit 0
  [ -s "$HOOK_TRANSCRIPT_PATH" ] || exit 0
  marker_present "${HOOK_SESSION_ID}.harvest-appended" && exit 0

  session_is_harvestable "$HOOK_TRANSCRIPT_PATH" || exit 0

  queue_file=$(queue_file_for_repo "$HOOK_CWD")
  append_to_queue "$queue_file" "$HOOK_TRANSCRIPT_PATH"
  set_marker "${HOOK_SESSION_ID}.harvest-appended"

  pending_count=$(jq '.pending | length' "$queue_file")
  threshold=$(config_positive_int '.harvest.queue_threshold' 7)
  [ "$pending_count" -lt "$threshold" ] && exit 0

  emit_system_message \
"claude-management: the stabilize queue for this repository reached ${pending_count} harvestable session transcript(s) (threshold: ${threshold}). Run the stabilize skill whenever you want to mine them for recurring flows, conventions, and corrections. Queue file: ${queue_file}."
}

session_is_harvestable() {
  # Harvestable = big transcript (cheap byte pre-filter) AND substantial work:
  # enough generated output AND enough tool activity. Thresholds mined
  # empirically from real transcripts (substantial sessions >= 14k output
  # tokens; long Q&A stays <= 8k regardless of size or tool count). The 10k
  # default deliberately sits inside that empirical gap, as margin against
  # drift on both sides.
  local transcript_path="$1" transcript_bytes min_bytes min_output_tokens min_tool_uses

  min_bytes=$(config_positive_int '.harvest.min_transcript_bytes' 300000)
  transcript_bytes=$(wc -c < "$transcript_path" | tr -d ' ')
  [ "$transcript_bytes" -lt "$min_bytes" ] && return 1

  min_output_tokens=$(config_positive_int '.harvest.min_output_tokens' 10000)
  min_tool_uses=$(config_positive_int '.harvest.min_tool_uses' 12)

  jq -n --argjson min_tokens "$min_output_tokens" \
        --argjson min_tools "$min_tool_uses" '
    [inputs] as $lines
    # Assistant messages are split across several JSONL lines per content
    # block, each repeating .message.usage.output_tokens for the same
    # .message.id — dedupe by id (taking max) before summing, or the total
    # inflates by the block count. If harvest stops queueing anything,
    # reconfirm this schema still holds before touching thresholds.
    | ($lines
       | map(select(.type == "assistant" and .message.id != null)
             | {id: .message.id, tokens: (.message.usage.output_tokens // 0)})
       | group_by(.id) | map(map(.tokens) | max) | add // 0) as $output_tokens
    # Content blocks are not repeated across the split lines (one block per
    # line), so counting tool_use blocks directly is duplicate-free.
    | ($lines
       | [.[] | select(.type == "assistant") | .message.content[]?
          | select(type == "object" and .type == "tool_use")]
       | length) as $tool_uses
    | if ($output_tokens >= $min_tokens) and ($tool_uses >= $min_tools)
      then empty else error("not harvestable") end
  ' "$transcript_path" >/dev/null 2>&1
}

queue_file_for_repo() {
  # One queue per repository; worktrees resolve to the main repo through the
  # git common dir. Non-git directories fall back to the cwd itself. The key
  # appends a checksum of repo_root because `tr '/' '-'` alone is not
  # injective (e.g. /u/a/b and /u/a-b would collide on the same queue file).
  local cwd="$1" repo_root key
  repo_root=$(dirname "$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")
  case "$repo_root" in
    ''|.) repo_root="$cwd" ;;
  esac

  key="$(echo "$repo_root" | tr '/' '-')-$(printf '%s' "$repo_root" | cksum | cut -d' ' -f1)"

  mkdir -p "$HARVEST_STATE_DIR"
  echo "${HARVEST_STATE_DIR}/${key}.json"
}

append_to_queue() {
  local queue_file="$1" transcript_path="$2"

  [ -f "$queue_file" ] || echo '{"pending": [], "last_stabilize": null}' > "$queue_file"

  # Atomic rewrite; dedupe keeps re-runs of the same session idempotent.
  jq --arg path "$transcript_path" \
     '.pending |= (. + [$path] | unique)' \
     "$queue_file" > "${queue_file}.tmp"
  mv "${queue_file}.tmp" "$queue_file"
}

main
