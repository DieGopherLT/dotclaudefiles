#!/usr/bin/env bash
# Event: Stop
# Finds directories the session did substantial work in that qualify as
# "contextualizable" (a real code module) but have no module doc yet, and
# suggests running the claudify skill on them.
#
# Why containers are excluded: a CLAUDE.md placed in a directory-of-directories
# (src/modules/) loads for EVERY child module's files — diluted context for all,
# useful for none. The per-module file loads only when working inside it.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

SUPPORT_DIR_NAMES="__tests__|__mocks__|fixtures|testdata|node_modules|dist|build|vendor|coverage"

main() {
  local input session_id cwd stop_hook_active start_marker

  input=$(cat)
  session_id=$(echo "$input" | jq -r '.session_id // empty')
  cwd=$(echo "$input" | jq -r '.cwd // empty')
  stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

  [ "$stop_hook_active" = "true" ] && exit 0
  [ -z "$session_id" ] && exit 0
  [ -d "$cwd" ] || exit 0

  start_marker="${HOOK_STATE_DIR}/${session_id}.start-marker"
  [ -f "$start_marker" ] || exit 0

  MIN_SOURCE_FILES=$(config_value '.contextualizable.min_source_files' 3)
  MIN_TOUCHED_FILES=$(config_value '.contextualizable.min_touched_files' 3)
  SOURCE_FILE_PATTERN=$(build_source_file_pattern)

  local suggestions=""
  local candidate_dir
  while IFS= read -r candidate_dir; do
    [ -z "$candidate_dir" ] && continue
    if should_suggest_claudify "$candidate_dir" "$session_id" "$start_marker"; then
      set_marker "${session_id}.claudify-$(path_fingerprint "$candidate_dir")"
      suggestions="${suggestions}- ${candidate_dir#"$cwd"/}"$'\n'
    fi
  done < <(dirs_touched_this_session "$cwd" "$start_marker")

  [ -z "$suggestions" ] && exit 0

  emit_additional_context "Stop" \
"This session did substantial work in module director(ies) that have no CLAUDE.md/AGENTS.md yet:
${suggestions}
Consider invoking the claudify skill on each one to capture the non-obvious context while it is fresh. Each directory already passed the substantiality and module-shape checks — this is not a drive-by touch."
}

dirs_touched_this_session() {
  # Unique direct parents of files modified since the session started,
  # under the configured roots.
  local cwd="$1" start_marker="$2" root

  config_array '.contextualizable.roots' '["src/"]' | while IFS= read -r root; do
    [ -d "${cwd}/${root}" ] || continue
    find "${cwd}/${root}" \
      \( -name .git -o -name node_modules \) -prune -o \
      -type f -newer "$start_marker" -print 2>/dev/null \
      | xargs -r -n1 dirname \
      | sort -u
  done
}

should_suggest_claudify() {
  local dir="$1" session_id="$2" start_marker="$3"

  marker_present "${session_id}.claudify-$(path_fingerprint "$dir")" && return 1
  has_module_doc "$dir" && return 1
  is_substantial_work "$dir" "$start_marker" || return 1
  [ "$(count_direct_source_files "$dir")" -ge "$MIN_SOURCE_FILES" ] || return 1
  is_container_directory "$dir" && return 1
  return 0
}

has_module_doc() {
  [ -f "$1/CLAUDE.md" ] || [ -f "$1/AGENTS.md" ]
}

is_substantial_work() {
  # Substantial = several files touched, or at least one brand-new file
  # (a new file signals new surface worth documenting; git detects it as
  # untracked — when git is unavailable the touched-count branch decides).
  local dir="$1" start_marker="$2" touched_count untracked_count

  touched_count=$(find "$dir" -maxdepth 1 -type f -newer "$start_marker" 2>/dev/null | wc -l)
  [ "$touched_count" -ge "$MIN_TOUCHED_FILES" ] && return 0

  if command -v git >/dev/null; then
    untracked_count=$(git -C "$dir" ls-files --others --exclude-standard -- . 2>/dev/null | grep -cv '/' || true)
    [ "$untracked_count" -ge 1 ] && return 0
  fi
  return 1
}

count_direct_source_files() {
  find "$1" -maxdepth 1 -type f 2>/dev/null | grep -cE "$SOURCE_FILE_PATTERN" || true
}

is_container_directory() {
  # Container = its qualifying module children outnumber its own source files
  # (e.g. src/modules holding one subdir per domain plus a couple of barrels).
  local dir="$1" child qualifying_children=0 own_source_files

  while IFS= read -r child; do
    [ -z "$child" ] && continue
    basename "$child" | grep -qE "^(${SUPPORT_DIR_NAMES}|\..*)$" && continue
    if [ "$(count_direct_source_files "$child")" -ge "$MIN_SOURCE_FILES" ]; then
      qualifying_children=$((qualifying_children + 1))
    fi
  done < <(find "$dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

  own_source_files=$(count_direct_source_files "$dir")
  [ "$qualifying_children" -ge 2 ] && [ "$qualifying_children" -gt "$own_source_files" ]
}

build_source_file_pattern() {
  # Merges code and IaC extension allowlists into one grep -E pattern.
  {
    config_array '.contextualizable.source_extensions' '["go","ts","tsx","js","jsx","cs","py"]'
    config_array '.contextualizable.iac_extensions' '["tf","yaml","yml"]'
  } | paste -sd '|' - | sed 's/.*/\\.(&)$/'
}

main
