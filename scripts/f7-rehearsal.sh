#!/usr/bin/env bash
# Rehearses the teacher views migration (F.7) on a copy of "today's" data:
# builds a scratch database with everything that will be live once F.5 and F.6 are (every migration up to 20261019000300), puts
# fake Douglas Park rows in (classes, a group, running and ended focuses, a student's own pick, changed settings, records of several
# packs, auto on for one class, a placement and a skip), applies the F.7 migration, and checks that every row, setting, focus and
# teacher list came through unchanged, that the skill map, history and placement reset work on it, and that only the four new
# functions can be called, only by signed-in people who then pass the teacher checks.
# Nothing is kept (it all runs in one transaction in a scratch database that is deleted at the end).
#   scripts/f7-rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
NAME=f7_rehearsal
WORK="${TMPDIR:-/var/tmp}/$NAME.sql"
MIGRATION=supabase/migrations/20261019000400_maths_teacher_views.sql
# The shared local copy is at 20261019000100 (it has none of F.4 to F.6), so those migrations are applied here first, and no
# SCRATCH_BASE is needed; give one if the copy ever gets ahead or falls behind.
scripts/scratch-db.sh "$NAME" 20261019000300 | tail -2
{
  cat supabase/tests/rehearsal/f7-today-before.sql
  cat "$MIGRATION"; echo
  cat supabase/tests/rehearsal/f7-today-after.sql
} > "$WORK"
out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "$WORK" 2>&1 || true)"
rm -f "$WORK"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database \"$NAME\"" >/dev/null
grep -E '^(ok|not ok|ERROR|# )' <<<"$out" | grep -v 'transaction is aborted' || true
if grep -q -E '^(not ok|ERROR)' <<<"$out"; then echo "REHEARSAL FAILED"; exit 1; fi
echo "REHEARSAL PASSED: $(grep -c '^ok' <<<"$out") checks"
