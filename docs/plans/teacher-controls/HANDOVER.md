# Teacher controls plan: handover

The review behind this plan is [docs/TEACHER-CONTROLS-REVIEW.md](../../TEACHER-CONTROLS-REVIEW.md) (11 Nov 2026). Screenshots
of the teacher pages today (`now-*.jpg`) and the mock-ups (`mock-*.jpg`) are in the project files folder `teacher-controls/`.

**Plan page with copy-ready prompts and shared status:** https://claude.ai/artifact/R6ymA5r5baTrTtZG2aCxyZ (collection `status`, one doc per card C1 to C9: `state` todo, started or done; `pr`; `updated`).
This file is the record of where things stand. Keep it current in each card's PR.

## The goal

A busy teacher switches a game (or a whole section) on or off for their class in a few taps, sees at a glance what is on right
now, knows when pupils will see it and who changed it, and nothing can change the wrong class.

## How to run it

- One card per session (or per cheap helper). Each card's prompt is below and on the plan page.
- Do the cards in order. C1, C2, C3 and C5 wait for nothing and touch different files, so they can run side by side.
- Before a migration merges, check its number is free on main (`node scripts/migration-numbers.mjs`).
- Merging to main deploys migrations, edge functions and the site. Merging is pre-approved. Ask James before deleting anything.
- A card that changes what a new game must add also updates `docs/GAME_DEVELOPMENT_GUIDE.md` in its own PR (James, 11 Nov 2026).

## Cards, in order

