# Skill map plan: handover

The review behind this plan is [docs/SKILL-MAP-REVIEW.md](../../SKILL-MAP-REVIEW.md) (11 Nov 2026). James's screenshot (`now-1-skill-map-laptop.png`) and the mock-ups (`mock-*.png`) are in the project files folder `skill-map/`.

**Plan page with copy-ready prompts and shared status:** https://claude.ai/artifact/8pmT7dEjGECiDBvAbDxqJU (collection `status`, one doc per card K1 to K8: `state` todo, started or done; `pr`; `updated`).
This file is the record of where things stand. Keep it current in each card's PR.

## The goal

A teacher opens Maths > Skill map on a laptop or iPad and, without scrolling, sees where the class is on the maths ladder, who is behind, stuck, nearly ready or gone quiet, and can set a focus for one pupil or a group in two taps.

## How to run it

- One card per session (or per cheap helper). Each card's prompt is below and on the plan page.
- Do the cards in order. K1 first; then K2 and K3 can run side by side; K4 after K2; then K5, K6 and K7 side by side.
- Only K5 changes the database. Before its migration merges, check the number is free on main (`node scripts/migration-numbers.mjs`).
- Merging to main deploys. Merging is pre-approved. Ask James before deleting anything.
- A card that changes what a new game must add also updates `docs/GAME_DEVELOPMENT_GUIDE.md` section 1b in its own PR.

## Cards, in order

