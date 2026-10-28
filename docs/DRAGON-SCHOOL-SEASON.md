# Dragon Maths: one season date for the whole school (design)

Written 28 Oct 2026 on `teacher-games-dragon-season` (from `teacher-games-dragon`, PR #60). **Built 28 Oct 2026** on the
same branch (migration `20261028000400_lord_school_season.sql`, not live): see section 5 for what changed from this design. James decided (docs/TEACHER-VIEW-PLAN.md, section 9, question 2) that Dragon Maths has one season date for the
whole school, set by a school admin. This page says how it works today and what has to change.

**James's answers (28 Oct 2026), all as recommended below:** the date lives on the school's default settings row (2.1);
switching a class off only closes it for that class, plus an admin-only holiday pause for the whole school (2.2); the school
starts from the earliest saved date (2.3); admins set it in the Dragon Maths drawer until the Admin page exists (2.5).

---

## 1. How seasons work today

- **Each class has its own date.** `app_settings.lord_season_start` on the class's row is "the first day of season 1".
  Seasons run 35 days back to back from it (`seasonOf` in `shared/lord/engine.ts`; the same sum in SQL in
  `lord_current_season` and the class reports).
- **Switching a class off pauses its clock.** `teacher_set_lord` notes the day in `lord_paused_since`. Switching on again
  moves that class's start date forward by the days it was off, so the season carries on where it left off. Switching on
  with no date starts season 1 that day. Typing a date ends a pause.
- **The game reads the date through one SQL function.** The `lord` server function gets its settings from
  `lord_server_settings(player)` → `lord_settings(player)`, which reads the pupil's class row (`settings_of`). The season
  number and day are then worked out in `shared/lord/server.ts` (`seasonFor`). So **changing where `lord_settings` reads the
  date from changes the game's season with no server function redeploy.**
- **A hero starts again only when the season number goes up** (`server.ts`, "A new season starts the hero again":
  `if (rowSeason < season.number …)`). If a class's number went *down*, heroes would keep a higher season number than the
  class, and wouldn't start again until the class caught up.
- **The Hall of Heroes is one row per pupil per season number** (`lord_hall`, primary key `(player, season)`; a second
  dragon win adds to `kills`). If a season number came round twice, the two seasons' wins would be merged.
- **The Warriors list is already whole-school** (`lord_warriors`), but it only shows heroes whose season number matches
  the viewer's class. With classes on different dates, classes on different numbers can't see each other. One school
  date fixes that.
- Also reading the date: `teacher_lord_class()` and `teacher_lord_class(target_class)` (the class reports), and the
  Games table's summary (`seasonText` in `src/games/lord/teacher.ts`, from the class's settings).

## 2. The design (recommended answers in place)

### 2.1 Where the school's date is stored

**Recommended: the school's default settings row** (`app_settings` with `class_id is null`). It already has
`lord_season_start` and `lord_paused_since`, game settings belong in `app_settings` (GAME_DEVELOPMENT_GUIDE section 3:
"add columns only"), and the plan's Admin "School game settings" (stage 6) already treats that row as the school's.
`lord_settings` takes the date and the pause from that row, and everything else (on/off, forest fights, topics) from the
class's row, as now.

*Not recommended: new columns on `schools`.* That table is about the school itself (name, domains, board approval) and is
managed by the site owner. Putting a game's date there mixes the two, and it needs its own read rules.

The class rows' own `lord_season_start` and `lord_paused_since` stay in the table but are no longer read (never drop a
column; it also makes going back easy). A new class still copies them from the default row, which is harmless.

### 2.2 What switching one class off does now

**Recommended: switching a class off only closes the game for that class.** The school's seasons carry on. When the class
switches on again, its pupils are in whatever season the school is in (a new season may have started while they were away,
so their heroes start again at level 1, as at any new season).

**Plus an admin-only "Holiday pause (whole school)"**: on, it closes Dragon Maths for every class and the school's clock
waits; off, it moves the school's start date forward by the days it was paused, so the season carries on where it left off.
This is today's pause, moved from each class to the school. `lord_settings` says `enabled: false` while the school is
paused, so the game server needs no change.

