#!/usr/bin/env bash
# Rehearses the maths auto migration (F.4) on a copy of "today's" data:
# builds a scratch database with everything live today (every migration up to 20261019000100: F.3 and the moves-left change), puts
# fake Douglas Park rows in (classes, a group, running focuses, a student's own pick, changed settings, records of several packs),
# applies the F.4 migration, and checks that every row, every setting, every focus and every teacher list came through, that the
# new switch is off everywhere, and the new parts work on it.
# Nothing is kept (it all runs in one transaction in a scratch database that is deleted at the end).
#   scripts/f4-rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
NAME=f4_rehearsal
WORK="${TMPDIR:-/var/tmp}/$NAME.sql"
MIGRATION=supabase/migrations/20261019000200_maths_auto.sql
# The shared local copy is already at 20261019000100 (it has no F.4), so no SCRATCH_BASE is needed; give one if it ever falls behind.
scripts/scratch-db.sh "$NAME" 20261019000100 | tail -2
{
  cat supabase/tests/rehearsal/f4-today-before.sql
  cat "$MIGRATION"; echo
  cat supabase/tests/rehearsal/f4-today-after.sql
} > "$WORK"
out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "$WORK" 2>&1 || true)"
rm -f "$WORK"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database \"$NAME\"" >/dev/null
grep -E '^(ok|not ok|ERROR|# )' <<<"$out" | grep -v 'transaction is aborted' || true
if grep -q -E '^(not ok|ERROR)' <<<"$out"; then echo "REHEARSAL FAILED"; exit 1; fi
echo "REHEARSAL PASSED: $(grep -c '^ok' <<<"$out") checks"
