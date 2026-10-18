#!/usr/bin/env bash
# Rehearses the schools-and-classes migrations (F.2) on a copy of "today's" data:
# builds a scratch database with everything live today, up to Training (20261018002200), puts fake Douglas Park rows in,
# applies the four F.2 migrations, and checks that every row, every setting and every teacher list came through.
# Nothing is kept (it all runs in one transaction in a scratch database that is deleted at the end).
#   scripts/f2-rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
NAME=f2_rehearsal
SCRATCH_BASE=20261018001500 scripts/scratch-db.sh "$NAME" 20261018002200 | tail -2
{
  cat supabase/tests/rehearsal/f2-today-before.sql
  for f in supabase/migrations/20261018002300_schools.sql supabase/migrations/20261018002400_classes_and_warp.sql supabase/migrations/20261018002500_school_and_class_checks.sql supabase/migrations/20261018002600_clans_schools_and_classes.sql; do
    cat "$f"; echo
  done
  cat supabase/tests/rehearsal/f2-today-after.sql
} > "/tmp/$NAME.sql"
out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "/tmp/$NAME.sql" 2>&1 || true)"
rm -f "/tmp/$NAME.sql"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database \"$NAME\"" >/dev/null
grep -E '^(ok|not ok|ERROR|# )' <<<"$out" | grep -v 'transaction is aborted' || true
if grep -q -E '^(not ok|ERROR)' <<<"$out"; then echo "REHEARSAL FAILED"; exit 1; fi
echo "REHEARSAL PASSED: $(grep -c '^ok' <<<"$out") checks"
