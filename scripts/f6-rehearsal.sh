#!/usr/bin/env bash
# Rehearses F.6 on a copy of "today's" data. F.6 has NO migration, so this checks that the live database as it will be once F.5
# is live (every migration up to 20261019000300) takes everything F.6 sends it, and that nothing changes for anyone:
# builds a scratch database with every migration, puts fake Douglas Park rows in (classes, a group, running focuses, a student's own
# pick, changed settings, records of several packs, auto on for one class, a placement and a skip), records answers for all 61 new
# question types and the nine ten-and facts, and checks every row, setting, focus, place, placement and teacher list is exactly as
# it was, that Gem Keep and Mission Control are handed the new records (and never Maths Monsters' own), and that bad keys are still
# refused. Nothing is kept (one transaction in a scratch database that is deleted at the end).
#   scripts/f6-rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
NAME=f6_rehearsal
WORK="${TMPDIR:-/var/tmp}/$NAME.sql"
# The shared local copy is behind (it has neither F.4 nor F.5), so the scratch copy applies them in order; give SCRATCH_BASE if it
# ever gets ahead or falls behind.
scripts/scratch-db.sh "$NAME" | tail -2
{
  cat supabase/tests/rehearsal/f6-today-before.sql
  cat supabase/tests/rehearsal/f6-today-after.sql
} > "$WORK"
out="$(docker exec -i -e PGOPTIONS='-c search_path=public,extensions' "$CONTAINER" psql -U postgres -d "$NAME" -t -A < "$WORK" 2>&1 || true)"
rm -f "$WORK"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database \"$NAME\"" >/dev/null
grep -E '^(ok|not ok|ERROR|# )' <<<"$out" | grep -v 'transaction is aborted' || true
if grep -q -E '^(not ok|ERROR)' <<<"$out"; then echo "REHEARSAL FAILED"; exit 1; fi
echo "REHEARSAL PASSED: $(grep -c '^ok' <<<"$out") checks"
