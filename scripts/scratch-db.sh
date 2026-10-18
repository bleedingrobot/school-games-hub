#!/usr/bin/env bash
# Builds a throw-away copy of the database so migrations and tests can run without touching the
# shared local Supabase copy (other sessions may be using it).
#
#   [SCRATCH_BASE=<version>] scripts/scratch-db.sh [name] [last-migration]
#
# - Copies the STRUCTURE of the running local database (and the few seed tables), then applies every
#   migration in this folder that is newer than the copy. Give `last-migration` (e.g. 20261018001700)
#   to stop early, for example to rehearse a migration on "today's" data.
# - The scheduler (pg_cron) can only live in one database, so a tiny stand-in is made for it.
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
docker exec "$CONTAINER" pg_dump -U postgres --data-only --no-owner \
  -t public.achievement_types -t public.app_settings -t public.name_words postgres > "$WORK/seed.sql"

docker exec "$CONTAINER" psql -U postgres -q -c "drop database if exists \"$NAME\"" -c "create database \"$NAME\"" 2>&1 | grep -v NOTICE || true
"${PSQL[@]}" -d "$NAME" <<'SQL'
create schema cron;
create table cron.job (jobid bigserial, jobname text, schedule text, command text);
insert into cron.job (jobname) values ('tidy-friend-games');
create function cron.schedule(text, text, text) returns bigint language sql
  as 'insert into cron.job (jobname, schedule, command) values ($1, $2, $3) returning jobid';
create function cron.unschedule(text) returns boolean language sql as 'select true';
SQL
# The dump has a few lines a plain copy can't run (grants it can't re-grant, the scheduler's own settings): they are harmless.
docker exec -i "$CONTAINER" psql -U postgres -q -d "$NAME" < "$WORK/schema.sql" > "$WORK/restore.log" 2>&1 || true
docker exec -i "$CONTAINER" psql -U postgres -q -d "$NAME" < "$WORK/seed.sql" >> "$WORK/restore.log" 2>&1 || true

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
