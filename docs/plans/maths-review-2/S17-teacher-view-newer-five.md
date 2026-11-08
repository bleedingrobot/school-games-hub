# S17: Pigeon, Parrot, Lizard, Swamp Hen, Robin: teachers can't see them in the class grid or Today alerts

**Game:** Pigeon, Parrot, Lizard, Swamp Hen, Robin (the teacher's Foundational view)
**What's wrong:** The class grid and the "Needs you" lines on Today only know six games (Beanstalk, Hop, Penguin Pairs, Pipi, Tūī, Weka). A class playing the five newer games shows nothing for them.
**What done looks like:** Open a class's Foundational skills page: each of the five has a column (or two) with a mark for every child, Today says "Robin: 2 pupils on the same step for 5 or more days (...)" when it should, and "Hardest right now" lists each game's three weakest questions in plain words.
**Size:** M
**Impact on learning:** High (for teachers: they can see who is stuck before a whole class uses these games)
**Waits for:** nothing

## 1. The problem

A teacher with a class playing the five newer games sees none of them in the grid or in Today's alerts. The evaluator and the final scorer both checked this (`docs/reviews/maths-review-2/DECISIONS.md`, spot-check 1 and section 7 pattern 8). Verified in code:

- `src/data/foundational.ts:13`: `GAME_IDS = ['beanstalk', 'hop', 'korora', 'pipi', 'tui', 'weka']`. `parseFoundational` only reads those six (`src/data/foundational.ts:106-108`), so even if the database sent more, the page would drop them.
- `src/teacher/foundational/config.ts:44-50`: `GAMES` has exactly those six (name, level word, level names, top level).
- `src/teacher/foundational/ideas.ts:41-58`: `IDEAS` (the grid columns) has eight columns; none is for the five games.
- `src/teacher/foundational/alerts.ts:21-28`: `ENABLED` lists six "is it on for this class" calls.
- `supabase/migrations/20261107000100_foundational_teacher_views.sql:27-80`: `teacher_foundational_class` builds the class object from six tables only (`hop_`, `korora_`, `pipi_`, `tui_`, `weka_`, `beanstalk_` progress and rounds).
- `shared/kit/teacherGrid.ts` has no game words (good), so it needs no change.
- Only six games call `foundationalAlerts` and `foundationalHardest` (`src/games/hop/index.tsx:59-60` and the same in tui, pipi, korora, weka, beanstalk). The five newer games' `index.tsx` have a `teacher:` block (for example `src/games/robin/index.tsx:55`) but no `alerts` or `hardest`.
- Each of the five already saves what the grid needs: `X_progress` (`days_done`, `last_day`, `step`, `level`) and `X_rounds` (`mistakes`, `taps`, `finished_at`, and `round->>'step'`). Pigeon: `supabase/migrations/20261107000200_pigeon.sql:28-52`. Robin: `20261108000100_robin.sql:25-51`. Same shape for parrot, lizard, swamphen.
- Their questions are in the shared maths records as ladder skills, so the grid's facts already arrive from `teacher_class_skill_map`: `number-line-100`, `ten-more-less`, `number-line-1000` (`shared/maths/ladder.ts:110-112`), `bundles-50`, `place-value-100`, `regroup-100`, `ten-more-less-100`, `place-value-1000` (`:118-122`), `equal-rows`, `arrays-turn`, `sharing-rows`, `cut-arrays` (`:124-127`), `balance-10`, `balance-20`, `true-false` (`:114-116`), `count-out-10`, `count-out-20`, `count-on` (`:129-131`).

The players tracker ("who played") is not in the repo. `docs/PARROT-PLAN.md:184` and `docs/HOP-PLAN.md:243` both say it lives in an artifact. James's notes say it was updated on 8 Nov 2026 to count all games, so the tracker step is a check, not a build (see the change, step 7).

"Usual slip" is not a class-grid column for any game today (the grid has marks and flags only). It is on each child's own page for all five: Parrot and Robin save the slip kind with each round (`slips` column, `20261107000500_parrot.sql:46`, `20261108000100_robin.sql:46`); Pigeon, Lizard and Swamp Hen work it out from the last three rounds on the pupil page (`20261107001000_lizard.sql:300`). So this card does not add a slip column to the grid. See "Not in this card".

## 2. The rule behind it

Rule 9 (record evidence a teacher can use) in `docs/LEARNING-DESIGN.md`: a teacher must see at a glance who is stuck on what, and who has not played. Rule 5 also needs the teacher to be able to see a child stay on the same step.

## 3. The change

Follow the way the six games were added (R7 plan: `docs/plans/maths-review/R7-teacher-foundational-view.md`). Use the kit's `shared/kit/teacherGrid.ts` as it is. No kit change.

**Step 1. New migration** `supabase/migrations/<next number>_foundational_teacher_five.sql` (take the next number after the latest on `main`; at the time of writing the latest is `20261108000200_tui_tenless_hardest.sql`, so check again). It does `create or replace function public.teacher_foundational_class(target uuid)` with the same guard as today (`require_teacher()` then `teaches_class(target, is_school_admin())`) and the same six blocks copied exactly, plus five new blocks, one per game, in the same shape as the Tūī block (`20261107000100_foundational_teacher_views.sql:54-62`), which reads the step from the round. Same function name and signature, so the existing `revoke` and `grant` stay; repeat them at the end of the file to be safe.

Each new block:

```sql
'pigeon', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
    select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
    from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                 case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                 (r.round ->> 'step')::integer as lv, r.finished_at as fin
          from public.pigeon_rounds r
          where r.player = m.student_id and r.finished_at is not null
          order by r.finished_at desc limit 10) x)
  ) from public.pigeon_progress p where p.player = m.student_id),
```

Do the same for `parrot`, `lizard`, `swamphen`, `robin` (tables `parrot_progress` / `parrot_rounds` and so on). `level` is the child's STEP (1 to 7 or 1 to 6), not the help level, as in Tūī. `last_day` is a `date` in these five (the six use differently named columns), so it is formatted with `to_char` as in `pigeon_load` (`20261107000200_pigeon.sql:73`). Check that the column and table names match each game's own migration before applying. Nothing else about the old six changes.

**Step 2. `src/data/foundational.ts`.** Add `'pigeon', 'parrot', 'lizard', 'swamphen', 'robin'` to `GAME_IDS` (line 13). `parseGame` and `parseFoundational` then read them with no other change.

**Step 3. `src/teacher/foundational/config.ts` `GAMES`** (lines 44-50). Add, with step names from each game's own list (so a teacher reads the same words the child's home page shows):

