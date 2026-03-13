#!/usr/bin/env python3

import json
import os
import re
import subprocess
import sys

EMOJI_PATTERN = re.compile(
    r'[\U0001F300-\U0001F9FF'
    r'\U00002600-\U000027BF'
    r'\U0000FE00-\U0000FEFF'
    r'\U0001FA00-\U0001FA9F]'
)


def extract_commit_message(command: str) -> str | None:
    m = re.search(r'git\s+commit\b.*?(?:-m|--message)\s+(["\'])(.*?)\1', command, re.DOTALL)
    return m.group(2) if m else None


def find_commitlint() -> list[str] | None:
    if subprocess.run(['which', 'commitlint'], capture_output=True).returncode == 0:
        return ['commitlint']
    if subprocess.run(['npx', 'commitlint', '--version'], capture_output=True).returncode == 0:
        return ['npx', 'commitlint']
    return None


def run_commitlint(commit_msg: str, config_file: str, runner: list[str]) -> list[str]:
    result = subprocess.run(
        runner + ['--config', config_file],
        input=commit_msg,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return []
    return [
        line.strip()
        for line in result.stdout.splitlines()
        if re.match(r'^\s*[\u2716\u26A0]', line)
    ]


def deny(commit_msg: str, errors: list[str]) -> None:
    error_list = '\n'.join(f'  - {e}' for e in errors)
    system_msg = (
        f'Commit message validation failed.\n\n'
        f'Message: "{commit_msg}"\n\n'
        f'Errors:\n{error_list}\n\n'
        f'Expected format: <type>: <subject> (max 96 chars, single line)\n'
        f'Allowed types: feat, fix, docs, style, refactor, test, chore, wip\n'
        f'Example: feat: add user authentication with JWT'
    )
    print(system_msg, file=sys.stderr)
    sys.exit(2)


def main() -> None:
    data = json.load(sys.stdin)
    command = data.get('tool_input', {}).get('command', '')

    if not re.search(r'(^|[;&|])\s*git commit\b', command):
        return

    commit_msg = extract_commit_message(command)
    if not commit_msg:
        return

    errors: list[str] = []

    if EMOJI_PATTERN.search(commit_msg):
        errors.append('emojis are not allowed in commit messages')

    if re.search(r'co-author', commit_msg, re.IGNORECASE):
        errors.append('commit message must not include co-authoring attribution')

    hooks_dir = os.path.dirname(os.path.abspath(__file__))
    config_file = os.path.join(hooks_dir, 'commitlint.config.cjs')
    runner = find_commitlint()
    if runner:
        errors.extend(run_commitlint(commit_msg, config_file, runner))

    if errors:
        deny(commit_msg, errors)


if __name__ == '__main__':
    main()
