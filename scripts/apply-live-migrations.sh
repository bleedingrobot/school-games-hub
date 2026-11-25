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

query() { # $1 = file holding the SQL. Prints the JSON answer. Fails with 2 when Supabase refused the SQL (4xx), 1 otherwise.
  local body out code
  body=$(jq -Rs '{query: .}' < "$1")
  out=$(mktemp)
  code=$(curl -sS -o "$out" -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "$body") || code=000
  if [[ "$code" != 2* ]]; then echo "Supabase answered $code:" >&2; head -c 600 "$out" >&2; echo >&2; rm -f "$out"; [[ "$code" == 4* ]] && return 2; return 1; fi
  cat "$out"; rm -f "$out"
}

# Supabase's API sometimes answers 502/503 or times out for a moment (25 Nov 2026). Reading is safe to repeat, so try
# up to 4 times, 10, 20 and 40 seconds apart.
read_query() {
  local i rc
  for i in 1 2 3 4; do
    rc=0; query "$1" || rc=$?
    [[ $rc -eq 0 ]] && return 0
    [[ $rc -eq 2 ]] && return 1
    [[ $i -lt 4 ]] && { echo "Trying again in $((5 * 2 ** i)) seconds ..." >&2; sleep $((5 * 2 ** i)); }
  done
  return 1
}

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "select version from supabase_migrations.schema_migrations;" > "$tmp/history.sql"
applied=$(read_query "$tmp/history.sql" | jq -r '.[].version')
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
  # If the answer is lost (502, time-out), the migration may or may not have gone in: it runs in one transaction with
  # its history row, so look at the history before trying again, and never apply it twice.
  echo "select version from supabase_migrations.schema_migrations where version = '$v';" > "$tmp/check.sql"
  ok=0
  for i in 1 2 3; do
    rc=0; query "$tmp/apply.sql" > /dev/null || rc=$?
    [[ $rc -eq 0 ]] && { ok=1; break; }
    [[ $rc -eq 2 ]] && break   # the SQL itself failed: trying again won't help
    sleep $((10 * i))
    if read_query "$tmp/check.sql" | jq -e 'length > 0' > /dev/null; then echo "(It had gone in after all.)"; ok=1; break; fi
    [[ $i -lt 3 ]] && echo "Not in yet; trying again ..."
  done
  [[ $ok -eq 1 ]] || { echo "::error file=$f::Could not apply $name"; exit 1; }
  echo "Applied $name"
done