| id | name | levelWord | levels | top |
|---|---|---|---|---|
| `pigeon` | Pigeon | step | 1 Tens on the branch, 2 Read the arrow, 3 Place any number, 4 Ten more, ten less, 5 Which ten is closer?, 6 Zoom in, 7 The long branch (`shared/pigeon/round.ts:30-37`) | 7 |
| `parrot` | Parrot | step | 1 Fill the gap, 2 Turn it round, 3 Swap places, 4 Both sides, 5 Level or not?, 6 Take away (`shared/parrot/config.ts:24-31`) | 6 |
| `lizard` | Lizard | step | 1 Bundles of ten, 2 Tens and ones to 50, 3 To 100, and zero, 4 Tie and untie, 5 Ten more, ten less, 6 Hundreds, 7 All mixed (`shared/lizard/round.ts:30-37`) | 7 |
| `swamphen` | Swamp Hen | step | 1 Equal rows, 2 Turn the garden, 3 Under the mat, 4 Share them out, 5 Cut the garden, 6 One row short (`shared/swamphen/round.ts:31-38`) | 6 |
| `robin` | Robin | step | 1 Give 1 to 5, 2 How many? 1 to 5, 3 Give 6 to 10, 4 How many? 6 to 10, 5 One more, 6 Count to 20 (`shared/robin/config.ts:34-41`) | 6 |

Do NOT repeat the Hop and Penguin Pairs mistake (`DECISIONS.md` section 4, Progress recording): every step of every game must have a name and `top` must be the real top step (`TOP_STEP`: Pigeon 7 `shared/pigeon/config.ts:25`, Parrot 6 `shared/parrot/config.ts:11`, Lizard 7 `shared/lizard/config.ts:25`, Swamp Hen 6 `shared/swamphen/config.ts:25`, Robin 6 `shared/robin/config.ts:11`). Add a test (see section 6) that fails if a step has no name.

**Step 4. `src/teacher/foundational/ideas.ts` `IDEAS`.** Add five columns (use `skillKeys(...)`, which reads the ladder by id, line 17). Put each after the game's nearest older idea:

