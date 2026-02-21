#!/usr/bin/env bash
set -euo pipefail

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  go|ts|tsx|js|jsx)
    echo "{\"systemMessage\": \"You just read $FILE_PATH. Use LSP tools to explore its symbols instead of reading more files: documentSymbol to list all symbols in this file, goToDefinition to find where any symbol is defined, findReferences to find all usages, hover for type and doc info, workspaceSymbol to search symbols across the codebase.\"}"
    ;;
esac

exit 0
