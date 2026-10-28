#!/usr/bin/env bash
# Builds a throw-away copy of the database so migrations and tests can run without touching the
# shared local Supabase copy (other sessions may be using it).
#
#   [SCRATCH_BASE=<version>] scripts/scratch-db.sh [name] [last-migration]
#
# - Copies the STRUCTURE of the running local database and the rows its migrations made (SEED_TABLES below),
#   then applies every migration in this folder that is newer than the copy. Give `last-migration`
#   (e.g. 20261018001700) to stop early, for example to rehearse a migration on "today's" data.
#   It warns if a table with rows in the local copy has none in the new copy.
# - The scheduler (pg_cron) can only live in one database, so a tiny stand-in is made for it, with the
#   local copy's jobs.
# - Needs the local copy running: npx supabase start.   Delete the copy afterwards:
#     docker exec supabase_db_school-games-hub psql -U postgres -c 'drop database <name>'
set -euo pipefail
NAME="${1:-scratch}"
UPTO="${2:-99999999999999}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_school-games-hub}"
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1)
cd "$(dirname "$0")/.."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
LATEST="$(docker exec "$CONTAINER" psql -U postgres -t -A -c 'select coalesce(max(version), $$0$$) from supabase_migrations.schema_migrations')"
# The shared local copy can have gaps (a newer migration applied while older ones were not). Give SCRATCH_BASE=<version> to
# treat the copy as being at that version: anything newer that is already in the copy is removed (see "undo" below) and
# every migration after SCRATCH_BASE is applied again.
BASE="${SCRATCH_BASE:-}"
if [[ -n "$BASE" ]]; then LATEST="$BASE"; fi

docker exec "$CONTAINER" pg_dump -U postgres --schema-only --no-owner postgres \
  | grep -v -E 'CREATE EXTENSION IF NOT EXISTS pg_cron|COMMENT ON EXTENSION pg_cron' > "$WORK/schema.sql"
# Without SCRATCH_BASE the copy is already at the newest migrations, so the rows those migrations made (Douglas Park, its sign-in
# domain, the Everyone class and village) must come too; with SCRATCH_BASE the migrations are applied again and make them.
# The rows the older migrations made, which every test needs: the achievement list and what it is measured by, the games that
# plug into points and achievements (hub_games), the made-up name words, and when focus results started counting.
SEED_TABLES=(-t public.achievement_types -t public.achievement_measures -t public.hub_games -t public.name_words
  -t public.maths_focus_results_since)
if [[ -z "$BASE" ]]; then SEED_TABLES+=(-t public.schools -t public.school_domains -t public.classes -t public.clan_villages); fi
docker exec "$CONTAINER" pg_dump -U postgres --data-only --no-owner "${SEED_TABLES[@]}" postgres > "$WORK/seed.sql"
# The settings rows point at classes, so they go in last.
docker exec "$CONTAINER" pg_dump -U postgres --data-only --no-owner -t public.app_settings postgres >> "$WORK/seed.sql"

docker exec "$CONTAINER" psql -U postgres -q -c "drop database if exists \"$NAME\"" -c "create database \"$NAME\"" 2>&1 | grep -v NOTICE || true
# Like the real scheduler, scheduling a name that is already there replaces it, and unscheduling takes it away.
"${PSQL[@]}" -d "$NAME" <<'SQL'
create schema cron;
create table cron.job (jobid bigserial, jobname text, schedule text, command text);
create function cron.schedule(text, text, text) returns bigint language sql
  as 'delete from cron.job where jobname = $1; insert into cron.job (jobname, schedule, command) values ($1, $2, $3) returning jobid';
create function cron.unschedule(text) returns boolean language sql as 'delete from cron.job where jobname = $1; select true';
SQL
# The jobs the older migrations scheduled (the tests check some of them), copied from the local copy's scheduler.
docker exec "$CONTAINER" psql -U postgres -t -A -c "copy (select jobname, schedule, command from cron.job) to stdout" \
  | "${PSQL[@]}" -d "$NAME" -c "copy cron.job (jobname, schedule, command) from stdin"
