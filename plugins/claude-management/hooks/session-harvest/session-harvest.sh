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

# These substrings are coupled to Claude Code's internal transcript formatting
# for synthetic/injected user turns. If harvest classification stops firing
# (the autonomy signal always sees too many "user" messages), reconfirm these
# markers still match the current transcript format before changing anything
# else.
TEAMMATE_PREFIX="Another Claude session sent a message:"
LOCAL_COMMAND_MARKER="<local-command"
INTERRUPT_PREFIX="[Request interrupted"

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

  emit_additional_context "Stop" \
"The stabilize queue for this repository reached ${pending_count} harvestable session transcript(s) (threshold: ${threshold}). Launch the stabilize skill as a background task: it digests the queued transcripts, mines recurring flows and conventions, verifies them, and materializes the survivors as project-level skills or rules. The queue lives at ${queue_file} and stabilize consumes it."
}

session_is_harvestable() {
  # Harvestable = big transcript AND (a plan was approved OR few human
  # messages relative to the work — the autonomy signature).
  local transcript_path="$1" transcript_bytes min_bytes max_user_messages

  min_bytes=$(config_positive_int '.harvest.min_transcript_bytes' 300000)
  transcript_bytes=$(wc -c < "$transcript_path" | tr -d ' ')
  [ "$transcript_bytes" -lt "$min_bytes" ] && return 1

  max_user_messages=$(config_positive_int '.harvest.max_user_messages' 8)

  jq -n --argjson max_user "$max_user_messages" \
        --arg teammate_prefix "$TEAMMATE_PREFIX" \
        --arg local_command_marker "$LOCAL_COMMAND_MARKER" \
        --arg interrupt_prefix "$INTERRUPT_PREFIX" '
    [inputs] as $lines
    | ($lines | any(.type == "assistant"
                    and (.message.content[]?
                         | type == "object" and .type == "tool_use" and .name == "ExitPlanMode"))) as $plan_approved
    | ($lines
       | map(select(.type == "user" and (.message.content | type == "string"))
             | .message.content
             | select(startswith($teammate_prefix) | not)
             | select(contains($local_command_marker) | not)
             | select(startswith($interrupt_prefix) | not))
       | length) as $user_messages
    | if $plan_approved or ($user_messages <= $max_user) then empty else error("not harvestable") end
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
