#!/usr/bin/env bash
# Rehearses the maths focus migration (F.3) on a copy of "today's" data:
# builds a scratch database with everything live today (up to F.2's last migration, 20261018002600), puts fake Douglas Park rows in
# (classes, a group, settings changed from the defaults, maths records of every pack), applies the F.3 migration, and checks that
# every row, every setting and every teacher list came through and the new parts work on it.
# Nothing is kept (it all runs in one transaction in a scratch database that is deleted at the end).
#   scripts/f3-rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
NAME=f3_rehearsal
WORK="${TMPDIR:-/var/tmp}/$NAME.sql"
SCRATCH_BASE=20261018001500 scripts/scratch-db.sh "$NAME" 20261018002600 | tail -2
{
  cat supabase/tests/rehearsal/f3-today-before.sql
  cat supabase/migrations/20261018002700_maths_focus.sql; echo
  cat supabase/tests/rehearsal/f3-today-after.sql
} > "$WORK"
out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "$WORK" 2>&1 || true)"
rm -f "$WORK"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database \"$NAME\"" >/dev/null
grep -E '^(ok|not ok|ERROR|# )' <<<"$out" | grep -v 'transaction is aborted' || true
if grep -q -E '^(not ok|ERROR)' <<<"$out"; then echo "REHEARSAL FAILED"; exit 1; fi
echo "REHEARSAL PASSED: $(grep -c '^ok' <<<"$out") checks"
