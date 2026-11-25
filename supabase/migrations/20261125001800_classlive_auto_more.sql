-- Class Live times can start the newer map games too (James, 25 Nov 2026 NZ: "add today's new games"): Shark Bay,
-- Ghost Tag, Colour Clash, Musical Thrones and Floor is Lava. All run on the clock from pupils' devices (their rounds
-- move on with each `look`), so they need no teacher. Star Web still needs the big screen (docs/plans/classlive-auto/PLAN.md).
alter table public.classlive_times drop constraint classlive_times_activity_check;
alter table public.classlive_times add constraint classlive_times_activity_check
  check (activity in ('serpent', 'mural', 'corners', 'shark', 'ghost', 'clash', 'thrones', 'lava'));