| # | Card | Size | SQL | Waits for |
|---|---|---|---|---|
| C1 | [Fix the rows that say the wrong thing](#c1) | S | yes | nothing |
| C2 | [Safer saves: every save names its class](#c2) | S | yes | nothing |
| C3 | [Pupils see changes straight away](#c3) | S | no | nothing |
| C4 | [Games tab: what's on at a glance, and whole sections at once](#c4) | M | yes | C1 |
| C5 | [Same words everywhere](#c5) | S | no | nothing |
| C6 | [Who changed it, and when](#c6) | M | yes | C2 |
| C7 | [School defaults for new classes, and one rule for a new game](#c7) | M | yes | C2 |
| C8 | [Game sets: switch to a saved set in one tap](#c8) | M | yes | C4 |
| C9 | [Guide matches, check live, close the review](#c9) | S | no | C1 to C8 |

Later, only if James asks: **Who can play** (games for some groups or pupils; mock-up `mock-who-plays-laptop.jpg`), size L.

## Done and live

- C1: Fix the rows that say the wrong thing (PR #420)
- C5: Same words everywhere (PR #422)
- C3: Pupils see changes straight away (PR #423)
- C2: Safer saves: every save names its class (PR #421)
- C4: Games tab: what's on at a glance, and whole sections at once (PR #424)
- C6: Who changed it, and when (PR #425)
- C7: School defaults for new classes, and one rule for a new game (PR #426)
- C8: Game sets: switch to a saved set in one tap (PR #427)

## C1

### Fix the rows that say the wrong thing (size S, database change)

**What's wrong now.** On the Games tab, chess, checkers, 101 and Power Clash say 'always', but they are switched off by 'Non-maths games' on the Today tab. Kingdom Keeper has a working switch, but its code switch is off, so pupils never see it. Star Forge (trader_forge) has a save function but no switch anywhere. And save-bot-game never reads non_maths_games, so chess and checkers against a bot still save and score while Non-maths games is off.

**Done looks like.** The four No maths rows show one shared switch, 'On with Non-maths games', that sets non_maths_games (the same value as on Today). Games whose code switch is off (Kingdom Keeper today) have no row. Star Trader's drawer has a 'Star Forge' switch. A bot game saved while Non-maths games is off for the pupil's class is refused with a friendly message and no points.

**Waits for.** nothing

**Steps.**

1. src/teacher/Games.tsx: build the table from GAMES (the games in the hub), not ALL_GAMES; check nothing else on the Games tab needs ALL_GAMES. Leave the Progress tab and student pages alone.
2. In GameRow, for a game with group 'no-maths' and no switch, show a SettingToggle (compact) bound to fetchNonMathsGames(classId)/saveNonMathsGames(on, classId) from src/data/nonMathsGames.ts, labelled for screen readers '<game> (with Non-maths games)', about: 'Chess, checkers, 101 and Power Clash share one switch. It is the same as Non-maths games on Today.' Load it once for the table (one useSetting in GamesTable, passed down), not once per row.
3. src/pages/TeacherTrader.tsx: add SettingToggle 'Star Forge' (about: 'Off hides the Forge for this class. Ships already made are kept.') using fetch from the Trader settings and saveTraderForge(on, classId) from src/data/trader.ts. Check supabase/functions/trader honours trader_forge on the server; if not, add the check there.
4. Edge function supabase/functions/save-bot-game: before saving, read the player's settings with admin.rpc('settings_of', { player }) (copy how supabase/functions/pipi/entry.ts does it) and refuse with a FriendlyError-style message 'Your teacher has switched these games off for now.' when non_maths_games is false and the game is chess or checkers. Keep it one extra request.
5. No migration needed unless step 3 needs one.

**Files.** src/teacher/Games.tsx; src/teacher/Games.test.tsx; src/pages/TeacherTrader.tsx; supabase/functions/save-bot-game/ (and its handler tests); supabase/functions/trader if needed

**Tests.** Games.test.tsx: the chess row shows a switch that saves non_maths_games; Kingdom Keeper has no row while kingdomOn() is false. One save-bot-game handler test: refused while non_maths_games is false. npm run build:functions (or the repo's function build) still passes.

**Session prompt (ready to paste)**

```text
You are building card C1 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Fix the rows that say the wrong thing.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c1. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: On the Games tab, chess, checkers, 101 and Power Clash say 'always', but they are switched off by 'Non-maths games' on the Today tab. Kingdom Keeper has a working switch, but its code switch is off, so pupils never see it. Star Forge (trader_forge) has a save function but no switch anywhere. And save-bot-game never reads non_maths_games, so chess and checkers against a bot still save and score while Non-maths games is off.

What done looks like: The four No maths rows show one shared switch, 'On with Non-maths games', that sets non_maths_games (the same value as on Today). Games whose code switch is off (Kingdom Keeper today) have no row. Star Trader's drawer has a 'Star Forge' switch. A bot game saved while Non-maths games is off for the pupil's class is refused with a friendly message and no points.

Steps:
1. src/teacher/Games.tsx: build the table from GAMES (the games in the hub), not ALL_GAMES; check nothing else on the Games tab needs ALL_GAMES. Leave the Progress tab and student pages alone.
2. In GameRow, for a game with group 'no-maths' and no switch, show a SettingToggle (compact) bound to fetchNonMathsGames(classId)/saveNonMathsGames(on, classId) from src/data/nonMathsGames.ts, labelled for screen readers '<game> (with Non-maths games)', about: 'Chess, checkers, 101 and Power Clash share one switch. It is the same as Non-maths games on Today.' Load it once for the table (one useSetting in GamesTable, passed down), not once per row.
3. src/pages/TeacherTrader.tsx: add SettingToggle 'Star Forge' (about: 'Off hides the Forge for this class. Ships already made are kept.') using fetch from the Trader settings and saveTraderForge(on, classId) from src/data/trader.ts. Check supabase/functions/trader honours trader_forge on the server; if not, add the check there.
4. Edge function supabase/functions/save-bot-game: before saving, read the player's settings with admin.rpc('settings_of', { player }) (copy how supabase/functions/pipi/entry.ts does it) and refuse with a FriendlyError-style message 'Your teacher has switched these games off for now.' when non_maths_games is false and the game is chess or checkers. Keep it one extra request.
5. No migration needed unless step 3 needs one.

Files: src/teacher/Games.tsx; src/teacher/Games.test.tsx; src/pages/TeacherTrader.tsx; supabase/functions/save-bot-game/ (and its handler tests); supabase/functions/trader if needed

Tests and checks: Games.test.tsx: the chess row shows a switch that saves non_maths_games; Kingdom Keeper has no row while kingdomOn() is false. One save-bot-game handler test: refused while non_maths_games is false. npm run build:functions (or the repo's function build) still passes.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C2

### Safer saves: every save names its class (size S, database change)

**What's wrong now.** Every teacher_set_* function takes target_class. When it is null, settings_to_change() returns every class the teacher teaches, and for a school admin every class in the school plus the school's defaults row (class_id null). No page sends null today, but every save helper in src/data/*.ts defaults to `classId ?? null`, so one missed argument would change the whole school.

**Done looks like.** A teacher save with no class is refused by the database ('Pick a class first.'). The save helpers in src/data take classId as a required string. The school's defaults row can only be changed by the new admin function in C7.

**Waits for.** nothing

**Steps.**

1. Migration <next>_settings_need_a_class.sql: create or replace public.require_settings_target(target_class uuid) (latest body in supabase/migrations/20261018002500_school_and_class_checks.sql; check nothing newer defines it) so it first raises 'Pick a class first.' (errcode 22023) when target_class is null, then does its existing check. Keep its grants. All teacher_set_* functions call it before updating, so this one change covers them; check with a grep over supabase/migrations that every function using settings_to_change( also calls require_settings_target( first, and list any that don't in the PR.
2. src/data/*.ts: change `classId?: string | null` to `classId: string` on every teacher save helper that sends target_class (grep `target_class: classId ?? null`, 43 places) and send `target_class: classId`. Fix any caller the type checker flags (there should be none on teacher pages).
3. Pupil-side reads (readSettings with no class) are unchanged.

**Files.** new migration; src/data/*.ts save helpers; supabase/tests/database/ (one pgTAP test)

**Tests.** A pgTAP test in supabase/tests/database/: a teacher calling teacher_set_pipi(true, null, null) gets 22023 and no row changes; with their class it works; with another teacher's class it gets 42501. npm run typecheck.

**Session prompt (ready to paste)**

```text
You are building card C2 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Safer saves: every save names its class.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c2. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: Every teacher_set_* function takes target_class. When it is null, settings_to_change() returns every class the teacher teaches, and for a school admin every class in the school plus the school's defaults row (class_id null). No page sends null today, but every save helper in src/data/*.ts defaults to `classId ?? null`, so one missed argument would change the whole school.

What done looks like: A teacher save with no class is refused by the database ('Pick a class first.'). The save helpers in src/data take classId as a required string. The school's defaults row can only be changed by the new admin function in C7.

Steps:
1. Migration <next>_settings_need_a_class.sql: create or replace public.require_settings_target(target_class uuid) (latest body in supabase/migrations/20261018002500_school_and_class_checks.sql; check nothing newer defines it) so it first raises 'Pick a class first.' (errcode 22023) when target_class is null, then does its existing check. Keep its grants. All teacher_set_* functions call it before updating, so this one change covers them; check with a grep over supabase/migrations that every function using settings_to_change( also calls require_settings_target( first, and list any that don't in the PR.
2. src/data/*.ts: change `classId?: string | null` to `classId: string` on every teacher save helper that sends target_class (grep `target_class: classId ?? null`, 43 places) and send `target_class: classId`. Fix any caller the type checker flags (there should be none on teacher pages).
3. Pupil-side reads (readSettings with no class) are unchanged.

Files: new migration; src/data/*.ts save helpers; supabase/tests/database/ (one pgTAP test)

Tests and checks: A pgTAP test in supabase/tests/database/: a teacher calling teacher_set_pipi(true, null, null) gets 22023 and no row changes; with their class it works; with another teacher's class it gets 42501. npm run typecheck.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C3

### Pupils see changes straight away (size S)

**What's wrong now.** A pupil's screen remembers the class settings for 5 minutes (src/data/settingsMemory.ts, SETTINGS_KEEP_MS). A game the teacher just turned on can take up to 5 minutes to appear on a pupil's home page unless they reload, and 'Saved ✓' doesn't say so. The server already checks every switch at once.

**Done looks like.** The pupil's home page reads the settings fresh when it opens if the remembered row is more than 30 seconds old, and again when the tab comes back into view. Other pages keep the 5-minute memory. A teacher's 'Saved ✓' on any class switch reads 'Saved ✓ Pupils see it when their home page next opens.' for 3 seconds.

**Waits for.** nothing

**Steps.**

1. src/data/settingsMemory.ts: add `rememberedSettings(read, maxAgeMs = SETTINGS_KEEP_MS)` and export `FRESH_HOME_MS = 30_000`; on visibilitychange to visible, forget the row if it is older than FRESH_HOME_MS (keep the 5-minute rule for hidden tabs).
2. src/data/classSettings.ts readSettings: accept an optional maxAgeMs and pass it through.
3. src/pages/Dashboard.tsx: on mount, call forgetSettings() if the remembered row is older than FRESH_HOME_MS, before the switch hooks run (one request still serves every card).
4. src/teacher/Settings.tsx: let SettingToggle/SettingChoice take an optional `savedText`; the Games table switches, Lesson controls and Unlimited turns pass 'Saved ✓ Pupils see it when their home page next opens.'

**Files.** src/data/settingsMemory.ts; src/data/classSettings.ts; src/pages/Dashboard.tsx; src/teacher/Settings.tsx; src/teacher/Games.tsx; src/teacher/Today.tsx; tests beside them

**Tests.** settingsMemory test: a row older than 30 s is read again when the home page opens; younger is reused. RequestCount test: still one settings request on the home page.

**Session prompt (ready to paste)**

```text
You are building card C3 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Pupils see changes straight away.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c3. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: A pupil's screen remembers the class settings for 5 minutes (src/data/settingsMemory.ts, SETTINGS_KEEP_MS). A game the teacher just turned on can take up to 5 minutes to appear on a pupil's home page unless they reload, and 'Saved ✓' doesn't say so. The server already checks every switch at once.

What done looks like: The pupil's home page reads the settings fresh when it opens if the remembered row is more than 30 seconds old, and again when the tab comes back into view. Other pages keep the 5-minute memory. A teacher's 'Saved ✓' on any class switch reads 'Saved ✓ Pupils see it when their home page next opens.' for 3 seconds.

Steps:
1. src/data/settingsMemory.ts: add `rememberedSettings(read, maxAgeMs = SETTINGS_KEEP_MS)` and export `FRESH_HOME_MS = 30_000`; on visibilitychange to visible, forget the row if it is older than FRESH_HOME_MS (keep the 5-minute rule for hidden tabs).
2. src/data/classSettings.ts readSettings: accept an optional maxAgeMs and pass it through.
3. src/pages/Dashboard.tsx: on mount, call forgetSettings() if the remembered row is older than FRESH_HOME_MS, before the switch hooks run (one request still serves every card).
4. src/teacher/Settings.tsx: let SettingToggle/SettingChoice take an optional `savedText`; the Games table switches, Lesson controls and Unlimited turns pass 'Saved ✓ Pupils see it when their home page next opens.'

Files: src/data/settingsMemory.ts; src/data/classSettings.ts; src/pages/Dashboard.tsx; src/teacher/Settings.tsx; src/teacher/Games.tsx; src/teacher/Today.tsx; tests beside them

Tests and checks: settingsMemory test: a row older than 30 s is read again when the home page opens; younger is reused. RequestCount test: still one settings request on the home page.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C4

### Games tab: what's on at a glance, and whole sections at once (size M, database change)

**What's wrong now.** The Games tab is 30 rows (about 3 laptop screens, 5 on an iPad) with no count of what's on, no way to show only the games that are on, and no way to switch a section. 'Only Foundational games today' takes up to 23 taps. Unlimited turns lives only on the Today tab.

**Done looks like.** Looks like mock-games-on-now-laptop.jpg and mock-games-on-now-ipad.jpg. A summary strip: 'On for <class>: 17 of 30 games' and chips Show All | On | Off (remembered on this computer). Each section heading has '8 of 11 on' and All on / All off buttons, saved in one request. A narrow 'Unlimited today' column holds the six games' Unlimited switches (Today keeps its panel). Turning a section off asks once: 'Turn off all 11 Foundational games for Room 12?'.

**Waits for.** C1

**Steps.**

1. Migration <next>_teacher_set_games.sql: new public.teacher_set_games(changes jsonb, target_class uuid) security definer: require_teacher(); require_settings_target(target_class); for each key in changes, the key must be a switch_column in public.hub_games or one of 'monsters_enabled','lord_enabled','clans_enabled','non_maths_games' (raise 22023 otherwise) and the value a boolean; apply them with one dynamic UPDATE using format('%I', key) on the class's row. Grant execute to authenticated only. Never drop anything.
2. Give Dragon Maths, Clan Quest and Maths Monsters their switch_column in hub_games in the same migration only if the hub_games trigger accepts it without side effects (read 20261020000100_game_hooks.sql first); otherwise keep the explicit list in step 1.
3. src/data/games.ts (new): saveGameSwitches(changes: Record<string, boolean>, classId: string) and a GameDefinition-free map from game id to its column. Add `switchColumn` to TeacherContract.switch if the dashboard plan's D5 hasn't already added GameDefinition.switchColumn; reuse it if it has.
4. src/teacher/Games.tsx: the summary strip, Show chips (localStorage 'teacher-games-show', try/catch), the per-section counts and All on / All off (one saveGameSwitches call, then reload the rows' values), and the Unlimited today column using UNLIMITED_GAMES from shared/unlimited.ts and fetchUnlimitedToday/saveUnlimitedToday (one load for the table). A confirm step only for All off.
5. Keep each row's own switch working exactly as now. On a narrow screen the rows are cards: the Unlimited switch goes under the On switch.

**Files.** new migration; src/data/games.ts; src/teacher/Games.tsx; src/teacher/games.css; src/teacher/Games.test.tsx; supabase/tests/database/

**Tests.** Games.test.tsx: count is right, Show On hides off games, All off sends one request with every column in the section after the confirm. pgTAP: teacher_set_games refuses an unknown column and another teacher's class. Screenshots at 1366x768 and 768x1024 in the PR (scratch teacher preview, see the shared rules).

**Session prompt (ready to paste)**

```text
You are building card C4 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Games tab: what's on at a glance, and whole sections at once.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c4. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: The Games tab is 30 rows (about 3 laptop screens, 5 on an iPad) with no count of what's on, no way to show only the games that are on, and no way to switch a section. 'Only Foundational games today' takes up to 23 taps. Unlimited turns lives only on the Today tab.

What done looks like: Looks like mock-games-on-now-laptop.jpg and mock-games-on-now-ipad.jpg. A summary strip: 'On for <class>: 17 of 30 games' and chips Show All | On | Off (remembered on this computer). Each section heading has '8 of 11 on' and All on / All off buttons, saved in one request. A narrow 'Unlimited today' column holds the six games' Unlimited switches (Today keeps its panel). Turning a section off asks once: 'Turn off all 11 Foundational games for Room 12?'.

Steps:
1. Migration <next>_teacher_set_games.sql: new public.teacher_set_games(changes jsonb, target_class uuid) security definer: require_teacher(); require_settings_target(target_class); for each key in changes, the key must be a switch_column in public.hub_games or one of 'monsters_enabled','lord_enabled','clans_enabled','non_maths_games' (raise 22023 otherwise) and the value a boolean; apply them with one dynamic UPDATE using format('%I', key) on the class's row. Grant execute to authenticated only. Never drop anything.
2. Give Dragon Maths, Clan Quest and Maths Monsters their switch_column in hub_games in the same migration only if the hub_games trigger accepts it without side effects (read 20261020000100_game_hooks.sql first); otherwise keep the explicit list in step 1.
3. src/data/games.ts (new): saveGameSwitches(changes: Record<string, boolean>, classId: string) and a GameDefinition-free map from game id to its column. Add `switchColumn` to TeacherContract.switch if the dashboard plan's D5 hasn't already added GameDefinition.switchColumn; reuse it if it has.
4. src/teacher/Games.tsx: the summary strip, Show chips (localStorage 'teacher-games-show', try/catch), the per-section counts and All on / All off (one saveGameSwitches call, then reload the rows' values), and the Unlimited today column using UNLIMITED_GAMES from shared/unlimited.ts and fetchUnlimitedToday/saveUnlimitedToday (one load for the table). A confirm step only for All off.
5. Keep each row's own switch working exactly as now. On a narrow screen the rows are cards: the Unlimited switch goes under the On switch.

Files: new migration; src/data/games.ts; src/teacher/Games.tsx; src/teacher/games.css; src/teacher/Games.test.tsx; supabase/tests/database/

Tests and checks: Games.test.tsx: count is right, Show On hides off games, All off sends one request with every column in the section after the confirm. pgTAP: teacher_set_games refuses an unknown column and another teacher's class. Screenshots at 1366x768 and 768x1024 in the PR (scratch teacher preview, see the shared rules).

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C5

### Same words everywhere (size S)

**What's wrong now.** The same 3-way help choice has five names across 8 Foundational games (Picture help, Mat help, Branch help, Counting help, Garden help); Pipi, Hop and Kiwi's Beanstalk have a plain on/off help with other names. Some '?' texts are a 150-word paragraph (Pipi's) while others are one line. Emoji reactions is on both Today and the Wormholes drawer. Clan Quest's row says 'Year y3-4' while its drawer says 'Year 4 / Year 5 / Year 6'.

**Done looks like.** Every Foundational drawer's help setting is labelled 'Help' with the same three choices 'Fades', 'Always on', 'Off' (Pipi, Hop and Beanstalk keep their on/off but are labelled 'Help' too, with what the help is in the detail line). Every switch's '?' opens one short line first and a 'More' that unfolds the rest. Emoji reactions is only on Today (the Wormholes drawer links to it). Clan Quest's row summary uses the drawer's own year band words.

**Waits for.** nothing

**Steps.**

1. src/pages/Teacher{Weka,Pigeon,Korora,Tui,Parrot,Lizard,Swamphen,Robin}.tsx: label 'Help', keep each game's own detail text for each choice. Pipi, Hop, Beanstalk: label 'Help', about says what it shows ('Outlines in the sand where the hiding shells are').
2. src/teacher/Settings.tsx Label: when `about` is a string longer than about 140 characters, show its first sentence and a 'More' button that shows the rest (no change for short ones or elements).
3. src/pages/TeacherSpace.tsx: replace the Emoji reactions toggle with a line 'Emoji reactions are on the Today tab.' and a link.
4. src/games/clans (its useSummary for the Games row): show the year band with the same words as the drawer's Year band choice.
5. Don't change any setting's value, column or server function.

**Files.** src/pages/Teacher*.tsx (the 11 Foundational drawers and TeacherSpace); src/teacher/Settings.tsx; their tests

**Tests.** Settings.test.tsx: a long about shows its first sentence and More. Update any test that looks for the old labels.

**Session prompt (ready to paste)**

```text
You are building card C5 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Same words everywhere.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c5. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: The same 3-way help choice has five names across 8 Foundational games (Picture help, Mat help, Branch help, Counting help, Garden help); Pipi, Hop and Kiwi's Beanstalk have a plain on/off help with other names. Some '?' texts are a 150-word paragraph (Pipi's) while others are one line. Emoji reactions is on both Today and the Wormholes drawer. Clan Quest's row says 'Year y3-4' while its drawer says 'Year 4 / Year 5 / Year 6'.

What done looks like: Every Foundational drawer's help setting is labelled 'Help' with the same three choices 'Fades', 'Always on', 'Off' (Pipi, Hop and Beanstalk keep their on/off but are labelled 'Help' too, with what the help is in the detail line). Every switch's '?' opens one short line first and a 'More' that unfolds the rest. Emoji reactions is only on Today (the Wormholes drawer links to it). Clan Quest's row summary uses the drawer's own year band words.

Steps:
1. src/pages/Teacher{Weka,Pigeon,Korora,Tui,Parrot,Lizard,Swamphen,Robin}.tsx: label 'Help', keep each game's own detail text for each choice. Pipi, Hop, Beanstalk: label 'Help', about says what it shows ('Outlines in the sand where the hiding shells are').
2. src/teacher/Settings.tsx Label: when `about` is a string longer than about 140 characters, show its first sentence and a 'More' button that shows the rest (no change for short ones or elements).
3. src/pages/TeacherSpace.tsx: replace the Emoji reactions toggle with a line 'Emoji reactions are on the Today tab.' and a link.
4. src/games/clans (its useSummary for the Games row): show the year band with the same words as the drawer's Year band choice.
5. Don't change any setting's value, column or server function.

Files: src/pages/Teacher*.tsx (the 11 Foundational drawers and TeacherSpace); src/teacher/Settings.tsx; their tests

Tests and checks: Settings.test.tsx: a long about shows its first sentence and More. Update any test that looks for the old labels.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C6

### Who changed it, and when (size M, database change)

**What's wrong now.** Two teachers on one class, or a school admin, can change a switch without the other knowing. Nobody can see when a game was turned off, or by whom. admin_log exists for admin actions only.

**Done looks like.** Under each switch on the Games tab and Today: a small grey line 'Changed by you, 9:12am' or 'Changed by Mr Tane, yesterday' (real teacher names are fine: teachers only). Class set-up has 'Recent changes': the last 20 setting changes for the class with who, when, what and from/to. Pupils never see it.

**Waits for.** C2

**Steps.**

1. Migration <next>_settings_changes.sql: table public.settings_changes (id bigint identity, class_id uuid references classes on delete cascade, changed_by uuid, changed_at timestamptz default now(), setting text, old_value jsonb, new_value jsonb); RLS on, select only where teaches_class(class_id); no insert/update/delete policies. An AFTER UPDATE trigger on app_settings (security definer, search_path '') that, for a row with class_id not null, inserts one row per column whose value changed (compare to_jsonb(old) and to_jsonb(new) key by key, skipping id, class_id, school_id), with changed_by auth.uid(). Keep it light: one statement.
2. New function public.teacher_settings_changes(target_class uuid, max_rows int default 20) returning jsonb rows with the teacher's display name (from profiles), after require_settings_target.
3. src/data/settingsChanges.ts: fetchSettingsChanges(classId) and a hook that returns the latest change per setting, cached for the page. src/teacher/Settings.tsx: optional `changed` line under a control. Games tab rows and Today's controls show it, mapping each control to its column.
4. src/pages/MyClasses.tsx (Class set-up): a 'Recent changes' panel in plain words: 'Mr Tane turned Clan Quest off · 2:14pm'. Use the game names from the registry and the control labels for other columns.
5. New Season / end of year: don't delete these rows. If a clean-up is ever wanted, ask James first (it deletes data).

**Files.** new migration; src/data/settingsChanges.ts; src/teacher/Settings.tsx; src/teacher/Games.tsx; src/teacher/Today.tsx; src/pages/MyClasses.tsx; tests; supabase/tests/database/

**Tests.** pgTAP: a change by teacher A logs one row per changed column; teacher B of another class can't read it. A component test for 'Changed by you'.

**Session prompt (ready to paste)**

```text
You are building card C6 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Who changed it, and when.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c6. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: Two teachers on one class, or a school admin, can change a switch without the other knowing. Nobody can see when a game was turned off, or by whom. admin_log exists for admin actions only.

What done looks like: Under each switch on the Games tab and Today: a small grey line 'Changed by you, 9:12am' or 'Changed by Mr Tane, yesterday' (real teacher names are fine: teachers only). Class set-up has 'Recent changes': the last 20 setting changes for the class with who, when, what and from/to. Pupils never see it.

Steps:
1. Migration <next>_settings_changes.sql: table public.settings_changes (id bigint identity, class_id uuid references classes on delete cascade, changed_by uuid, changed_at timestamptz default now(), setting text, old_value jsonb, new_value jsonb); RLS on, select only where teaches_class(class_id); no insert/update/delete policies. An AFTER UPDATE trigger on app_settings (security definer, search_path '') that, for a row with class_id not null, inserts one row per column whose value changed (compare to_jsonb(old) and to_jsonb(new) key by key, skipping id, class_id, school_id), with changed_by auth.uid(). Keep it light: one statement.
2. New function public.teacher_settings_changes(target_class uuid, max_rows int default 20) returning jsonb rows with the teacher's display name (from profiles), after require_settings_target.
3. src/data/settingsChanges.ts: fetchSettingsChanges(classId) and a hook that returns the latest change per setting, cached for the page. src/teacher/Settings.tsx: optional `changed` line under a control. Games tab rows and Today's controls show it, mapping each control to its column.
4. src/pages/MyClasses.tsx (Class set-up): a 'Recent changes' panel in plain words: 'Mr Tane turned Clan Quest off · 2:14pm'. Use the game names from the registry and the control labels for other columns.
5. New Season / end of year: don't delete these rows. If a clean-up is ever wanted, ask James first (it deletes data).

Files: new migration; src/data/settingsChanges.ts; src/teacher/Settings.tsx; src/teacher/Games.tsx; src/teacher/Today.tsx; src/pages/MyClasses.tsx; tests; supabase/tests/database/

Tests and checks: pgTAP: a change by teacher A logs one row per changed column; teacher B of another class can't read it. A component test for 'Changed by you'.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C7

### School defaults for new classes, and one rule for a new game (size M, database change)

**What's wrong now.** A new class copies the school's defaults row (app_settings with class_id null, give_class_settings), but no page can change that row, so every new class starts with everything on. The guide says a new game's switches start off, but the 15 newest games' columns default to on, so a new game goes on for every class the day it ships.

**Done looks like.** Admin has a 'New class settings' tab: the same Games table and Lesson controls, editing the school's defaults row, with the line 'New classes start like this. Existing classes don't change.' A school admin can also press 'Copy to every class' (with a confirm naming the number of classes). A new game's switch starts on for every class (James, 11 Nov 2026): its column defaults to true and the school's defaults row gets it, written in docs/GAME_DEVELOPMENT_GUIDE.md and checked by a test.

**Waits for.** C2

**Steps.**

1. Migration <next>_school_defaults.sql: public.admin_set_school_default(changes jsonb) (require is_school_admin(); same column check as teacher_set_games from C4, plus the per-game settings columns listed in the migration; updates only the row where class_id is null and school_id = my_school()); public.admin_school_defaults() returning that row; public.admin_copy_defaults_to_classes(columns text[]) that copies those columns to every non-archived class in the school and writes one admin_log row. Never drop anything.
2. src/teacher/Admin.tsx + App.tsx route teacher/admin/defaults: reuse GamesTable and LessonControls with a `target` prop ({ kind: 'school' } vs { kind: 'class', classId }) so the controls don't fork.
3. The new-game rule (James chose 'on for every class', 11 Nov 2026): a pgTAP test in supabase/tests/database checks every hub_games.switch_column defaults to true (list the older columns that default false, such as monsters_enabled and archery_enabled, in the PR, and set their defaults to true with alter column ... set default true in the same migration; that changes no existing class's settings). Update docs/GAME_DEVELOPMENT_GUIDE.md section 8 (the 'switches start off' lines) to say a new game's switch starts on for every class and the server must still check it.

**Files.** new migration; src/teacher/Admin.tsx; src/App.tsx; src/teacher/Games.tsx and Today.tsx (target prop); docs/GAME_DEVELOPMENT_GUIDE.md; tests

**Tests.** pgTAP: a non-admin can't call admin_set_school_default; it changes only the defaults row; a class made afterwards copies it. Admin.test.tsx: the tab shows and saves.

**Session prompt (ready to paste)**

```text
You are building card C7 of the teacher controls plan for the Games Hub (how teachers turn things on and off): School defaults for new classes, and one rule for a new game.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c7. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: A new class copies the school's defaults row (app_settings with class_id null, give_class_settings), but no page can change that row, so every new class starts with everything on. The guide says a new game's switches start off, but the 15 newest games' columns default to on, so a new game goes on for every class the day it ships.

What done looks like: Admin has a 'New class settings' tab: the same Games table and Lesson controls, editing the school's defaults row, with the line 'New classes start like this. Existing classes don't change.' A school admin can also press 'Copy to every class' (with a confirm naming the number of classes). A new game's switch starts on for every class (James, 11 Nov 2026): its column defaults to true and the school's defaults row gets it, written in docs/GAME_DEVELOPMENT_GUIDE.md and checked by a test.

Steps:
1. Migration <next>_school_defaults.sql: public.admin_set_school_default(changes jsonb) (require is_school_admin(); same column check as teacher_set_games from C4, plus the per-game settings columns listed in the migration; updates only the row where class_id is null and school_id = my_school()); public.admin_school_defaults() returning that row; public.admin_copy_defaults_to_classes(columns text[]) that copies those columns to every non-archived class in the school and writes one admin_log row. Never drop anything.
2. src/teacher/Admin.tsx + App.tsx route teacher/admin/defaults: reuse GamesTable and LessonControls with a `target` prop ({ kind: 'school' } vs { kind: 'class', classId }) so the controls don't fork.
3. The new-game rule (James chose 'on for every class', 11 Nov 2026): a pgTAP test in supabase/tests/database checks every hub_games.switch_column defaults to true (list the older columns that default false, such as monsters_enabled and archery_enabled, in the PR, and set their defaults to true with alter column ... set default true in the same migration; that changes no existing class's settings). Update docs/GAME_DEVELOPMENT_GUIDE.md section 8 (the 'switches start off' lines) to say a new game's switch starts on for every class and the server must still check it.

Files: new migration; src/teacher/Admin.tsx; src/App.tsx; src/teacher/Games.tsx and Today.tsx (target prop); docs/GAME_DEVELOPMENT_GUIDE.md; tests

Tests and checks: pgTAP: a non-admin can't call admin_set_school_default; it changes only the defaults row; a class made afterwards copies it. Admin.test.tsx: the tab shows and saves.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C8

### Game sets: switch to a saved set in one tap (size M, database change)

**What's wrong now.** A teacher who wants 'maths games only this week' or 'Foundational games for the reading group's time' switches games one by one, and back again later.

**Done looks like.** Looks like mock-game-sets-laptop.jpg. Today has a 'Game sets' panel: three ready sets (Maths only, Foundational, Everything) and the teacher's own saved sets, each with 'Use now'; the set in use is marked; '+ Save today's games as a set' saves the current on/off of every game. Using a set changes only game on/off switches, in one request, and shows 'Room 12 now has Maths only: 12 games on.'

**Waits for.** C4

**Steps.**

1. Migration <next>_game_sets.sql: table public.class_game_sets (id uuid default gen_random_uuid(), class_id uuid references classes on delete cascade, name text check length 1..40, games jsonb (column -> boolean), made_by uuid, made_at timestamptz default now()); RLS select where teaches_class(class_id); functions teacher_save_game_set(target_class, set_name, games), teacher_delete_game_set(set_id) (deletes one set the teacher's class owns: this is a teacher's own action, not a data clean-up), teacher_use_game_set(set_id) which calls the same update as teacher_set_games.
2. The three ready sets are built in the client from GAME_GROUPS (Maths only = easy-maths + complex-maths; Foundational = foundational; Everything = all), so new games join them automatically.
3. src/teacher/Today.tsx: the Game sets panel above Lesson controls; 'In use' when the class's current switches equal a set's.
4. Don't add timed switches here (left for later).

**Files.** new migration; src/data/gameSets.ts; src/teacher/Today.tsx; css; tests

**Tests.** A component test: Use now sends one request and marks the set in use. pgTAP: another teacher can't use or delete a set.

**Session prompt (ready to paste)**

```text
You are building card C8 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Game sets: switch to a saved set in one tap.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c8. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: A teacher who wants 'maths games only this week' or 'Foundational games for the reading group's time' switches games one by one, and back again later.

What done looks like: Looks like mock-game-sets-laptop.jpg. Today has a 'Game sets' panel: three ready sets (Maths only, Foundational, Everything) and the teacher's own saved sets, each with 'Use now'; the set in use is marked; '+ Save today's games as a set' saves the current on/off of every game. Using a set changes only game on/off switches, in one request, and shows 'Room 12 now has Maths only: 12 games on.'

Steps:
1. Migration <next>_game_sets.sql: table public.class_game_sets (id uuid default gen_random_uuid(), class_id uuid references classes on delete cascade, name text check length 1..40, games jsonb (column -> boolean), made_by uuid, made_at timestamptz default now()); RLS select where teaches_class(class_id); functions teacher_save_game_set(target_class, set_name, games), teacher_delete_game_set(set_id) (deletes one set the teacher's class owns: this is a teacher's own action, not a data clean-up), teacher_use_game_set(set_id) which calls the same update as teacher_set_games.
2. The three ready sets are built in the client from GAME_GROUPS (Maths only = easy-maths + complex-maths; Foundational = foundational; Everything = all), so new games join them automatically.
3. src/teacher/Today.tsx: the Game sets panel above Lesson controls; 'In use' when the class's current switches equal a set's.
4. Don't add timed switches here (left for later).

Files: new migration; src/data/gameSets.ts; src/teacher/Today.tsx; css; tests

Tests and checks: A component test: Use now sends one request and marks the set in use. pgTAP: another teacher can't use or delete a set.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## C9

### Guide matches, check live, close the review (size S)

**What's wrong now.** The game development guide's switch rules are spread over sections 1a, 3 and 8, and say 'switches start off', which isn't what happens. After C1 to C8 a new game also needs its column in the bulk save list and in the change log names.

**Done looks like.** docs/GAME_DEVELOPMENT_GUIDE.md has one short 'Teacher switch' rule list: the column and its default, hub_games.switch_column, the server check, the Unlimited turns list if it has a daily limit, and nothing else to add by hand. Live check as a teacher on Room Riley: Games tab count, a section off and on, a game set, the change line, and a pupil home page update. docs/plans/teacher-controls/HANDOVER.md all ticked; project memory updated.

**Waits for.** C1 to C8

**Steps.**

1. Edit section 1b/3/8 of docs/GAME_DEVELOPMENT_GUIDE.md in place, written for Claude (short rules, file beside each, no history).
2. Live check with James's teacher account in the browser (ask James on a question card if you can't sign in), screenshots into the project files folder teacher-controls/after-*.jpg.
3. Tick every card in HANDOVER.md with its PR number.

**Files.** docs/GAME_DEVELOPMENT_GUIDE.md; docs/plans/teacher-controls/HANDOVER.md; docs/TEACHER-CONTROLS-REVIEW.md ('After' section)

**Tests.** None new.

**Session prompt (ready to paste)**

```text
You are building card C9 of the teacher controls plan for the Games Hub (how teachers turn things on and off): Guide matches, check live, close the review.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-CONTROLS-REVIEW.md and your card in docs/plans/teacher-controls/HANDOVER.md first. Create your own branch from origin/main named teacher-controls-c9. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real teacher pages on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher, and never talk to the live server; check 1366x768 and 768x1024 and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-controls/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Teacher Controls Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: The game development guide's switch rules are spread over sections 1a, 3 and 8, and say 'switches start off', which isn't what happens. After C1 to C8 a new game also needs its column in the bulk save list and in the change log names.

What done looks like: docs/GAME_DEVELOPMENT_GUIDE.md has one short 'Teacher switch' rule list: the column and its default, hub_games.switch_column, the server check, the Unlimited turns list if it has a daily limit, and nothing else to add by hand. Live check as a teacher on Room Riley: Games tab count, a section off and on, a game set, the change line, and a pupil home page update. docs/plans/teacher-controls/HANDOVER.md all ticked; project memory updated.

Steps:
1. Edit section 1b/3/8 of docs/GAME_DEVELOPMENT_GUIDE.md in place, written for Claude (short rules, file beside each, no history).
2. Live check with James's teacher account in the browser (ask James on a question card if you can't sign in), screenshots into the project files folder teacher-controls/after-*.jpg.
3. Tick every card in HANDOVER.md with its PR number.

Files: docs/GAME_DEVELOPMENT_GUIDE.md; docs/plans/teacher-controls/HANDOVER.md; docs/TEACHER-CONTROLS-REVIEW.md ('After' section)

Tests and checks: None new.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
