#!/usr/bin/env bash
# Works out what a push or pull request changed since BASE, so the checks and the publish only do what is needed.
# Used by the GitHub workflows. Prints (and adds to $GITHUB_OUTPUT when set):
#   site=true|false   false only when every change is a note or plan (docs/ or a .md file at the top level)
#   db=true|false     true when the database files changed (migrations, database tests, Supabase config)
#   functions=a b c   server functions whose built index.ts changed
# A change to the workflows (.github/) or this script also runs the database checks. An unknown BASE also checks everything.
# Usage: scripts/ci-changes.sh <base commit> [<head commit, default HEAD>]
set -euo pipefail

base="${1:-}"
head="${2:-HEAD}"
site=true
db=true
functions=""

if [ -n "$base" ] && git cat-file -e "$base^{commit}" 2>/dev/null; then
  changed=$(git diff --name-only "$base" "$head")
  echo "Changed since ${base:0:7}:" >&2
  echo "$changed" | sed 's/^/  /' >&2
  if [ -z "$changed" ] || ! grep -qvE '^docs/|^[^/]+\.md$' <<<"$changed"; then site=false; fi
  if ! grep -qE '^supabase/(migrations/|tests/|config\.toml|seed\.sql)|^\.github/|^scripts/(ci-changes|apply-live-migrations)' <<<"$changed"; then db=false; fi
  functions=$( (grep -E '^supabase/functions/[^/_][^/]*/index\.ts$' <<<"$changed" || true) | cut -d/ -f3 | sort -u | tr '\n' ' ' | sed 's/ $//')
else
  echo "::warning::Base commit '${base}' not found, so everything is checked (and no function is picked from the changes)." >&2
fi

out="site=$site
db=$db
functions=$functions"
echo "$out"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$out" >> "$GITHUB_OUTPUT"; fi
