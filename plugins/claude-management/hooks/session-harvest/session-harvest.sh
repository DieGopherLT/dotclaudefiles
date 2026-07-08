#!/usr/bin/env bash
# Event: Stop
# Classifies the session as "harvestable" (long and mostly autonomous — the kind
# whose transcript contains mechanical flows worth stabilizing) and queues its
# transcript. When the queue reaches the threshold, suggests launching the
# stabilize skill, which consumes the queue.
#
# The queue is keyed by the git common dir so sessions run inside worktrees
# accumulate into the SAME queue as the main checkout.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

main() {
  local input session_id cwd transcript_path stop_hook_active

  input=$(cat)
  session_id=$(echo "$input" | jq -r '.session_id // empty')
  cwd=$(echo "$input" | jq -r '.cwd // empty')
  transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
  stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

  [ "$stop_hook_active" = "true" ] && exit 0
  [ -z "$session_id" ] && exit 0
  [ -s "$transcript_path" ] || exit 0
  marker_present "${session_id}.harvest-appended" && exit 0

  session_is_harvestable "$transcript_path" || exit 0

  local queue_file pending_count
  queue_file=$(queue_file_for_repo "$cwd")
  append_to_queue "$queue_file" "$transcript_path"
  set_marker "${session_id}.harvest-appended"

  pending_count=$(jq '.pending | length' "$queue_file")
  local threshold
  threshold=$(config_value '.harvest.queue_threshold' 3)
  [ "$pending_count" -lt "$threshold" ] && exit 0

  emit_additional_context "Stop" \
"The stabilize queue for this repository reached ${pending_count} harvestable session transcript(s) (threshold: ${threshold}). Launch the stabilize skill as a background task: it digests the queued transcripts, mines recurring flows and conventions, verifies them, and materializes the survivors as project-level skills or rules. The queue lives at ${queue_file} and stabilize consumes it."
}

session_is_harvestable() {
  # Harvestable = big transcript AND (a plan was approved OR few human
  # messages relative to the work — the autonomy signature).
  local transcript_path="$1" transcript_bytes min_bytes max_user_messages

  min_bytes=$(config_value '.harvest.min_transcript_bytes' 300000)
  transcript_bytes=$(stat -c%s "$transcript_path")
  [ "$transcript_bytes" -lt "$min_bytes" ] && return 1

  max_user_messages=$(config_value '.harvest.max_user_messages' 8)

  jq -n --argjson max_user "$max_user_messages" '
    [inputs] as $lines
    | ($lines | any(.type == "assistant"
                    and (.message.content[]?
                         | type == "object" and .type == "tool_use" and .name == "ExitPlanMode"))) as $plan_approved
    | ($lines
       | map(select(.type == "user" and (.message.content | type == "string"))
             | .message.content
             | select(startswith("Another Claude session sent a message:") | not)
             | select(contains("<local-command") | not)
             | select(startswith("[Request interrupted") | not))
       | length) as $user_messages
    | if $plan_approved or ($user_messages <= $max_user) then empty else error("not harvestable") end
  ' "$transcript_path" >/dev/null 2>&1
}

queue_file_for_repo() {
  # One queue per repository; worktrees resolve to the main repo through the
  # git common dir. Non-git directories fall back to the cwd itself.
  local cwd="$1" repo_root
  repo_root=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | xargs -r dirname)
  [ -z "$repo_root" ] && repo_root="$cwd"

  mkdir -p "$HARVEST_STATE_DIR"
  echo "${HARVEST_STATE_DIR}/$(echo "$repo_root" | tr '/' '-').json"
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