- `{ id: 'number-line', label: 'The number line', game: 'pigeon', parts: [{ label: '100', keys: skillKeys('number-line-100', 'ten-more-less') }, { label: '1000', keys: skillKeys('number-line-1000') }] }` (two cells, like "Bonds to 100 and 1000", `ideas.ts:45-52`).
- `{ id: 'equals', label: 'The equals sign', game: 'parrot', parts: [{ keys: skillKeys('balance-10', 'balance-20', 'true-false') }] }`.
- `{ id: 'place-value', label: 'Tens and ones', game: 'lizard', parts: [{ label: '100', keys: skillKeys('bundles-50', 'place-value-100', 'regroup-100', 'ten-more-less-100') }, { label: '1000', keys: skillKeys('place-value-1000') }] }`.
- `{ id: 'arrays', label: 'Equal rows and arrays', game: 'swamphen', parts: [{ keys: skillKeys('equal-rows', 'arrays-turn', 'sharing-rows', 'cut-arrays') }] }`. Check whether the "one row short" step has its own ladder skill; if so add it.
- `{ id: 'counting-out', label: 'Counting out and on', game: 'robin', parts: [{ keys: skillKeys('count-out-10', 'count-out-20', 'count-on') }] }`.

The `game` field type is `FoundationalGameId | 'quick-looks'`, so step 2 makes it compile. In `keyWords` (`ideas.ts:100-122`) add plain-words cases so "Hardest right now" is readable (it currently falls back to the raw key): `place100:t30` / `place100:n63` "Place 63 on the line to 100"; `read100:` "Read 63 on the line"; `tens100:+63` "63 + 10", `tens100:-63` "63 − 10"; `near10:n63` "Is 63 nearer 60 or 70?"; `zoom:40-50:47` "Zoom in on 47"; `place1000:`, `read1000:`, `near100:` the same for hundreds; `pvbuild:n47` "Build 47 with bundles"; `pvread:n47` "Read bundles as 47"; `pvzero:n40`; `pvregroup:b23` "Tie 23 sticks"; `pvregroup:s47` "Untie 47"; `pvten:+47`; `pvhun:+347`; `pvbuild3:`, `pvread3:`; `eqmiss:8=5+?` shown as the sum itself ("8 = 5 + ?"); `eqswap:`, `eqboth:`, `eqsub:`, `eqtf:` likewise; `give:n6` "Give 6"; `howmany:n6:ring` "How many? 6"; `counton:5+1` "One more than 5"; `across:n12` "How many? 12"; `rows:4x6` "4 rows of 6"; `turn:3x5` "Turn 3 rows of 5"; `share:24/4` "24 shared into 4 rows"; `cut:6x7` "Cut 6 rows of 7"; `which:3x5` "Which picture is 3 rows of 5". Key shapes: `shared/maths/skillPacks/earlyFacts.ts:373-407`, `:473`, `:528`, `:569-573`.

**Step 5. `src/teacher/foundational/alerts.ts`.** Add the five to `ENABLED` (lines 21-28) with each game's existing "is it on" call: `fetchPigeonEnabled`, `fetchParrotEnabled`, `fetchLizardEnabled`, `fetchSwamphenEnabled`, `fetchRobinEnabled` (all exist: `src/data/<game>.ts`, for example `src/data/robin.ts:56`). The record type is `Record<FoundationalGameId, ...>` so the compiler will say if one is missed.

**Step 6. The five games' `index.tsx` `teacher:` blocks.** Add two lines to each, like Hop (`src/games/hop/index.tsx:59-60`):

```ts
alerts: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalAlerts('pigeon', classId)),
hardest: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalHardest('pigeon', classId)),
```

Files: `src/games/{pigeon,parrot,lizard,swamphen,robin}/index.tsx`. Check the `teacher` type in `src/games/types.ts` already allows `alerts` and `hardest` (the six use it).

**Step 7. The players tracker.** It is outside the repo (a Claude artifact, `docs/PARROT-PLAN.md:184`). Do not build anything. Check that the five tables (`pigeon_rounds`, `parrot_rounds`, `lizard_rounds`, `swamphen_rounds`, `robin_rounds`) are in its query; James's notes say they were added on 8 Nov 2026. If one is missing, tell James, who updates it (it breaks if a table is not live yet, so only after deploy).

**Not in this card:** a "usual slip" column in the class grid (no game has one; the pupil page has it for all five); changing Hop's or Penguin Pairs' config (separate card); showing the wrong answers chosen.

## 4. Files affected