# The dump has a few lines a plain copy can't run (grants it can't re-grant, the scheduler's own settings): they are harmless.
docker exec -i "$CONTAINER" psql -U postgres -q -d "$NAME" < "$WORK/schema.sql" > "$WORK/restore.log" 2>&1 || true
# schools and classes point at each other: take the one link away while the rows go in, then put it back.
DEFAULT_CLASS_FK="$(docker exec "$CONTAINER" psql -U postgres -d "$NAME" -t -A -c "select pg_get_constraintdef(oid) from pg_constraint where conname = 'schools_default_class_fkey'")"
if [[ -z "$BASE" && -n "$DEFAULT_CLASS_FK" ]]; then
  docker exec "$CONTAINER" psql -U postgres -q -d "$NAME" -c 'alter table public.schools drop constraint schools_default_class_fkey' >> "$WORK/restore.log" 2>&1 || true
fi
docker exec -i "$CONTAINER" psql -U postgres -q -d "$NAME" < "$WORK/seed.sql" >> "$WORK/restore.log" 2>&1 || true
if [[ -z "$BASE" && -n "$DEFAULT_CLASS_FK" ]]; then
  docker exec "$CONTAINER" psql -U postgres -q -d "$NAME" -c "alter table public.schools add constraint schools_default_class_fkey $DEFAULT_CLASS_FK" >> "$WORK/restore.log" 2>&1 || true
fi

# Every table with rows in the local copy should have them in this one too (the local copy holds only what migrations made).
# If a new migration fills a table that isn't in SEED_TABLES, say so, rather than let unrelated tests fail on this copy.
if [[ -z "$BASE" ]]; then
  COUNT_ALL="$(docker exec "$CONTAINER" psql -U postgres -t -A -c "select string_agg(format('select %L, count(*) from public.%I', tablename, tablename), ' union all ' order by tablename) from pg_tables where schemaname = 'public'")"
  docker exec "$CONTAINER" psql -U postgres -t -A -F ' ' -c "$COUNT_ALL" > "$WORK/rows-local.txt"
  docker exec "$CONTAINER" psql -U postgres -d "$NAME" -t -A -F ' ' -c "$COUNT_ALL" > "$WORK/rows-copy.txt"
  MISSING="$(awk 'NR == FNR { copy[$1] = $2; next } $2 > 0 && copy[$1] + 0 == 0 { print $1 }' "$WORK/rows-copy.txt" "$WORK/rows-local.txt" | tr '\n' ' ')"
  if [[ -n "$MISSING" ]]; then
    echo "WARNING: these tables have rows in the local copy but none in this copy (add them to SEED_TABLES): $MISSING" >&2
  fi
fi

# undo: Training (20261018002200) may already be in the shared copy; take it out so its migration can run in order.
if [[ -n "$BASE" && "$BASE" < "20261018002200" ]]; then
  "${PSQL[@]}" -d "$NAME" <<'SQL'
drop table if exists public.training_answers, public.training_students, public.training_answer_batches cascade;
drop function if exists public.record_training_answers(uuid, uuid, integer, jsonb, integer, integer);
drop function if exists public.record_training_student(uuid, jsonb, boolean, integer);
drop function if exists public.training_data(uuid);
drop function if exists public.my_training();
drop function if exists public.teacher_training_student(uuid);
delete from cron.job where jobname = 'forget-training-answer-batches';
SQL
fi

for file in $(ls supabase/migrations/*.sql | sort); do
  version="$(basename "$file" | cut -d_ -f1)"
  if [[ "$version" > "$LATEST" && ! "$version" > "$UPTO" ]]; then
    echo "applying $(basename "$file")"
    "${PSQL[@]}" -d "$NAME" < "$file"
  fi
done
echo "scratch database \"$NAME\" is ready (the local copy was at $LATEST)"
