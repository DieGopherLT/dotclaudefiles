#!/usr/bin/env bash
# Finds the Claude Code session behind a commit by searching every transcript.
# Prints "creator<TAB>session_id<TAB>path" for sessions whose tool output holds the
# "[branch sha]" line of git commit. Without one, prints "candidate<TAB>..." for sessions
# that only mention the SHA: a rebase does not print that line for the commits it rewrites.
# Exits 1 when no session mentions the SHA.
#
# The search ignores the project directory on purpose: transcripts are filed by the cwd the
# session started in, and one session can work across several worktrees.
set -euo pipefail

usage="usage: find-commit-session.sh <sha> [session_id_to_exclude]"
sha=${1:?$usage}
exclude=${2:-}

if [[ ! $sha =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "find-commit-session: sha=\"$sha\" is not 7 to 40 lowercase hex characters" >&2
  exit 2
fi

# git prints an abbreviated SHA of at least 7 characters, so a longer one must match by prefix.
prefix=${sha:0:7}
projects="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects"

mentions=()
while IFS= read -r -d '' file; do
  [[ $(basename "$file" .jsonl) == "$exclude" ]] && continue
  mentions+=("$file")
done < <(find "$projects" -mindepth 2 -maxdepth 2 -name '*.jsonl' -exec grep -lZF "$prefix" {} +)

if ((${#mentions[@]} == 0)); then
  exit 1
fi

creators=()
for file in "${mentions[@]}"; do
  # fromjson? skips the truncated last line a session leaves when it dies mid-write.
  matches=$(jq -R --arg re "\\[[^\\]]+ $prefix[0-9a-f]*\\] " '
    fromjson?
    | select(.type == "user")
    | .message.content | arrays | .[]
    | select(.type == "tool_result")
    | .content | if type == "array" then map(.text // "") | join("\n") else tostring end
    | select(test($re))
  ' "$file" | wc -l)
  ((matches > 0)) && creators+=("$file")
done

label=creator
results=("${creators[@]}")
if ((${#creators[@]} == 0)); then
  label=candidate
  results=("${mentions[@]}")
fi

for file in "${results[@]}"; do
  printf '%s\t%s\t%s\n' "$label" "$(basename "$file" .jsonl)" "$file"
done
