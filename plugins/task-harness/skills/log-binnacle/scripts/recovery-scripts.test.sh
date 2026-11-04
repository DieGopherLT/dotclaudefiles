#!/usr/bin/env bash
# Self-check for find-commit-session.sh and session-tail.sh over fixture transcripts.
set -uo pipefail

scripts=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
export CLAUDE_CONFIG_DIR=$root
mkdir -p "$root/projects/-repo" "$root/projects/-repo--worktree"

failures=0
check() {
  if [[ $2 == "$3" ]]; then echo "ok: $1"; else echo "FAIL: $1"; echo "  want: $3"; echo "  got:  $2"; failures=1; fi
}

tool_result() { printf '{"type":"user","message":{"content":[{"type":"tool_result","content":"%s"}]}}\n' "$1"; }

{
  printf '{"type":"user","message":{"content":"elige la opcion A"}}\n'
  printf '{"type":"user","isMeta":true,"message":{"content":"injected by the harness"}}\n'
  printf '{"type":"user","message":{"content":"<bash-stdout>echoed</bash-stdout>"}}\n'
  tool_result '[main abc1234] feat: thing'
  printf '{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"hidden"}]}}\n'
  printf '{"type":"assistant","isSidechain":true,"message":{"content":[{"type":"text","text":"from a sub-agent"}]}}\n'
  printf '{"type":"assistant","message":{"content":[{"type":"text","text":"uso A por costo"},{"type":"tool_use","name":"Bash"}]}}\n'
  printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash"}]}}\n'
  printf '{"type":"user","message":{"cont' # truncated by a death mid-write
} > "$root/projects/-repo/creator.jsonl"
tool_result 'abc1234 feat: thing' > "$root/projects/-repo--worktree/reader.jsonl"
tool_result '[main abcdef9] rewritten' > "$root/projects/-repo/other.jsonl"
tool_result 'def5678 only in a log' > "$root/projects/-repo/log-a.jsonl"
tool_result 'def5678 only in a log' > "$root/projects/-repo--worktree/log-b.jsonl"

find_session() { "$scripts/find-commit-session.sh" "$@" 2>&1 | cut -f1,2 | sort; }

check "the session with git commit's line is the creator, not one that only read the SHA" \
  "$(find_session abc1234)" "$(printf 'creator\tcreator')"
check "a full SHA matches the abbreviated line by prefix" \
  "$(find_session abc1234567890abcdef1234567890abcdef12345)" "$(printf 'creator\tcreator')"
check "without that line, every session mentioning the SHA is a candidate" \
  "$(find_session def5678)" "$(printf 'candidate\tlog-a\ncandidate\tlog-b')"
check "the excluded session is left out" \
  "$(find_session def5678 log-a)" "$(printf 'candidate\tlog-b')"
"$scripts/find-commit-session.sh" 0000000 >/dev/null 2>&1
check "an unknown SHA exits 1" "$?" 1
"$scripts/find-commit-session.sh" 'a.*b' >/dev/null 2>&1
check "a non-hex SHA is rejected before it reaches the regex" "$?" 2

expected=$(printf '[user]\nelige la opcion A\n\n[assistant]\nuso A por costo')
check "the tail keeps only conversation and survives the truncated line" \
  "$("$scripts/session-tail.sh" "$root/projects/-repo/creator.jsonl")" "$expected"
check "n limits the tail to the most recent messages" \
  "$("$scripts/session-tail.sh" "$root/projects/-repo/creator.jsonl" 1)" "$(printf '[assistant]\nuso A por costo')"

exit $failures
