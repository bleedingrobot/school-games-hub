-- Clan Quest: a monster fight lasts up to 12 rounds (shared/clans/config.ts monster.rounds), but clan_fights only
-- allowed 8 rounds, 8 Battle Cry questions and 8 marks. Since the monster fight got its own question list (one per
-- round), every monster try was refused by the database ("We couldn't reach the server", 17 Nov 2026).
-- This only loosens the limits to 12; no data changes.

alter table public.clan_fights drop constraint clan_fights_rounds_check;
alter table public.clan_fights add constraint clan_fights_rounds_check
  check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) <= 12);

alter table public.clan_fights drop constraint clan_fights_questions_check;
alter table public.clan_fights add constraint clan_fights_questions_check
  check (questions is null or (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 12));

alter table public.clan_fights drop constraint clan_fights_marks_check;
alter table public.clan_fights add constraint clan_fights_marks_check
  check (marks is null or (jsonb_typeof(marks) = 'array' and jsonb_array_length(marks) <= 12));