Switching a class on while the school has no date yet starts season 1 that day for the whole school (today's "switching on
with no date starts season 1 today", kept so the first class can just start). An admin can change it afterwards.

### 2.3 Classes whose saved dates differ today

**Recommended: the school starts from the earliest date any of its rows has** (the classes' and the default row's,
ignoring empty ones), and any pause is cleared (a class that is off just stays off).

Why the earliest: the season number only ever goes up from it. Every class's number is at most the earliest date's
number, so every hero's season number is at most the new school number. Classes on the earliest date see no change. Every
other class jumps forward to a newer season, which the game already handles. Any other choice (the admin's own class, the
most common date) would push some class's number *down*, and section 1 shows the game can't take that: heroes would sit in
a "future" season and the Hall could merge two seasons.

**What pupils in a moved class see on the day:** their next visit is a new season. Their hero starts again at level 1 and
may pick a new class; dragon stars, achievements, points and the Hall of Heroes stay. The season line then says, for
example, "Season 4, day 20 of 35". Nothing is lost that a normal new season doesn't lose, but a class that was half way
through a season loses that half. So:

- **Apply it at a quiet time** (best: the end of term 4, during the holidays), and tell teachers the day before.
- **Before applying it, look at the live dates** with this read-only query (needs James's OK, like any live step), so
  James knows which classes will jump and by how much:

  ```sql
  select sc.name as school, coalesce(c.name, '(school default)') as class, c.archived, s.lord_enabled, s.lord_season_start,
         s.lord_paused_since,
         (select count(*) from public.lord_heroes h join public.class_members m on m.student_id = h.player
          where m.class_id = s.class_id) as heroes
  from public.app_settings s join public.schools sc on sc.id = s.school_id
  left join public.classes c on c.id = s.class_id
  where s.lord_season_start is not null
  order by sc.name, s.lord_season_start;
  ```

### 2.4 Changing the school's date later

The same rule: **the date can't be changed so the current season number goes down.** Before season 1 has started, any date
is fine. After that, the admin can move the date earlier (which starts the next season sooner) but not so far later that
the number drops. The drawer says so in words: "That would take the school back to season 2. Pick a day on or before
3 Nov." The server checks it too (22023).

### 2.5 Where an admin sets it until the Admin page (stage 6)

**Recommended: the Dragon Maths drawer**, in a "Seasons (whole school)" box at the top:

- **School admin:** "First day of season 1 (whole school)" (a date) and "Holiday pause (whole school)" (a switch), each
  with a "?". Under them: "Season 3 for the whole school, 12 days left."
- **Any other teacher:** the same line, read-only, plus "Set by a school admin". While paused: "Paused for the holidays
  since 18 Dec."
- **Below it, for this class:** forest fights a day and topics, as now (the date field leaves this part).
- **Games table row:** the switch's "?" becomes "Off hides Dragon Maths from this class only; the school's seasons carry
  on. A school admin can pause the seasons for the holidays." The Maths column shows the school's season, with "holiday
  pause" when paused.

Stage 6 moves the admin box to Admin → School game settings and leaves the read-only line in the drawer.

## 3. What the build changes

One migration (next free number now `20261028000400`; check again), one website PR. **No change to the `lord` server
function** (it gets the date through `lord_settings`).

**Database**
- `lord_school_season_row(school_id)` (internal): the school's default row's start and pause.
- `lord_settings(player)`: `seasonStart` and `pausedSince` from the school row; `enabled` is the class's switch and the
  school not paused; the rest from the class row as now.
- `lord_current_season(player)`: from the school row (this fixes the Warriors list and the old class report).
- `teacher_lord_class(target_class)` (#60) and `teacher_lord_class()`: the season from the school row.
- `teacher_set_lord`: the switch only switches (no per-class pause or date shift). On with no school date sets the school's
  start to today. A `seasonStart` sent by a teacher is refused (42501, "Only a school admin can change the season date.").
- New, school admins only (`is_school_admin()`, else 42501): `admin_set_lord_season(start date)` (refuses a date that lowers
  the current season number, 22023) and `admin_set_lord_holiday(on boolean)` (the pause and the shift, moved from
  `teacher_set_lord`).
- New for any teacher: `lord_school_season()`: start, paused since, number, days left, and `canChange` (is admin).
- One-off data step in the migration: each school's default row gets the earliest non-empty start of its rows, and its pause
  cleared; class rows untouched (section 2.3).
- Grants and `security.test.sql`'s function list updated for the three new functions.

**Website**
- `src/data/lord.ts`: `fetchLordSchoolSeason`, `saveLordSchoolSeason`, `saveLordHoliday`. Until the migration is live,
  `lord_school_season` answers PGRST202: then the drawer keeps #60's per-class date field and says nothing about the
  school, so the site works either side of the migration.
- `src/pages/TeacherLord.tsx`: the "Seasons (whole school)" box (section 2.5); the per-class date and pause note go once
  the school season loads.
- `src/games/lord/teacher.ts`: the summary from the school season; the switch's "?" text.

**Tests**
- `supabase/tests/database/lord_school_season.test.sql`, on a copy with **a season in progress**: two classes on different
  dates before the migration's data step (run the step's SQL in the test, or set the rows and call the step function); after
  it, both have the earliest date's number; a pupil in the later class starts a new season on their next request (call
  `lord_settings` and the season sum) while one in the earliest class doesn't; switching a class off leaves the school's
  start untouched; the holiday pause closes every class and resuming moves the start forward by the days paused; a plain
  teacher can't set the date or the pause (42501); an admin can't lower the season number (22023); the Warriors list shows
  both classes; the class reports show the school's season. Break the "can't go down" check on a copy and see it fail.
- `handler.test.ts` already covers "a new season starts the hero again"; add one case where the number jumps by more than
  one, so a class moving several seasons forward is covered.
- Website: the admin box (date and pause save, refused lower date in words), the read-only line for a plain teacher, the
  PGRST202 fallback to #60's per-class field, the summary while paused.

## 4. Going live (for later, each step only with James's yes)

1. Run the read-only query in 2.3 on the live database and show James which classes will jump.
2. Apply the four class-report migrations first if they aren't yet (#58, #59, #60), then this one, at a quiet time.
3. Check: each school's default row has the expected date; a pupil's `lord_settings` shows it; no class's number went down.
4. Merge the website PR.
5. Undo, if needed: a migration that puts `lord_settings` back to reading the class row (the class rows still hold their old
   dates; heroes that started a new season stay in it).

## 5. As built (28 Oct 2026), and what changed from the design

Built as section 3 says, with no change to the `lord` server function. Differences, and why:

- **While the holiday pause is on, the date handed out moves forward a day for every day paused.** `lord_settings`,
  `lord_current_season`, `lord_school_season` and the class reports all read the school's start through
  `lord_school_season_row(school)`, which adds the days paused so far (only days the season was already running), exactly
  as ending the pause will. So the season number and day stand still during the holidays. The design only said the clock
  waits; without this, a teacher trying the game during the pause (teachers can play while it's closed) would have jumped
  their hero into a season that resuming then takes back.
- **Typing a date while the pause is on keeps the pause, counted from today.** The new date is what the school's start
  is right now, and the days before today don't move it. (The old per-class rule was "typing a date ends a pause"; with an
  admin-only switch for the pause it seemed clearer for the switch alone to end it.)
- **The date can't be cleared** once set (22023, "Pick a date for the first day of season 1."): clearing it would take the
  season back to "not started".
- **`teacher_set_lord` with a `seasonStart`:** refused with 42501 for a plain teacher, as designed; for a school admin it does
  what `admin_set_lord_season` does, with the same "can't go down" check. That keeps the old teacher page's date box (the
  live site until the website PR merges) working for admins.
- **The data step is a locked function**, `lord_school_season_step()` (nobody signed in can call it), called once by the
  migration, so the database test can run it on rows it sets up. Also new and locked: `lord_season_number(date)`, the
  35-day sum with 0 for "not started", so "goes down" is a plain comparison.
- **The read-only query in 2.3 now shows whether each class is archived.** The data step counts every row, archived classes
  included (as designed), so an old archived class's date can move the whole school several seasons forward. Look for that
  before going live.
- **During the holiday pause the pupils' dashboard card stays.** The card reads the class's own switch; opening the game
  says it is closed (`lord_settings` says `enabled: false`), as for a class that is off.
- **The switch's "?" in the Games table changes with the database.** `about` on a game's switch may now be an element as well
  as text (`src/games/types.ts`); Dragon Maths gives one that says "Off hides Dragon Maths from this class only…" once
  `lord_school_season` answers, and the old wording before.
- **Older database tests changed with it:** `lord_l5.test.sql`'s pause checks now test the school's holiday pause (switching
  a class off no longer pauses anything), and `lord_class_report.test.sql` now expects the school's season in every class's
  report.