- New: `supabase/migrations/<next>_foundational_teacher_five.sql`.
- Changed, all shared teacher files (the guide says shared edits are small and need James's OK, `docs/GAME_DEVELOPMENT_GUIDE.md` section 3): `src/data/foundational.ts`, `src/teacher/foundational/config.ts`, `src/teacher/foundational/ideas.ts`, `src/teacher/foundational/alerts.ts`, `src/teacher/foundational/foundational.test.tsx`.
- Changed, one small edit each: `src/games/pigeon/index.tsx`, `parrot`, `lizard`, `swamphen`, `robin`.
- No kit file. No `shared/maths`. No game server function.

## 5. Database / migration needs

One new migration that replaces one function (`teacher_foundational_class`); no table, column or row changes, so it is safe to apply. It is a live step: apply it only on James's say-so, by hand (use the Management API with the keychain token; the CLI hangs on this Mac). Apply the migration BEFORE the new page code goes live, or the grid shows "couldn't load" if the page expects fields the old function does not send (it will not: missing games are simply absent, so either order works, but apply first anyway). Test on a throw-away copy first (`scripts/scratch-db.sh`).

## 6. Test steps

Automated (inside the 8-per-game limit; these are teacher-view tests, in `src/teacher/foundational/foundational.test.tsx`, at most three added):
1. Every game in `GAME_IDS` has `GAMES[id]` with a name for every step from 1 to its `top`, and `top` equals that game's real top step (import each game's `TOP_STEP` or `STEPS`). This is the test that would have caught Hop and Penguin Pairs.
2. A class where five pupils sit on Robin step 3 with `recent` finished days on step 3 over 5 days gives an alert text starting "Robin: 5 pupils on the same step for 5 or more days" (copy the Hop test at `foundational.test.tsx:22-27`; mock `fetchRobinEnabled`).
3. `keyWords` turns one key of each new family into words (a table test, one line per family).

By hand, on a throw-away database copy, then the preview: run `select public.teacher_foundational_class('<class id>')` as a teacher of the class and check the five names appear for a pupil who has played each; a teacher of another class gets 42501. In the preview, open a class's Foundational skills page: five new columns, each cell has a mark and a word; a pupil who never played shows "Not started".

## 7. Size and impact

Size M: one migration with five repeated blocks, six small edits and a test, but nothing new to design. Impact High for teachers: without it nobody can see a stuck child in these five games, and it is the only thing that stops them reaching a 4 on progress recording (`DECISIONS.md` section 4).

## 8. Session prompt (ready to paste)

```text
You are building card S17 of the second Foundational maths review for the Games Hub: teachers can't see Pigeon, Parrot, Lizard, Swamp Hen and Robin in the class grid or Today alerts.

Create your own branch and worktree from origin/main, named foundational-five-games. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 9) and docs/plans/maths-review-2/S17-teacher-view-newer-five.md first. Reply to James in plain, simple words.

Steps:
1. Check the latest file in supabase/migrations on origin/main and take the next number. Write supabase/migrations/<next>_foundational_teacher_five.sql: create or replace public.teacher_foundational_class(target uuid) with the same guard and the same six game blocks copied exactly from 20261107000100_foundational_teacher_views.sql, plus a block for each of pigeon, parrot, lizard, swamphen and robin as written in the plan (level = the step, taken from progress `step`; recent from the finished rounds with `round ->> 'step'`; `last_day` is a date, use to_char). Check each table and column name against that game's own migration.
2. src/data/foundational.ts: add the five ids to GAME_IDS.
3. src/teacher/foundational/config.ts: add the five to GAMES with every step named and the right `top` (table in the plan).
4. src/teacher/foundational/ideas.ts: add the five columns in the plan, and plain-words cases in keyWords for the new key families.
5. src/teacher/foundational/alerts.ts: add the five "enabled" calls to ENABLED.
6. Add the two `alerts` and `hardest` lines to the `teacher:` block in src/games/{pigeon,parrot,lizard,swamphen,robin}/index.tsx.
7. Do NOT change shared/kit, shared/maths, Hop or Penguin Pairs config, or any old migration.
Tests (at most three, in src/teacher/foundational/foundational.test.tsx): every step of every game has a name and `top` is the real top step; a Robin "same step" alert reads correctly; keyWords gives words for one key of each new family. Run npm run typecheck and the tests. Try the migration on a throw-away copy (scripts/scratch-db.sh) and check a teacher of another class gets 42501. Check in the preview that the five columns show on a class's Foundational skills page.
The players tracker is outside the repo: only check whether the five tables are in it and tell James.
Stop and tell James before any live step (applying the migration, deploying). Open a PR when done.
```
