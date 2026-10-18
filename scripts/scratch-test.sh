#!/usr/bin/env bash
# Runs the database tests (pgTAP files) against a scratch copy made by scripts/scratch-db.sh.
#   scripts/scratch-test.sh [name] [test files...]     (default: every file in supabase/tests/database)
# Prints one line per file, and the failing checks. Everything the tests do is rolled back.
set -uo pipefail
NAME="${1:-scratch}"; shift || true
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
cd "$(dirname "$0")/.."
FILES=("$@")
[[ ${#FILES[@]} -eq 0 ]] && FILES=(supabase/tests/database/*.test.sql)
status=0
for f in "${FILES[@]}"; do
  out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "$f" 2>&1)"
  ok=$(grep -c '^ok' <<<"$out" || true); bad=$(grep -c '^not ok' <<<"$out" || true); err=$(grep -v 'transaction is aborted' <<<"$out" | grep -c 'ERROR' || true)
  echo "$(basename "$f"): ok=$ok not-ok=$bad errors=$err"
  if [[ "$bad" != 0 || "$err" != 0 ]]; then status=1; grep -E '^not ok|ERROR' <<<"$out" | grep -v 'transaction is aborted' | head -8; fi
done
exit $status
