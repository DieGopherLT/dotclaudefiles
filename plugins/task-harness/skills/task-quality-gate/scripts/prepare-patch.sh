#!/usr/bin/env bash
# Resolves the review base deterministically and generates the patch the whole gate consumes.
#
# Usage: prepare-patch.sh <base-branch-or-ref> <out-path>
# stdout: the resolved merge-base SHA (pass it as `baseBranch` to the Workflow)
# Exit non-zero when: bad usage, the ref does not resolve, or the branch has no commits over base.
#
# Three-dot semantics via an explicit merge-base: the patch contains only what the branch added,
# never reverse-deltas from a base branch that advanced after the cut.
set -u

if [ "$#" -ne 2 ]; then
  echo "usage: prepare-patch.sh <base-branch-or-ref> <out-path>" >&2
  exit 1
fi

base_ref="$1"
out_path="$2"

base_sha=$(git merge-base HEAD "$base_ref" 2>/dev/null) || {
  echo "prepare-patch: cannot resolve merge-base of HEAD and '$base_ref'" >&2
  exit 1
}

if [ "$(git rev-parse HEAD)" = "$base_sha" ]; then
  echo "prepare-patch: branch has no commits over '$base_ref' — nothing to review" >&2
  exit 1
fi

git diff "$base_sha"..HEAD > "$out_path" || {
  echo "prepare-patch: git diff failed writing to '$out_path'" >&2
  exit 1
}

echo "$base_sha"
