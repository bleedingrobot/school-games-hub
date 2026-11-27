-- Hall of fame shows approved own names (James, 28 Nov 2026 NZ).
--
-- hall_name used to keep made-up names only, so a pupil with an approved typed name (e.g. "Border Collie") showed as
-- "A classmate" on the Hall of fame and the New trophies strip. profiles.display_name only ever holds a made-up name or a
-- name a teacher said Yes to (20261112002800_own_names.sql), and Class Live already shows those names, so the hall now
-- shows the name as it is. Same name, arguments and result type: callers (hall_of_fame, the New trophies strip) are unchanged.

create or replace function public.hall_name(n text)
returns text
language sql
immutable
set search_path = ''
as $$ select n $$;
