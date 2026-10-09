#!/bin/bash
# PreToolUse guard on Bash: enforces the commit skill's message contract and keeps sub-agents from
# committing. Pure bash + jq, no eval. Denies through stdout JSON only (never exit 2).

SUBJECT_MAX=72
BODY_LINE_MAX=72
BODY_MAX_LINES=6
TYPES='feat|fix|docs|style|refactor|test|chore|wip'
# Sub-agents allowed to commit, matched on the agent name after any "plugin:" prefix.
ALLOWED_AGENTS=' refactoring-reconciler '

input=$(cat) || exit 0
command=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null) || exit 0
[[ -n "$command" ]] || exit 0

# Cheapest terminal check first: not a git commit, nothing to do.
commit_re='(^|[[:space:];&|(])git([[:space:]]+-[cC][[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)'
[[ "$command" =~ $commit_re ]] || exit 0

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}
# From here on an unexpected failure must fail closed, not degrade to silence.
trap 'deny "commit-guard: internal error while validating the commit; retry with git commit -m and a literal message"' ERR
set -uo pipefail

agent_id=$(jq -r '.agent_id // empty' <<<"$input")
if [[ -n "$agent_id" ]]; then
  agent_type=$(jq -r '.agent_type // empty' <<<"$input")
  agent_name=${agent_type##*:}
  if [[ "$ALLOWED_AGENTS" != *" $agent_name "* ]]; then
    deny "Sub-agents never commit (agent: ${agent_type:-unknown}). Leave the diff in the worktree; the main agent reviews and commits."
  fi
  exit 0
fi

# Slice from the "commit" token onward so global flags like -c key=val are not read as options.
rest=${command#*commit}

# Heredoc form: git commit -m "$(cat <<'EOF' ... EOF)"
heredoc_re='<<-?[[:space:]]*(['"'"'"]?)([A-Za-z_][A-Za-z0-9_]*)\1'
message=""
found=0
if [[ "$rest" =~ $heredoc_re ]]; then
  delim=${BASH_REMATCH[2]}
  message=$(awk -v d="$delim" '
    started && $0 == d { exit }
    started { print; next }
    index($0, "<<") { started = 1 }
  ' <<<"$rest")
  found=1
else
  # Literal -m / --message forms, possibly repeated; each is appended as a new paragraph.
  scan=$rest
  flag_re='(^|[[:space:]])(-[a-zA-Z]*m|--message)([[:space:]]+|=)(.*)$'
  while [[ "$scan" =~ $flag_re ]]; do
    value=${BASH_REMATCH[4]}
    token=""
    case $value in
      \'*)
        value=${value#\'}
        [[ "$value" == *\'* ]] || deny "Unterminated single quote in git commit -m."
        token=${value%%\'*}
        scan=${value#*\'}
        ;;
      \"*)
        value=${value#\"}
        i=0; len=${#value}; closed=0
        while (( i < len )); do
          ch=${value:i:1}
          if [[ "$ch" == '\' ]]; then token+=${value:i+1:1}; (( i += 2 )); continue; fi
          if [[ "$ch" == '"' ]]; then closed=1; break; fi
          token+=$ch; i=$(( i + 1 ))
        done
        (( closed )) || deny "Unterminated double quote in git commit -m."
        [[ "$token" == *'$('* || "$token" == *'`'* ]] && deny "Command substitution inside -m cannot be validated. Use a literal message, or a heredoc for a body."
        scan=${value:i+1}
        ;;
      *)
        token=${value%%[[:space:]]*}
        scan=${value#"$token"}
        ;;
    esac
    [[ -n "$message" ]] && message+=$'\n\n'
    message+=$token
    found=1
  done
fi

if (( ! found )); then
  reuse_re='(^|[[:space:]])(--amend|--no-edit|-C|-c|--reuse-message|--reedit-message|--fixup|--squash)([[:space:]=]|$)'
  [[ "$rest" =~ $reuse_re ]] && exit 0
  deny "Commit message not found in the command. Use git commit -m '<subject>' (or a heredoc when a body is needed)."
fi

# Normalize: drop trailing blank lines.
message=$(printf '%s\n' "$message" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
mapfile -t lines <<<"$message"
subject=${lines[0]}

subject_re="^(${TYPES})(\([a-z0-9][a-z0-9-]*\))?!?: [^A-Z[:space:]]"
[[ "$subject" =~ $subject_re ]] || deny "Subject must be '<type>(<scope>)?: <lowercase description>' with type in {${TYPES//|/, }}. Got: '$subject'"
(( ${#subject} <= SUBJECT_MAX )) || deny "Subject is ${#subject} chars; max ${SUBJECT_MAX}. Shorten: '$subject'"
[[ "$subject" != *. ]] || deny "Subject must not end with a period: '$subject'"

if (( ${#lines[@]} > 1 )); then
  [[ -z "${lines[1]}" ]] || deny "Line 2 must be blank: one blank line between subject and body."
  body_lines=0
  for (( i = 2; i < ${#lines[@]}; i++ )); do
    line=${lines[i]}
    lower=${line,,}
    [[ "$lower" == co-authored-by:* || "$lower" == *"generated with"* ]] && deny "Attribution lines are forbidden: '$line'"
    [[ "$line" =~ ^[[:space:]]*[-*•][[:space:]] ]] && deny "Bullet points are forbidden in the body; write one to three sentences on the why: '$line'"
    (( ${#line} <= BODY_LINE_MAX )) || deny "Body line is ${#line} chars; wrap at ${BODY_LINE_MAX}: '$line'"
    [[ -n "$line" && "$line" != "BREAKING CHANGE:"* ]] && body_lines=$(( body_lines + 1 ))
  done
  (( body_lines <= BODY_MAX_LINES )) || deny "Body has ${body_lines} lines; max ${BODY_MAX_LINES}. A commit is not a changelog: state the why, not the steps."
fi

exit 0