| # | Card | Size | SQL | Waits for |
|---|---|---|---|---|
| K1 | [Tidy the grid so a screen shows a class](#k1) | S | no | nothing |
| K2 | [Show only the skills the class is using](#k2) | S | no | K1 |
| K3 | [Tap a cell: a side drawer, with focus buttons](#k3) | S | no | K1 |
| K4 | [Who needs a look: pills, filter and sort](#k4) | M | no | K2 |
| K5 | [How long on this skill, and who is stuck](#k5) | M | yes | K4 |
| K6 | [By skill view for iPad and phones](#k6) | M | no | K4 |
| K7 | [Fit with Progress, Foundational skills and Students](#k7) | S | no | K2 |
| K8 | [Guide matches, check live, close the review](#k8) | S | no | K1 to K7 |

## Done and live

_None yet._

## K1

### Tidy the grid so a screen shows a class (size S)

**What's wrong now.** With every stage open the map is 62 skill columns, each 78 to 120px wide with the full skill name wrapped over up to 4 lines and a 'Set focus' link under it. Each pupil row is about 90px tall (made-up name, email name, 'Set focus'). On a 1366x768 laptop that is about 8 skills and 4 pupils. Scrolling sideways loses the stage names and the 'On the ladder' column, and the header's Student cell isn't sticky, so skill names slide under the pupil names. The class counts sit in the footer, 31 rows down.

**Done looks like.** Looks like mock-1-grid-laptop.png. Rows are 30px: made-up name and email name on one line. Skill headers use a short name (20 characters at most; the full name is in the tooltip and the screen-reader text) with a small class bar (fluent, secure, learning) and '14 of 31' secure under it, so the footer goes. Both header rows and the first two columns (Pupil, Now on) stay put when the table scrolls either way, and each open stage's name stays visible in a coloured band. No 'Set focus' links in the headers or rows (they move to the drawer in K3). The pupil's Now cell is outlined; empty cells show a faint dot. About 13 skills and 14 pupils fit on a laptop.

**Waits for.** nothing

**Steps.**

1. shared/maths/ladder.ts: add an optional `short` (20 characters at most) to LadderSkill and fill it for every built skill whose label is longer, e.g. 'Facts to 10', 'Doubles and halves to 10', '10 and a number', 'Count in 5s', 'Number line to 100', 'Equals: missing number', 'Cutting arrays'. shared/maths/focus.ts: add skillTinyLabel(id) = short ?? skillShortLabel(id). Leave skillShortLabel as it is (Focus and Students use it).
2. src/pages/SkillMap.tsx MapHead: show skillTinyLabel with the full label in title and sr-only text. Replace the 'Set focus' link with a ClassBar (from classCounts in shared/maths/skillMap.ts) and 'N of M' secure. Do the same for a closed stage's header. Remove MapFoot.
3. MapRow: name and email name on one line (email name smaller, cut with an ellipsis), no 'Set focus' link. Rename 'On the ladder' to 'Now on': a chip with the Now skill's tiny label; Furthest and Warm-up go in the chip's title for now (the drawer shows them in K3).
4. src/pages/skill-map.css: sticky header (stage band at top 0, skill names under it), sticky left for both first columns in thead, tbody and corners (Pupil at left 0 and 180px wide, Now on at left 180px), with corners above both. The scroll box gets max-height: calc(100vh - 240px) so both scrollbars are on screen. Cells 30px high, skill columns 72px wide.
5. Keep every aria label and sr-only text with the full skill names. Don't change the data or the levels.

**Files.** shared/maths/ladder.ts; shared/maths/focus.ts; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx; a focus/ladder unit test

**Tests.** A unit test: every built skill's tiny label is 20 characters or fewer. SkillMap.test.tsx: no 'Set focus' links inside the table; a header shows the tiny label with the full label in its title; a pupil's name cell holds the email name; the counts are in the header. Screenshots at 1366x768 and 1024x768 with every stage open.

**Session prompt (ready to paste)**

```text
You are building card K1 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Tidy the grid so a screen shows a class.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k1. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: With every stage open the map is 62 skill columns, each 78 to 120px wide with the full skill name wrapped over up to 4 lines and a 'Set focus' link under it. Each pupil row is about 90px tall (made-up name, email name, 'Set focus'). On a 1366x768 laptop that is about 8 skills and 4 pupils. Scrolling sideways loses the stage names and the 'On the ladder' column, and the header's Student cell isn't sticky, so skill names slide under the pupil names. The class counts sit in the footer, 31 rows down.

What done looks like: Looks like mock-1-grid-laptop.png. Rows are 30px: made-up name and email name on one line. Skill headers use a short name (20 characters at most; the full name is in the tooltip and the screen-reader text) with a small class bar (fluent, secure, learning) and '14 of 31' secure under it, so the footer goes. Both header rows and the first two columns (Pupil, Now on) stay put when the table scrolls either way, and each open stage's name stays visible in a coloured band. No 'Set focus' links in the headers or rows (they move to the drawer in K3). The pupil's Now cell is outlined; empty cells show a faint dot. About 13 skills and 14 pupils fit on a laptop.

Steps:
1. shared/maths/ladder.ts: add an optional `short` (20 characters at most) to LadderSkill and fill it for every built skill whose label is longer, e.g. 'Facts to 10', 'Doubles and halves to 10', '10 and a number', 'Count in 5s', 'Number line to 100', 'Equals: missing number', 'Cutting arrays'. shared/maths/focus.ts: add skillTinyLabel(id) = short ?? skillShortLabel(id). Leave skillShortLabel as it is (Focus and Students use it).
2. src/pages/SkillMap.tsx MapHead: show skillTinyLabel with the full label in title and sr-only text. Replace the 'Set focus' link with a ClassBar (from classCounts in shared/maths/skillMap.ts) and 'N of M' secure. Do the same for a closed stage's header. Remove MapFoot.
3. MapRow: name and email name on one line (email name smaller, cut with an ellipsis), no 'Set focus' link. Rename 'On the ladder' to 'Now on': a chip with the Now skill's tiny label; Furthest and Warm-up go in the chip's title for now (the drawer shows them in K3).
4. src/pages/skill-map.css: sticky header (stage band at top 0, skill names under it), sticky left for both first columns in thead, tbody and corners (Pupil at left 0 and 180px wide, Now on at left 180px), with corners above both. The scroll box gets max-height: calc(100vh - 240px) so both scrollbars are on screen. Cells 30px high, skill columns 72px wide.
5. Keep every aria label and sr-only text with the full skill names. Don't change the data or the levels.

Files: shared/maths/ladder.ts; shared/maths/focus.ts; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx; a focus/ladder unit test

Tests and checks: A unit test: every built skill's tiny label is 20 characters or fewer. SkillMap.test.tsx: no 'Set focus' links inside the table; a header shows the tiny label with the full label in its title; a pupil's name cell holds the email name; the counts are in the header. Screenshots at 1366x768 and 1024x768 with every stage open.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K2

### Show only the skills the class is using (size S)

**What's wrong now.** The ladder has 62 skills, but a class uses a handful at a time, so in a class like Riley almost every cell says Not started. 20 of the 26 Early number facts skills are practised only by the Foundational games, and later stages are often untouched. 'Open every stage' opens all 62; closed stages show '0 of 26' for each pupil, which says little.

**Done looks like.** A 'Show' menu: Skills in use (the default), Every skill, or one stage. Skills in use means every skill at least one pupil in the class has been asked, plus the next skill on the ladder after the furthest pupil's Now skill. Stages with nothing in use become one thin hatched column, 'Rounding, Order of operations, Fractions: nobody yet'. Skills switched off for the whole class are hidden. A stage band can still fold. The choice is remembered on this computer. The 'Open/Close every stage' button goes.

**Waits for.** K1

**Steps.**

1. shared/maths/skillMap.ts: add skillsInUse(maps: StudentMap[]) returning skill ids in ladder order (a cell with asked > 0 counts, plus the next built skill after the furthest current), and hidden-off logic (every pupil 'off'). Unit tests.
2. src/pages/SkillMap.tsx: replace the `open` Set with `show` ('in-use' | 'all' | a stage id) plus a set of folded stages; build the header bands and columns from it.
3. The 'nobody yet' column: one hatched cell per row, header listing the stage names; tapping it switches Show to Every skill.
4. Remember Show in localStorage 'skill-map-show' (wrap reads and writes in try/catch).
5. When skillsInUse is empty, show 'Nobody in <class> has answered ladder maths yet.' in place of the grid (K7 adds the links).

**Files.** shared/maths/skillMap.ts and its test; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx

**Tests.** skillsInUse unit tests (nothing started; one pupil far ahead; a whole-class-off skill). SkillMap.test.tsx: by default only skills in use are columns; Every skill shows all 62; the choice survives a remount.

**Session prompt (ready to paste)**

```text
You are building card K2 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Show only the skills the class is using.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k2. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: The ladder has 62 skills, but a class uses a handful at a time, so in a class like Riley almost every cell says Not started. 20 of the 26 Early number facts skills are practised only by the Foundational games, and later stages are often untouched. 'Open every stage' opens all 62; closed stages show '0 of 26' for each pupil, which says little.

What done looks like: A 'Show' menu: Skills in use (the default), Every skill, or one stage. Skills in use means every skill at least one pupil in the class has been asked, plus the next skill on the ladder after the furthest pupil's Now skill. Stages with nothing in use become one thin hatched column, 'Rounding, Order of operations, Fractions: nobody yet'. Skills switched off for the whole class are hidden. A stage band can still fold. The choice is remembered on this computer. The 'Open/Close every stage' button goes.

Steps:
1. shared/maths/skillMap.ts: add skillsInUse(maps: StudentMap[]) returning skill ids in ladder order (a cell with asked > 0 counts, plus the next built skill after the furthest current), and hidden-off logic (every pupil 'off'). Unit tests.
2. src/pages/SkillMap.tsx: replace the `open` Set with `show` ('in-use' | 'all' | a stage id) plus a set of folded stages; build the header bands and columns from it.
3. The 'nobody yet' column: one hatched cell per row, header listing the stage names; tapping it switches Show to Every skill.
4. Remember Show in localStorage 'skill-map-show' (wrap reads and writes in try/catch).
5. When skillsInUse is empty, show 'Nobody in <class> has answered ladder maths yet.' in place of the grid (K7 adds the links).

Files: shared/maths/skillMap.ts and its test; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx

Tests and checks: skillsInUse unit tests (nothing started; one pupil far ahead; a whole-class-off skill). SkillMap.test.tsx: by default only skills in use are columns; Every skill shows all 62; the choice survives a remount.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K3

### Tap a cell: a side drawer, with focus buttons (size S)

**What's wrong now.** Tapping a cell opens its facts in a panel below the whole table, 31 rows down, so the page jumps and the teacher loses their place. To set a focus they hunt for the 'Set focus' link in a header or row, and there is no way to focus everyone on the same skill at once.

**Done looks like.** Looks like mock-2-detail-laptop.png. At 900px and wider a drawer opens on the right over the table; the table stays where it was, the row is tinted and the cell outlined. Under 900px it is a bottom sheet. It shows the level line, Now, Furthest and Warm-up, the facts table, a class line ('9 pupils are on this skill now; 14 of 31 are secure'), and three buttons: 'Set a focus for <name>', 'Focus for all 9 on this skill' (opens Focus with those pupils and the skill already picked), and 'Open pupil page'. Esc or the close button shuts it and puts focus back on the cell.

**Waits for.** K1

**Steps.**

1. src/pages/SkillMap.tsx: turn CellDetail into a drawer (role dialog, aria-modal false, labelled by its heading; focus the heading on open and the cell on close; Esc closes). Reuse the drawer look from the Games tab (src/teacher/Games.tsx and games.css) rather than a new style.
2. Add the class line using classCounts and the pupils whose map.current is this skill.
3. src/pages/SetFocus.tsx: accept ?students=id1,id2 (only ids in the class) as a preset that picks those pupils with the 'group' scope (FocusScope in src/data/focus.ts); keep ?student= working. Test it.
4. Buttons: Set a focus (?student=&skill=), Focus for all N (?students=&skill=), Open pupil page (/teacher/:classId/students/:id).

**Files.** src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SetFocus.tsx; src/pages/SkillMap.test.tsx; SetFocus test

**Tests.** SkillMap.test.tsx: tapping a cell opens a dialog with the pupil and skill, Esc closes it and focus returns to the cell; 'Focus for all' links with every pupil whose Now is that skill. SetFocus: ?students= picks those pupils.

**Session prompt (ready to paste)**

```text
You are building card K3 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Tap a cell: a side drawer, with focus buttons.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k3. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: Tapping a cell opens its facts in a panel below the whole table, 31 rows down, so the page jumps and the teacher loses their place. To set a focus they hunt for the 'Set focus' link in a header or row, and there is no way to focus everyone on the same skill at once.

What done looks like: Looks like mock-2-detail-laptop.png. At 900px and wider a drawer opens on the right over the table; the table stays where it was, the row is tinted and the cell outlined. Under 900px it is a bottom sheet. It shows the level line, Now, Furthest and Warm-up, the facts table, a class line ('9 pupils are on this skill now; 14 of 31 are secure'), and three buttons: 'Set a focus for <name>', 'Focus for all 9 on this skill' (opens Focus with those pupils and the skill already picked), and 'Open pupil page'. Esc or the close button shuts it and puts focus back on the cell.

Steps:
1. src/pages/SkillMap.tsx: turn CellDetail into a drawer (role dialog, aria-modal false, labelled by its heading; focus the heading on open and the cell on close; Esc closes). Reuse the drawer look from the Games tab (src/teacher/Games.tsx and games.css) rather than a new style.
2. Add the class line using classCounts and the pupils whose map.current is this skill.
3. src/pages/SetFocus.tsx: accept ?students=id1,id2 (only ids in the class) as a preset that picks those pupils with the 'group' scope (FocusScope in src/data/focus.ts); keep ?student= working. Test it.
4. Buttons: Set a focus (?student=&skill=), Focus for all N (?students=&skill=), Open pupil page (/teacher/:classId/students/:id).

Files: src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SetFocus.tsx; src/pages/SkillMap.test.tsx; SetFocus test

Tests and checks: SkillMap.test.tsx: tapping a cell opens a dialog with the pupil and skill, Esc closes it and focus returns to the cell; 'Focus for all' links with every pupil whose Now is that skill. SetFocus: ?students= picks those pupils.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K4

### Who needs a look: pills, filter and sort (size M)

**What's wrong now.** Nothing on the page says where most of the class is, who is behind, who is nearly ready to move on, or who has stopped practising. Pupils are listed by name, so a teacher reads every row.

**Done looks like.** Pills above the grid with the Progress tab's words and colours: 'Most are on: Facts to 20 · 9 pupils', 'N nearly ready to move up' (Now skill 50% or more secure), 'N finding it hard' (30 or more answers on the Now skill and under 40% secure), 'N behind the class' (Now skill 3 or more skills before the class's middle), 'N gone quiet' (no ladder answer for 7 days, from lastSeen). Tapping a pill filters the rows and says 'Showing 4 of 31 · Show all'; ?show= in the address keeps it, so a link works. A Sort menu: Ladder place (the default, behind first), Name, Furthest first. The Now chip is green with ↑ when nearly ready and red when finding it hard.

**Waits for.** K2

**Steps.**

1. shared/maths/skillMap.ts: pupilFlags(map, facts, now) returning { nearly, hard, quiet } and classMiddle(maps) (the median Now index on the ladder); thresholds as named constants at the top. Unit tests.
2. src/pages/SkillMap.tsx: the pills (buttons with aria-pressed), filter, 'Showing N of M · Show all', sort menu (localStorage 'skill-map-sort', try/catch), ?show= kept with useSearchParams.
3. The 'Most are on' pill highlights that skill's column (and scrolls it into view).
4. Reuse the pill look from src/teacher/progress (don't copy the CSS: import or share the class).

**Files.** shared/maths/skillMap.ts and test; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx

**Tests.** pupilFlags and classMiddle unit tests at the edges of each threshold. SkillMap.test.tsx: a pill filters the rows and the address keeps ?show=; sort by ladder place puts the furthest-behind first.

**Session prompt (ready to paste)**

```text
You are building card K4 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Who needs a look: pills, filter and sort.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k4. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: Nothing on the page says where most of the class is, who is behind, who is nearly ready to move on, or who has stopped practising. Pupils are listed by name, so a teacher reads every row.

What done looks like: Pills above the grid with the Progress tab's words and colours: 'Most are on: Facts to 20 · 9 pupils', 'N nearly ready to move up' (Now skill 50% or more secure), 'N finding it hard' (30 or more answers on the Now skill and under 40% secure), 'N behind the class' (Now skill 3 or more skills before the class's middle), 'N gone quiet' (no ladder answer for 7 days, from lastSeen). Tapping a pill filters the rows and says 'Showing 4 of 31 · Show all'; ?show= in the address keeps it, so a link works. A Sort menu: Ladder place (the default, behind first), Name, Furthest first. The Now chip is green with ↑ when nearly ready and red when finding it hard.

Steps:
1. shared/maths/skillMap.ts: pupilFlags(map, facts, now) returning { nearly, hard, quiet } and classMiddle(maps) (the median Now index on the ladder); thresholds as named constants at the top. Unit tests.
2. src/pages/SkillMap.tsx: the pills (buttons with aria-pressed), filter, 'Showing N of M · Show all', sort menu (localStorage 'skill-map-sort', try/catch), ?show= kept with useSearchParams.
3. The 'Most are on' pill highlights that skill's column (and scrolls it into view).
4. Reuse the pill look from src/teacher/progress (don't copy the CSS: import or share the class).

Files: shared/maths/skillMap.ts and test; src/pages/SkillMap.tsx; src/pages/skill-map.css; src/pages/SkillMap.test.tsx

Tests and checks: pupilFlags and classMiddle unit tests at the edges of each threshold. SkillMap.test.tsx: a pill filters the rows and the address keeps ?show=; sort by ladder place puts the furthest-behind first.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K5

### How long on this skill, and who is stuck (size M, database change)

**What's wrong now.** The map can't tell if a pupil reached their skill yesterday or a month ago: gem_keep_facts keeps only last_seen, not when a fact was first answered. So it can't show who is stuck, and the drawer can't say how long they've been on it.

**Done looks like.** gem_keep_facts gets first_seen (new rows get now(); old rows stay empty, never guessed). teacher_class_skill_map sends it. The drawer says 'On it since 3 Nov (9 days)', or 'since before 12 Nov' when the facts are older than the column. The Now chip shows '16d' when the pupil has been on a Learning skill 14 days or more, and a 'N stuck 2+ weeks' pill joins K4's pills.

**Waits for.** K4

**Steps.**

1. Migration <next>_fact_first_seen.sql: alter table public.gem_keep_facts add column first_seen timestamptz; then alter column first_seen set default now(). No backfill. Find every place that writes gem_keep_facts (grep supabase/functions and supabase/migrations) and check an upsert's ON CONFLICT update never sets first_seen.
2. Same migration: create or replace public.teacher_class_skill_map with its newest body (20261111000600_fact_wrong_answers.sql; check nothing newer defines it), adding 'firstSeen' (epoch ms or null) to each fact; repeat its revoke/grant lines.
3. src/data/skillMap.ts parseFact: firstSeen (optional). shared/maths/leitner.ts FactStats: optional firstSeen; check other users still compile.
4. shared/maths/skillMap.ts: nowSince(map, facts) = the earliest firstSeen among the Now skill's asked keys, or null; stuck = Learning and 14+ days. Show it in the drawer, the Now chip and a pill.

**Files.** new migration; src/data/skillMap.ts; shared/maths/leitner.ts; shared/maths/skillMap.ts and test; src/pages/SkillMap.tsx; supabase/tests/database/

**Tests.** pgTAP: a new gem_keep_facts row gets first_seen; an update keeps it; teacher_class_skill_map returns firstSeen. nowSince unit tests, including null for old facts.

**Session prompt (ready to paste)**

```text
You are building card K5 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): How long on this skill, and who is stuck.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k5. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Change a shared function in place: copy its latest body exactly from the newest migration that defines it, add only your lines, and repeat its revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What's wrong now: The map can't tell if a pupil reached their skill yesterday or a month ago: gem_keep_facts keeps only last_seen, not when a fact was first answered. So it can't show who is stuck, and the drawer can't say how long they've been on it.

What done looks like: gem_keep_facts gets first_seen (new rows get now(); old rows stay empty, never guessed). teacher_class_skill_map sends it. The drawer says 'On it since 3 Nov (9 days)', or 'since before 12 Nov' when the facts are older than the column. The Now chip shows '16d' when the pupil has been on a Learning skill 14 days or more, and a 'N stuck 2+ weeks' pill joins K4's pills.

Steps:
1. Migration <next>_fact_first_seen.sql: alter table public.gem_keep_facts add column first_seen timestamptz; then alter column first_seen set default now(). No backfill. Find every place that writes gem_keep_facts (grep supabase/functions and supabase/migrations) and check an upsert's ON CONFLICT update never sets first_seen.
2. Same migration: create or replace public.teacher_class_skill_map with its newest body (20261111000600_fact_wrong_answers.sql; check nothing newer defines it), adding 'firstSeen' (epoch ms or null) to each fact; repeat its revoke/grant lines.
3. src/data/skillMap.ts parseFact: firstSeen (optional). shared/maths/leitner.ts FactStats: optional firstSeen; check other users still compile.
4. shared/maths/skillMap.ts: nowSince(map, facts) = the earliest firstSeen among the Now skill's asked keys, or null; stuck = Learning and 14+ days. Show it in the drawer, the Now chip and a pill.

Files: new migration; src/data/skillMap.ts; shared/maths/leitner.ts; shared/maths/skillMap.ts and test; src/pages/SkillMap.tsx; supabase/tests/database/

Tests and checks: pgTAP: a new gem_keep_facts row gets first_seen; an update keeps it; teacher_class_skill_map returns firstSeen. nowSince unit tests, including null for old facts.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K6

### By skill view for iPad and phones (size M)

**What's wrong now.** Under 900px the grid needs sideways scrolling and only a few skills fit; on an iPad in portrait it is close to unusable.

**Done looks like.** Looks like mock-4-by-skill-ipad-portrait.png. A 'Grid | By skill' switch; By skill is the default under 900px and the choice is remembered. One card per skill in use, ordered by how many pupils are on it now: name, stage, a class bar, 'N of 31 secure', then name chips in rows: Now here (with K5's days once built), Slipped back (Learning on a skill below their Now), Secure (folded behind 'show'). Tapping a chip opens K3's sheet. K4's pills and sort still filter. iPad landscape keeps the grid (mock-3-grid-ipad-landscape.png).

**Waits for.** K4

**Steps.**

1. src/pages/SkillMapBySkill.tsx (new): the cards, built from the same maps and skillsInUse; no new data.
2. src/pages/SkillMap.tsx: the switch (localStorage 'skill-map-view', default from matchMedia('(max-width: 899px)')), and pass the pill filter in.
3. Chips are buttons with the pupil's name and level in their label; tapping opens the K3 sheet for that pupil and skill.
4. CSS in skill-map.css; no sideways scroll at 768px or 390px.

**Files.** src/pages/SkillMapBySkill.tsx; src/pages/SkillMap.tsx; src/pages/skill-map.css; tests

**Tests.** A test: at a narrow width By skill is chosen; a card lists the pupils whose Now is that skill; a chip opens the sheet. Screenshots at 768x1024 and 390x844.

**Session prompt (ready to paste)**

```text
You are building card K6 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): By skill view for iPad and phones.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k6. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: Under 900px the grid needs sideways scrolling and only a few skills fit; on an iPad in portrait it is close to unusable.

What done looks like: Looks like mock-4-by-skill-ipad-portrait.png. A 'Grid | By skill' switch; By skill is the default under 900px and the choice is remembered. One card per skill in use, ordered by how many pupils are on it now: name, stage, a class bar, 'N of 31 secure', then name chips in rows: Now here (with K5's days once built), Slipped back (Learning on a skill below their Now), Secure (folded behind 'show'). Tapping a chip opens K3's sheet. K4's pills and sort still filter. iPad landscape keeps the grid (mock-3-grid-ipad-landscape.png).

Steps:
1. src/pages/SkillMapBySkill.tsx (new): the cards, built from the same maps and skillsInUse; no new data.
2. src/pages/SkillMap.tsx: the switch (localStorage 'skill-map-view', default from matchMedia('(max-width: 899px)')), and pass the pill filter in.
3. Chips are buttons with the pupil's name and level in their label; tapping opens the K3 sheet for that pupil and skill.
4. CSS in skill-map.css; no sideways scroll at 768px or 390px.

Files: src/pages/SkillMapBySkill.tsx; src/pages/SkillMap.tsx; src/pages/skill-map.css; tests

Tests and checks: A test: at a narrow width By skill is chosen; a card lists the pupils whose Now is that skill; a chip opens the sheet. Screenshots at 768x1024 and 390x844.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K7

### Fit with Progress, Foundational skills and Students (size S)

**What's wrong now.** Three pages show early maths three ways: Progress (each Foundational game's step), Foundational skills (13 ideas, from fact mastery) and the Skill map (the maths ladder, which also holds 20 skills only the Foundational games practise). The Skill map doesn't say which games follow the ladder, and a junior class with no ladder answers sees an empty grid with no pointer elsewhere.

**Done looks like.** One intro line says what the map is: where each pupil is on the maths ladder that Maths focus and the auto games use (name the games, from the code). Early number facts skills that only Foundational games practise follow James's choice (see Decisions). The empty state says 'Nobody in <class> has answered ladder maths yet. For the Foundational games, see Progress.' with links to Progress and Foundational skills. The Students tab's furthest-skill text links to the Skill map with that pupil's row highlighted (?pupil=). The Progress tab has a small 'Maths ladder: see the Skill map' link.

**Waits for.** K2

**Steps.**

1. Find which games follow the ladder (grep for ladder / auto focus use in src/games and supabase/functions) and write the intro line with their names.
2. Apply James's decision on Foundational-only skills (inAuto false and stage early-facts): by default they show only when a pupil in the class has started them, which K2 already does; if James chose otherwise, add the rule in skillsInUse.
3. Empty state links; ?pupil= highlights and scrolls to the row (and opens nothing).
4. src/teacher/Students.tsx and src/teacher/progress/Progress.tsx: the two links.

**Files.** src/pages/SkillMap.tsx; shared/maths/skillMap.ts; src/teacher/Students.tsx; src/teacher/progress/Progress.tsx; tests

**Tests.** SkillMap.test.tsx: the empty state links to Progress; ?pupil= highlights the row. Students.test.tsx: the link.

**Session prompt (ready to paste)**

```text
You are building card K7 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Fit with Progress, Foundational skills and Students.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k7. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: Three pages show early maths three ways: Progress (each Foundational game's step), Foundational skills (13 ideas, from fact mastery) and the Skill map (the maths ladder, which also holds 20 skills only the Foundational games practise). The Skill map doesn't say which games follow the ladder, and a junior class with no ladder answers sees an empty grid with no pointer elsewhere.

What done looks like: One intro line says what the map is: where each pupil is on the maths ladder that Maths focus and the auto games use (name the games, from the code). Early number facts skills that only Foundational games practise follow James's choice (see Decisions). The empty state says 'Nobody in <class> has answered ladder maths yet. For the Foundational games, see Progress.' with links to Progress and Foundational skills. The Students tab's furthest-skill text links to the Skill map with that pupil's row highlighted (?pupil=). The Progress tab has a small 'Maths ladder: see the Skill map' link.

Steps:
1. Find which games follow the ladder (grep for ladder / auto focus use in src/games and supabase/functions) and write the intro line with their names.
2. Apply James's decision on Foundational-only skills (inAuto false and stage early-facts): by default they show only when a pupil in the class has started them, which K2 already does; if James chose otherwise, add the rule in skillsInUse.
3. Empty state links; ?pupil= highlights and scrolls to the row (and opens nothing).
4. src/teacher/Students.tsx and src/teacher/progress/Progress.tsx: the two links.

Files: src/pages/SkillMap.tsx; shared/maths/skillMap.ts; src/teacher/Students.tsx; src/teacher/progress/Progress.tsx; tests

Tests and checks: SkillMap.test.tsx: the empty state links to Progress; ?pupil= highlights the row. Students.test.tsx: the link.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```

## K8

### Guide matches, check live, close the review (size S)

**What's wrong now.** The plan only counts once it's live and the guide says how a new game shows on the Skill map.

**Done looks like.** docs/GAME_DEVELOPMENT_GUIDE.md section 1b says: a ladder game that writes gem_keep_facts keys shows on the Skill map by itself, and a new ladder skill needs a short label of 20 characters or fewer (the unit test checks it). Live screenshots at 1366x768, 1024x768 and 768x1024 sit beside the mock-ups in the project files folder skill-map/ (live-*.png). docs/SKILL-MAP-REVIEW.md and HANDOVER.md say it's done, and the project memory note skill-map-plan is updated.

**Waits for.** K1 to K7

**Steps.**

1. Update section 1b of docs/GAME_DEVELOPMENT_GUIDE.md in plain words for Claude.
2. Take live screenshots of the Skill map on a real class (read only) at the three sizes and save them as live-*.png in skill-map/.
3. Mark the review and handover done; list any follow-ups in HANDOVER.md.

**Files.** docs/GAME_DEVELOPMENT_GUIDE.md; docs/SKILL-MAP-REVIEW.md; docs/plans/skill-map/HANDOVER.md

**Tests.** npm test once; nothing new.

**Session prompt (ready to paste)**

```text
You are building card K8 of the Skill map plan for the Games Hub (the teacher's Maths > Skill map page): Guide matches, check live, close the review.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/SKILL-MAP-REVIEW.md and your card in docs/plans/skill-map/HANDOVER.md first. Create your own branch from origin/main named skill-map-k8. Reply to James in short, plain words; ask any decision on a question card. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. For screenshots, run the real Skill map on made-up data: copy the home preview's trick (vite.home-preview.config.ts swaps src/lib/supabase for preview/home/fakeSupabase.ts) into a scratch teacher preview with a signed-in teacher and a class of about 30 made-up pupils spread over 8 to 12 ladder skills (fake teacher_classes, teacher_class_detail and teacher_class_skill_map), and never talk to the live server; check 1366x768, 1024x768 and 768x1024 against the mock-ups in the project files folder skill-map/ and attach screenshots to the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/skill-map/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, set this card to Live on the Skill Map Plan page, and add the next card's prompt to the Games Hub Prompts board.

What's wrong now: The plan only counts once it's live and the guide says how a new game shows on the Skill map.

What done looks like: docs/GAME_DEVELOPMENT_GUIDE.md section 1b says: a ladder game that writes gem_keep_facts keys shows on the Skill map by itself, and a new ladder skill needs a short label of 20 characters or fewer (the unit test checks it). Live screenshots at 1366x768, 1024x768 and 768x1024 sit beside the mock-ups in the project files folder skill-map/ (live-*.png). docs/SKILL-MAP-REVIEW.md and HANDOVER.md say it's done, and the project memory note skill-map-plan is updated.

Steps:
1. Update section 1b of docs/GAME_DEVELOPMENT_GUIDE.md in plain words for Claude.
2. Take live screenshots of the Skill map on a real class (read only) at the three sizes and save them as live-*.png in skill-map/.
3. Mark the review and handover done; list any follow-ups in HANDOVER.md.

Files: docs/GAME_DEVELOPMENT_GUIDE.md; docs/SKILL-MAP-REVIEW.md; docs/plans/skill-map/HANDOVER.md

Tests and checks: npm test once; nothing new.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
