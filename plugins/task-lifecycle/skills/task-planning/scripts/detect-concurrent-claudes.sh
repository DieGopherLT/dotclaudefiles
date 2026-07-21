#!/usr/bin/env bash
# Detects whether another Claude Code session is active in this repository right now.
# Output: "yes" or "no" on stdout. Exit 0 in both cases; non-zero only on usage errors.
#
# Criteria (both must hold, to avoid false positives from idle sessions or stale files):
#   1. Two or more `claude` CLI processes are alive (one of them is the caller).
#   2. Two or more transcripts of THIS project were modified in the last 10 minutes
#      (one of them is the caller's own).
set -u

project_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "detect-concurrent-claudes: not inside a git repository" >&2
  exit 1
}

# Claude Code stores transcripts under a slug built from the project path (/ and . become -).
slug=$(printf '%s' "$project_root" | sed 's/[\/.]/-/g')
transcripts_dir="$HOME/.claude/projects/$slug"

process_count=$(pgrep -cx claude 2>/dev/null || true)
process_count=${process_count:-0}

recent_transcripts=0
if [ -d "$transcripts_dir" ]; then
  recent_transcripts=$(find "$transcripts_dir" -maxdepth 1 -name '*.jsonl' -mmin -10 2>/dev/null | wc -l)
fi

if [ "$process_count" -ge 2 ] && [ "$recent_transcripts" -ge 2 ]; then
  echo "yes"
else
  echo "no"
fi
