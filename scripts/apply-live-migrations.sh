#!/usr/bin/env bash
# Applies to the LIVE database every migration in supabase/migrations that isn't in its history yet,
# oldest first, each in one transaction together with its history row. Run by GitHub Actions on every push to main
# ("Test and publish", after all the checks pass). Needs SUPABASE_ACCESS_TOKEN; talks to Supabase's Management API.
#
#   scripts/apply-live-migrations.sh            apply what's pending
#   scripts/apply-live-migrations.sh --dry-run  only list what's pending
#
# Skips anything listed in supabase/migrations-on-hold.txt.
# Refuses (and applies nothing) if a pending file has a line that STARTS with drop table / drop schema / truncate /
# delete from / alter table ... drop column, unless the file also has the line `-- live-ok: destructive` (add it only
# after James has said yes). Lines inside function bodies are indented, so they don't count.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-zqzhetlzvtptnkmeiumi}"
API="https://api.supabase.com/v1/projects/$REF/database/query"
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set}"

query() { # $1 = file holding the SQL. Prints the JSON answer; fails on an error.
  local body out code
  body=$(jq -Rs '{query: .}' < "$1")
  out=$(mktemp)
  code=$(curl -sS -o "$out" -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "$body")
  if [[ "$code" != 2* ]]; then echo "Supabase answered $code:" >&2; cat "$out" >&2; echo >&2; rm -f "$out"; return 1; fi
  cat "$out"; rm -f "$out"
}

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "select version from supabase_migrations.schema_migrations;" > "$tmp/history.sql"
applied=$(query "$tmp/history.sql" | jq -r '.[].version')
held=$(grep -Eo '^[0-9]{14}' supabase/migrations-on-hold.txt 2>/dev/null || true)

pending=()
for f in supabase/migrations/*.sql; do
  v=$(basename "$f"); v=${v%%_*}
  grep -qx "$v" <<< "$applied" && continue
  if grep -qx "$v" <<< "$held"; then echo "On hold, not applied: $(basename "$f")"; continue; fi
  pending+=("$f")
done

if [[ ${#pending[@]} -eq 0 ]]; then echo "The live database is up to date: nothing to apply."; exit 0; fi

bad=0
for f in "${pending[@]}"; do
  if grep -qiE '^(drop (table|schema)|truncate|delete from|alter table [^;]* drop column)' "$f" && ! grep -qx -- '-- live-ok: destructive' "$f"; then
    echo "::error file=$f::Destructive change (drop table/schema, truncate, delete from or drop column at the start of a line). Get James's OK, then add the line '-- live-ok: destructive' to the file."
    bad=1
  fi
done
[[ $bad -eq 1 ]] && { echo "Nothing applied."; exit 1; }

for f in "${pending[@]}"; do
  name=$(basename "$f" .sql); v=${name%%_*}; n=${name#*_}
  if [[ $DRY -eq 1 ]]; then echo "Would apply: $name"; continue; fi
  { echo "begin;"; cat "$f"; echo ";"
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '$n');"
    echo "commit;"; } > "$tmp/apply.sql"
  echo "Applying $name ..."
  query "$tmp/apply.sql" > /dev/null
  echo "Applied $name"
done
