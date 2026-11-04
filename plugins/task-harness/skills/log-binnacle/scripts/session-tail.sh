#!/usr/bin/env bash
# Prints the last n conversational messages of a transcript, oldest first, each headed by its
# author. Keeps the user's prompts and the agent's text; drops tool results, thinking, sub-agent
# records, harness-injected messages (isMeta) and the echoed output of the user's shell commands.
set -euo pipefail

usage="usage: session-tail.sh <transcript.jsonl> [n]"
transcript=${1:?$usage}
n=${2:-20}

if [[ ! $n =~ ^[1-9][0-9]*$ ]]; then
  echo "session-tail: n=\"$n\" is not a positive integer" >&2
  exit 2
fi

# fromjson? skips the truncated last line a session leaves when it dies mid-write.
jq -Rrn --argjson n "$n" '
  [ inputs
    | fromjson?
    | select((.type == "user" or .type == "assistant") and (.isMeta | not) and (.isSidechain | not))
    | { role: .type,
        text: (.message.content
          | if type == "string" then . else map(select(.type == "text") | .text) | join("\n") end) }
    | select(.text != "" and (.text | test("^<(bash-std|local-command-)") | not))
  ]
  | .[-$n:][]
  | "[\(.role)]\n\(.text)\n"
' "$transcript"
