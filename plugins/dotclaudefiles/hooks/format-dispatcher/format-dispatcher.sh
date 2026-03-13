#!/usr/bin/env bash

set -euo pipefail

# -- Config detection helpers ------------------------------------------------

has_config_file() {
  local project_dir="$1"
  shift
  for config in "$@"; do
    [[ -f "$project_dir/$config" ]] && return 0
  done
  return 1
}

has_package_json_key() {
  local project_dir="$1"
  local key="$2"
  [[ -f "$project_dir/package.json" ]] && jq -e ".$key" "$project_dir/package.json" > /dev/null 2>&1
}

# -- Formatters --------------------------------------------------------------

format_frontend() {
  local file_path="$1"
  local project_dir="$2"

  local eslint_configs=(
    .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yml .eslintrc.yaml
    eslint.config.js eslint.config.mjs eslint.config.cjs
    eslint.config.ts eslint.config.mts eslint.config.cts
  )

  if has_config_file "$project_dir" "${eslint_configs[@]}" || has_package_json_key "$project_dir" "eslintConfig"; then
    npx eslint --fix "$file_path" 2>/dev/null || true
  fi

  local prettier_configs=(
    .prettierrc .prettierrc.js .prettierrc.cjs .prettierrc.json
    .prettierrc.yml .prettierrc.yaml .prettierrc.toml
    prettier.config.js prettier.config.cjs prettier.config.mjs
  )

  if has_config_file "$project_dir" "${prettier_configs[@]}" || has_package_json_key "$project_dir" "prettier"; then
    npx prettier --write "$file_path" 2>/dev/null || true
  fi
}

format_go() {
  local file_path="$1"
  local project_dir="$2"

  if [[ ! -f "$project_dir/go.mod" ]]; then
    return 0
  fi

  gofmt -w "$file_path" 2>/dev/null || true

  local relative_path
  relative_path=$(realpath --relative-to="$project_dir" "$file_path" 2>/dev/null) || return 0
  local package_dir
  package_dir=$(dirname "$relative_path")

  cd "$project_dir"
  go vet "./$package_dir/..." 2>/dev/null || true
  go mod tidy 2>/dev/null || true
}

format_markdown() {
  local file_path="$1"
  local project_dir="$2"

  local mdlint_configs=(
    .markdownlint.json .markdownlint.yaml .markdownlint.yml
    .markdownlint-cli2.jsonc .markdownlint-cli2.yaml
  )

  local config_arg=""
  if has_config_file "$project_dir" "${mdlint_configs[@]}"; then
    npx markdownlint-cli2 --fix "$file_path" 2>/dev/null || true
  else
    local hook_dir="${CLAUDE_PLUGIN_dotclaudefiles_ROOT:-${BASH_SOURCE[0]%/*}}"
    config_arg="--config $hook_dir/.markdownlint.json"
    npx markdownlint-cli2 $config_arg --fix "$file_path" 2>/dev/null || true
  fi
}

# -- Main --------------------------------------------------------------------

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]] || [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  ts|tsx|js|jsx|css|html|vue|svelte|astro|json|yaml|yml)
    format_frontend "$FILE_PATH" "$PROJECT_DIR"
    ;;
  go)
    format_go "$FILE_PATH" "$PROJECT_DIR"
    ;;
  md|mdx)
    format_markdown "$FILE_PATH" "$PROJECT_DIR"
    ;;
esac

exit 0
