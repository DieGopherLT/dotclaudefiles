#!/usr/bin/env bash
# Event: Stop
# Finds directories the session did substantial work in that structurally look
# like a real code module but have no module doc yet, and surfaces them as
# claudify candidates — never asserts they contain business logic worth
# documenting. This hook only judges shape (extension, file count, container
# vs. leaf); whether a candidate is actually worth documenting is a semantic
# call left entirely to the agent reading the suggestion.
#
# Why containers are excluded: a CLAUDE.md placed in a directory-of-directories
# (src/modules/) loads for EVERY child module's files — diluted context for all,
# useful for none. The per-module file loads only when working inside it.
set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/hooks/lib/common.sh"
trap 'exit 0' ERR

SUPPORT_DIR_NAMES="__tests__|__mocks__|fixtures|testdata|node_modules|dist|build|vendor|coverage"

main() {
  local start_marker suggestions="" candidate_dir claudify_marker

  read_hook_input
  stop_guards_pass || exit 0
  [ -d "$HOOK_CWD" ] || exit 0

  start_marker=$(start_marker_path "$HOOK_SESSION_ID")
  [ -f "$start_marker" ] || exit 0

  MIN_SOURCE_FILES=$(config_positive_int '.contextualizable.min_source_files' 3)
  MIN_TOUCHED_FILES=$(config_positive_int '.contextualizable.min_touched_files' 3)
  SOURCE_FILE_PATTERN=$(build_source_file_pattern)
  EXCLUDE_DIR_NAMES=$(build_exclude_dir_names)
  ALWAYS_INCLUDE_DIRS=$(resolve_always_include_dirs "$HOOK_CWD")

  while IFS= read -r candidate_dir; do
    [ -z "$candidate_dir" ] && continue
    claudify_marker="${HOOK_SESSION_ID}.claudify-$(path_fingerprint "$candidate_dir")"
    if should_suggest_claudify "$candidate_dir" "$start_marker" "$claudify_marker"; then
      set_marker "$claudify_marker"
      suggestions="${suggestions}- ${candidate_dir#"$HOOK_CWD"/}"$'\n'
    fi
  done < <(dirs_touched_this_session "$HOOK_CWD" "$start_marker")

  [ -z "$suggestions" ] && exit 0

  emit_additional_context "Stop" \
"This session touched director(ies) that structurally look like code modules and have no CLAUDE.md/AGENTS.md yet — they are candidates, not confirmed business logic:
${suggestions}
Run claudify only on the ones YOU judge worth it, using what you just experienced in this session as the signal — qualifying structurally does not mean qualifying semantically:
- Prioritize modules that are self-contained/cohesive over ones fragmented across many external pieces.
- Prioritize modules that were costly for you to mentally reconstruct this session (by size or by how many relationships you had to track) — those pay off most from being pre-documented for next time.
- Skip directories that are mostly types, helpers, or generic utilities with no real domain logic."
}

dirs_touched_this_session() {
  # Unique direct parents of files modified since the session started,
  # discovered by walking the whole project tree instead of a fixed set of
  # roots (a "src/" default has no meaning in a Go layout with cmd/internal/
  # pkg/, or in any other non-JS-shaped repo). A file only counts as a
  # candidate signal if its name matches SOURCE_FILE_PATTERN — prunes VCS
  # internals, the same support-dir set is_container_directory treats as
  # noise, plus any project-declared always_exclude names, all built from
  # EXCLUDE_DIR_NAMES so the checks can never drift apart. always_include
  # directories are unioned in separately, bypassing the extension filter,
  # for modules whose files (e.g. Ansible inventories) carry no extension.
  local cwd="$1" start_marker="$2" name
  local -a prune_args=(-name .git) exclude_names

  IFS='|' read -ra exclude_names <<< "$EXCLUDE_DIR_NAMES"
  for name in "${exclude_names[@]}"; do
    [ -z "$name" ] && continue
    prune_args+=(-o -name "$name")
  done

  {
    find "$cwd" \
      \( "${prune_args[@]}" \) -prune -o \
      -type f -newer "$start_marker" -print 2>/dev/null \
      | { grep -E "$SOURCE_FILE_PATTERN" || true; } \
      | xargs -r -n1 dirname

    [ -n "$ALWAYS_INCLUDE_DIRS" ] && printf '%s\n' "$ALWAYS_INCLUDE_DIRS"
  } | sort -u
}

build_exclude_dir_names() {
  # Merges the hardcoded infra-noise names with project-declared always_exclude
  # entries into one pipe-joined set, shared by the find -prune above and the
  # is_container_directory awk below.
  local always_exclude
  always_exclude=$(config_array '.contextualizable.always_exclude' '[]' | paste -sd '|' -)
  if [ -n "$always_exclude" ]; then
    echo "${SUPPORT_DIR_NAMES}|${always_exclude}"
  else
    echo "$SUPPORT_DIR_NAMES"
  fi
}

resolve_always_include_dirs() {
  # Project-declared directories that are always claudify candidates when
  # touched, even if their files carry no recognized extension (e.g. Ansible
  # inventories). Resolved once to absolute paths so should_suggest_claudify
  # can cheaply tell them apart from extension-discovered candidates.
  local cwd="$1" entry abs_path
  config_array '.contextualizable.always_include' '[]' | while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    abs_path="${cwd}/${entry%/}"
    [ -d "$abs_path" ] && echo "$abs_path"
  done
}

is_always_included_dir() {
  local dir="$1"
  [ -n "$ALWAYS_INCLUDE_DIRS" ] && grep -qxF "$dir" <<< "$ALWAYS_INCLUDE_DIRS"
}

should_suggest_claudify() {
  local dir="$1" start_marker="$2" claudify_marker="$3" own_source_files

  marker_present "$claudify_marker" && return 1
  has_module_doc "$dir" && return 1
  is_substantial_work "$dir" "$start_marker" || return 1

  # always_include entries are declared modules by the project regardless of
  # file shape (e.g. Ansible dirs full of extensionless inventory files) —
  # they skip the source-file-count and container checks below.
  is_always_included_dir "$dir" && return 0

  own_source_files=$(count_direct_source_files "$dir")
  [ "$own_source_files" -ge "$MIN_SOURCE_FILES" ] || return 1
  is_container_directory "$dir" "$own_source_files" && return 1
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
  # Single pass over grandchildren, counted per child by awk, instead of a
  # find+grep+basename per child directory.
  local dir="$1" own_source_files="$2" qualifying_children

  qualifying_children=$(
    find "$dir" -mindepth 2 -maxdepth 2 -type f 2>/dev/null \
      | grep -E "$SOURCE_FILE_PATTERN" \
      | awk -F/ -v support_re="^(${EXCLUDE_DIR_NAMES})\$" -v min="$MIN_SOURCE_FILES" '
          {
            child = $(NF - 1)
            if (child ~ /^\./ || child ~ support_re) next
            count[child]++
          }
          END {
            qualifying = 0
            for (c in count) if (count[c] >= min) qualifying++
            print qualifying
          }
        ' || true
  )
  qualifying_children=${qualifying_children:-0}

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
