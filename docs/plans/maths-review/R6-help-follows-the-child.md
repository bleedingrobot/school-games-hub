# R6. Help that follows the child (Beanstalk, Hop, Penguin Pairs, Pipi)

> **Update 7 Nov 2026:** follow [LEARNING-DESIGN.md](../../LEARNING-DESIGN.md) and check [GAME-KIT-PLAN.md](../GAME-KIT-PLAN.md) first. If kit stage K1 (`help`, `replay`, `dayArc`) is merged, use it instead of copying another game's code; if not, write this so it can move into the kit later.

Status: plan only, nothing built. Written 7 Nov 2026. Games: Kiwi's Beanstalk, Hop's Glow-worm Pond, Penguin Pairs (folder `korora`), Pipi's Hidden Shells. Tūī already has its own per-child help level (with one bug, R1) and Weka and Quick looks already fade per child; they are the models.

## 1. The problem

Pattern 2 in DECISIONS.md. In four games the help is decided by the calendar: bronze days 1 to 10 show the full picture, silver days 11 to 20 a faint one, gold days 21 to 30 none. A child who struggles loses the help on day 21 anyway; a child who knows it all still gets 10 days of full help. Help never comes back after a struggle.

Evidence:
- **Beanstalk:** dots are `full`, `small`, `none` from `stalkAfter(daysDone)` (`shared/beanstalk/progress.ts:43-50`). "Nothing reads mistakes, speed or which pairs are weak" (beanstalk.md, "How it works").
- **Hop:** the "+10" arc labels are bold, faint, gone by finished days 0-9, 10-19, 20-29 of a pond (`shared/hop/progress.ts:50-65`, `Hops.tsx:121-125`). When the step moves up (10s to 5s to 2s) the labels do not come back: on 2s the evaluator saw `8 ? 12 14` with no step label at all.
- **Penguin Pairs:** the picture is `full`, `faint`, `none` from days played (`shared/korora/progress.ts:52-67`). "A child at level 1 on day 21 gets no pictures; a child who jumps to level 3 on day 1 gets full." The only return of help is inside one round (3 goes in a row with a wrong first tap, `Goes.tsx:35, 155-160`) and it is not saved.
- **Pipi:** `help: ['full','faint','none'][round]` from days (`shared/pipi/progress.ts:60`). A child moved up a level on a gold day gets no frame.

## 2. The research behind it

- `research-maths.md`, cross-cutting principle 2: "Support should step back when the child is right and return when they are wrong (this is review criterion 4)." Principle 6 (CPA): objects, then pictures, then numbers only, and fade.
- Same file, part-whole and bonds: "Fade the diagram/ten-frame once the child is reliably right."
- research-design.md rubric criterion 4 (Fading): a 4 needs fading that follows the child in both directions.

## 3. The change

### 3.1 How Weka does it (the model to copy)

Weka keeps the help **per fact**, worked out from the pupil's saved records each time a round starts. No extra help column.
- The rule is `helpForStats` (`shared/weka/round.ts:101-108`): `full` until the fact is secure (box 2 or more) **and** has been answered right and quickly on two different days (`quickDays.length >= 2`); then `split` until box 4 and 8 right (`SPLIT_UNTIL_RIGHT = 8`); then `faint` until 12 right (`FAINT_UNTIL_RIGHT = 12`); then `none`.
- One wrong answer drops the fact to box 1 (`shared/maths/leitner.ts:55-58`), so the help for that fact returns to `full` at the next round. A right answer slower than 5 seconds changes nothing.
- `makeRound` writes each go's help into the saved round (`GoPlan.h`), so the server replay and the browser agree. The server already loads the pupil's facts at `load` and `start` (`shared/weka/server.ts:119-133`).
- Inside a round: after 3 goes in a row with a wrong first tap (`STRUGGLE_GOES = 3`, `src/games/weka/Goes.tsx:47`) full help comes back for the rest of the round; on a go, the second wrong tap raises the help one step (`MORE[start]`, `Goes.tsx:118-126`).
- Teacher override: `HelpSetting` `fade` (follow the child), `always` or `off` (`shared/weka/server.ts:44-53`).
- Calendar days stay, but only for the look and the kinds of go (silver turn-arounds, gold hop-backs), not for the help.

### 3.2 How Quick looks does it

Quick looks has no separate help level; it fades the **time** and watches for struggle, per stage (`shared/subitising/engine.ts`, `config.ts`, `saved.ts`):
- The flash gets shorter only when the last 8 counted answers of the stage are at least 85% right (`flashMs`, `engine.ts:100-105`; `masteryAccuracy` and `window` in `config.ts`); it goes back to the longer start time when accuracy falls under that.
- It steps back when the last 5 answers of the stage are under 60% right (`progressFrom`, `engine.ts:88-90`): smaller numbers and the first picture type of the stage.
- Struggle in the moment (two wrong in a row, or thinking over 4 seconds, `isStruggling`, `engine.ts:94-99`): the next picture stays on screen with "Can you see smaller groups?". That answer is saved under a helped key (`subh:` / `gaph:`, `shared/subitising/keys.ts`) so help never counts toward finishing a stage.
- What follows the child is saved with the Training student row (`typing.q`: placed, start stage, finished stages, "keep the picture") so a stage finished long ago stays finished (`saved.ts:19-45`).

### 3.3 The rule for the four games

The same three ideas in each game, with numbers that match Weka and Tūī (`GOOD = 8`, `HARD = 4`, `GOOD_TO_FADE = 2` in `shared/tui/round.ts:23-29`):

1. **Where the level comes from.** A level is held **per child** on the server and given to the browser by `load`/`start`, saved in the round so replay matches.
2. **Fades after good rounds.** One step less help after the child is secure on it (per fact for Hop, Pipi and Penguin Pairs: right and quick on two different days; per child for Beanstalk: 2 good rounds in a row, a good round being 8 or more of 10 pairs with no wrong tap).
3. **Returns after struggle.** Per fact: any wrong first tap puts the fact back to full help (that is automatic in the box rule). Per child (Beanstalk): a hard round (4 or fewer of 10 first time) puts the help up one step. In every game: after 3 goes in a row with a wrong first tap, full help for the rest of the round (copy `STRUGGLE_GOES = 3`, saved only for the round).
4. **A new thing starts with full help.** New step, new level or new sum restarts at full for the facts of that step (Hop: the facts of the new step have no record, so they are full by themselves; Beanstalk: reset to full at a new sum, see R4's bridging step).
5. **The teacher's setting stays** as the override (`fade`/`always`/`off` or the existing dots and labels switches).
6. **The calendar stays for rewards and the look only** (leaf, pad, shell and pebble colours, and the day-colour kinds of go).

Do R2 first (the fair "quick" time for careful children, the clock starting after the voice). The help rule depends on quick answers, and with the 5-second clock starting while the voice is still reading, a careful 5-year-old might never fade.

### 3.4 Per game

**Beanstalk (per child, Tūī style, because 100 and 1000 have one fact each).** The help level is `full`, `small`, `none` (the existing `Dots`). A hard fact record cannot work for 100 and 1000: all 100-pairs share the key `bond100:tens` and all 1000-pairs `bond1000:hundreds` (`shared/beanstalk/round.ts:67-71`), so the per-fact rule would not see which pair is weak.
- Add to `beanstalk_progress`: `help smallint not null default 0 check (help between 0 and 2)` (0 full, 1 small, 2 none) and `good_in_row smallint not null default 0`. Backfill existing pupils from the calendar so nobody's picture jumps: `help = least(2, (days_done % 30) / 10)`.
- `finishChallenge` stays for the leaf; a new `placeAfter(place, rightFirstTime)` (copy `placeAfter` in `shared/tui/round.ts:87-103`, without steps) moves the help: good round (8 or more first-time pairs) adds 1 to `good_in_row`; two in a row: help + 1 (less picture), `good_in_row` back to 0; hard round (4 or fewer): help - 1 (more picture). It only moves on the day's first finish (as Tūī, `server.ts:155`), so replays do not move it. "First time right" for a pair comes from the replay of the taps (`shared/beanstalk/round.ts:92-100`).
- `load` returns `help` (instead of `dots`: keep the teacher's switch `dots` as the override; `settings.dots === false` forces `none`). A new sum (`targetFor` changes at each egg) resets `help` to 0 in the same finish that wins the egg.
- Inside a round: 3 pairs in a row with a wrong first tap show full dots for the rest of the round.
- The function that finishes a round is `beanstalk_finish` (`supabase/migrations/20261104000700_beanstalk.sql:118`); replace it in a new migration (own function, not shared).

**Hop (per fact, Weka style).** Labels `full`, `faint`, `none` (the existing `Help`, `shared/hop/progress.ts:27`). Use the Weka rule with Hop's three states: `full` until the fact is box 2 or more and quick on two days; `faint` until box 4 and 6 right; then `none`. Each hop's help is worked out from the facts of that step (`skip10:up:40` etc.) and saved in the hop plan (`hops[].h`) in `makeRound` (`shared/hop/round.ts:105`). Because each new step's facts have no record, the labels are full again automatically on a step-up (the bug the evaluator saw). Counting back is the same rule on the `back` facts. Teacher's "labels off" switch stays as the override (`src/pages/TeacherHop.tsx:12-24`).

**Penguin Pairs (per fact, Weka style).** `full` (rock and mirror picture, and on halves the child does the sharing, see R9's note), `faint`, `none`. Same rule as Hop on the `dbl:` and `half:` and `oddeven:` facts. Save `h` per go in `GoPlan` (`shared/korora/round.ts`, `makeRound` at `round.ts:166-191`). Teacher's `HelpSetting` (`shared/korora/server.ts:42-52`) stays. The in-round boost (`Goes.tsx:35`) stays and now also starts the next go at `full`.

**Pipi (per fact, Weka style).** `full` (frame and outlines), `faint`, `none`, from the `part<whole>:<shown>` facts and the "altogether" and "two tides" goes' facts. Same rule and `h` per go in `shared/pipi/round.ts` (`makeRound` at `:127-157`). Teacher's `help: boolean` switch stays (`shared/pipi/server.ts:47-48`). Edge splits (none or all hiding) stay at most once a round.

For Hop, Pipi and Penguin Pairs the server already loads the child's facts at `load` and `start`, so no migration and no new column. Rounds already open when this goes live have no `h`: for a go with no saved `h`, fall back to the calendar help for that round only, so nothing breaks mid-round.

Child-facing words: the game does not talk about "help levels". The only new thing a child notices is the picture coming back after a miss. One short line the first time it returns in a round, in each game: "Here is the picture again to help." Voice clip names `help-back` in each game's `voiceLines.ts`.

## 4. Files affected

All in each game's own folders:
- Beanstalk: `shared/beanstalk/progress.ts`, `round.ts`, `server.ts`, `memoryServices.ts`, `src/games/beanstalk/BeanstalkGame.tsx`, `Round.tsx`, `Leaf.tsx`, `backend.ts`, `words.ts`, `voiceLines.ts`, `supabase/functions/beanstalk/` (rebuilt), a new migration.
- Hop: `shared/hop/round.ts`, `progress.ts`, `server.ts`, `src/games/hop/Hops.tsx`, `HopGame.tsx`, `words.ts`, `voiceLines.ts`, `supabase/functions/hop/` (rebuilt).
- Penguin Pairs: `shared/korora/round.ts`, `progress.ts`, `server.ts`, `src/games/korora/Goes.tsx`, `words.ts`, `voiceLines.ts`, `supabase/functions/korora/` (rebuilt).
- Pipi: `shared/pipi/round.ts`, `progress.ts`, `server.ts`, `src/games/pipi/Goes.tsx`, `PipiGame.tsx`, `words.ts`, `voiceLines.ts`, `supabase/functions/pipi/` (rebuilt).
- The same plan docs (`docs/<GAME>-PLAN.md`) get a short results section.

No shared file. Do not copy `helpForStats` into `shared/maths` (off limits): each game has its own small copy of the rule with its own thresholds. R5 and R6 touch the same `Goes.tsx` per game, so build them one after the other.

## 5. Database / migration needs

- Beanstalk only: one new migration file (number from `node scripts/migration-numbers.mjs` after `git fetch`): `alter table public.beanstalk_progress add column help smallint not null default 0 check (help between 0 and 2), add column good_in_row smallint not null default 0 check (good_in_row between 0 and 1);`, the backfill update, and a replaced `beanstalk_finish` (and `beanstalk_load` to return the two columns) with the usual revokes and grants (copy the "lock new functions" block at the end of the existing Beanstalk migration). Not destructive, so no `live-ok` line. Applied automatically when the PR merges (guide section 8, step 1); a database test goes in `supabase/tests/database/beanstalk.test.sql`.
- Hop, Pipi, Penguin Pairs: none.

## 6. Test steps

Automated (at most 8 per game; 4 to 6 suggested):
1. The rule: a fact with no record is `full`; box 2 and quick on two days is `faint`; box 4 and enough right is `none`; a wrong answer takes it back to `full` (pure function test).
2. `makeRound` puts `h` in every go, and `showRound`/replay accept it; a saved round with no `h` falls back to the calendar help.
3. Step-up (Hop): the first hops of a new step are `full` although the old step was `none`.
4. Teacher override: `always` and `off` win over the child's level.
5. Beanstalk: `placeAfter` fades after 2 good rounds, returns after a hard round, resets at a new sum, and does not move on a replay.
6. Database test (Beanstalk): the new columns, backfill, and `beanstalk_finish` saving them.

By playing the preview: play perfect rounds and watch the help go (it should take about 2 good days on a new fact); make mistakes on one fact on purpose and see its help return next round; check a step-up in Hop; check Beanstalk at a new sum; check the teacher's switches still win.

## 7. Effort and impact

M, **High**: moves Fading from 2 to 3 (4 for Beanstalk and Hop if they also bring help back inside a go, which they do), and ends the "help vanishes on day 21 for everyone" problem.

## 8. Session prompts (ready to paste, one per game, each its own branch)

Do R2 first. Prompt 1 is the one in the JSON file.

### Prompt 1: Beanstalk

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r6-beanstalk-help. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R6-help-follows-the-child.md (sections 3.1 to 3.4, the Beanstalk part, are yours), docs/reviews/maths-review/games/beanstalk.md and, as models, shared/tui/round.ts (placeAfter) and shared/weka/round.ts (helpForStats).

Make Kiwi's Beanstalk's dots follow the child, not the calendar:
1. Add columns help (0 full, 1 small, 2 none) and good_in_row to beanstalk_progress in a NEW migration (get the number from node scripts/migration-numbers.mjs; backfill help from days_done; replace beanstalk_finish and beanstalk_load; lock the functions as the existing migration does). Add a database test.
2. In shared/beanstalk: a placeAfter for the help (good round = 8 or more of 10 pairs right first time, 2 good in a row fades one step, 4 or fewer first-time pairs brings one step back, moves only on the day's first finish, reset to full when a new sum starts). The server returns help from load and saves it with the round; the teacher's dots switch off still forces none. Leaf colours and eggs stay on days.
3. In src/games/beanstalk: use the saved help for the dots; after 3 pairs in a row with a wrong first tap show full dots for the rest of the round, with the line "Here are the dots again to help." (add to words.ts and voiceLines.ts).
4. At most 8 tests (placeAfter, reset at new sum, replay does not move it, database test). Rebuild with npm run build:functions -- beanstalk. Typecheck, npm run test:changed, play the preview.
Do not touch shared/maths or any shared file. Stop and tell James before any live step (the migration applies when the PR merges). Open a PR when done.
```

### Prompt 2: Hop

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r6-hop-help. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R6-help-follows-the-child.md (sections 3.1 to 3.4, the Hop part, are yours), docs/reviews/maths-review/games/hop.md and, as the model, helpForStats in shared/weka/round.ts.

Make Hop's step labels follow the child, per fact:
1. In shared/hop/round.ts add a rule like helpForStats for full, faint, none (full until box 2 or more and quick on two different days; faint until box 4 and 6 right; then none), worked out per hop from the child's records in makeRound and saved on each hop as h. A hop with no saved h falls back to the calendar help.
2. Labels come back by themselves on a new step (new facts have no records); counting-back hops use the same rule. After 3 hops in a row with a wrong first tap, full labels for the rest of the round with the line "Here are the hops again to help." (words.ts, voiceLines.ts). The teacher's labels-off switch still wins.
3. Calendar days stay only for pad colours and gold-day back hops.
4. At most 8 tests; no migration; rebuild with npm run build:functions -- hop; typecheck; npm run test:changed; play the preview, including a step-up.
Stay inside Hop's own folders. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 3: Penguin Pairs (korora)

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r6-korora-help. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R6-help-follows-the-child.md (sections 3.1 to 3.4, the Penguin Pairs part, are yours), docs/reviews/maths-review/games/korora.md and helpForStats in shared/weka/round.ts as the model.

Make Penguin Pairs' pictures follow the child, per fact:
1. In shared/korora/round.ts add the per-fact help rule (full, faint, none as in the plan), worked out in makeRound from the child's records and saved on each go as h in GoPlan; a go with no h falls back to the calendar pool.
2. In src/games/korora/Goes.tsx use the go's h; the existing in-round boost (3 goes in a row with a wrong first tap) stays and the line "Here is the picture again to help." is added (words.ts, voiceLines.ts). The teacher's help setting (fade, always, off) still wins. Calendar days stay only for stones and the day-colour kinds of go.
3. At most 8 tests; no migration; rebuild with npm run build:functions -- korora; typecheck; npm run test:changed; play the preview at levels 1 and 3.
Stay inside Penguin Pairs' own folders. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 4: Pipi

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r6-pipi-help. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R6-help-follows-the-child.md (sections 3.1 to 3.4, the Pipi part, are yours), docs/reviews/maths-review/games/pipi.md and helpForStats in shared/weka/round.ts as the model.

Make Pipi's frame and outlines follow the child, per fact:
1. In shared/pipi/round.ts add the per-fact help rule (full, faint, none as in the plan), worked out in makeRound from the child's records and saved on each go as h; a go with no h falls back to the calendar help.
2. In src/games/pipi/Goes.tsx use the go's h; after 3 goes in a row with a wrong first tap show full help for the rest of the round with the line "Here are the outlines again to help." (words.ts, voiceLines.ts). The teacher's help switch still wins. Calendar days stay only for shells and the day-colour kinds of go.
3. At most 8 tests; no migration; rebuild with npm run build:functions -- pipi; typecheck; npm run test:changed; play the preview on a new level.
Stay inside Pipi's own folders. Stop and tell James before any live step. Open a PR when done.
```

## 9. Results: Kiwi's Beanstalk (built 7 Nov 2026, branch `r6-beanstalk-help`)

What a child sees: the dots on the leaves now belong to the child, not the calendar. Everyone starts with full dots. After two good days in a row (8 or more of the 10 pairs right at the first tap) the dots go small, and after two more good days they go. A hard day (4 or fewer right first time) brings one step back. Days in between (5 to 7) change nothing and break the run of good days. Playing again the same day never moves them. When a Golden Egg is won and the next beanstalk starts (a new sum), the dots start full again. Inside a round, after three goes in a row that began with a wrong first tap, the full dots come back for the rest of that round and Bella says "Here are the dots again to help." (the line is said once, only if the dots were not already full; it is not saved, so the next round starts at the child's own level).

What a teacher sees: the "Dots on the leaves" switch is still the override (off means numbers only for everyone, and the three-in-a-row boost does not turn them back on). The drawer text and the game's "about" text now say the dots follow each student. A student's page says what the leaves will show next time for that student and how it moves, read from the saved level, not from the day count.

What stays on the calendar: leaf colours (bronze, silver, gold), the tray colour, the Golden Egg and the friend.

How it is built: new columns `help` (0 full, 1 small, 2 none) and `good_in_row` on `beanstalk_progress`. Existing pupils are backfilled from where the calendar had them, `least(2, (days_done % 30) / 10)`, so nobody's picture jumps on the day this goes live. The rule is `placeAfter` in `shared/beanstalk/progress.ts`, which uses the kit's `fadeAfter` and the kit's `STRUGGLE_GOES`; the server counts the pairs right first time from its own replay of the taps, saves the new level with the finish, and returns it from `load` and `finish`. The new `beanstalk_finish` takes the two new values as last arguments that default to null (keep what is saved), so the function already deployed keeps working in the gap between the migration and the new function going out.

Checked: typecheck, the changed tests (ten runs each, no flakes), the site build and `npm run build:functions -- beanstalk`. The database test is extended but was not run here (no Docker); CI runs it. Played in the preview: see the pull request.

Next, from this plan: Hop, Penguin Pairs and Pipi do the per-fact version (Weka style, `helpForFact` in the kit), with no migration; each saves a help `h` on every go in `makeRound`, falls back to the calendar help for a saved round with no `h`, keeps the teacher's switch as the override, and adds its own "help is back" line after three goes in a row with a wrong first tap. Because R5 touched the same files, build them one after the other.

## 10. Results: Hop's Glow-worm Pond (built 7 Nov 2026, branch `r6-hop-help`)

What a child sees: the "+10" label over each hop's arc now belongs to the fact, not the calendar. A fact that is new to the child (or that they got wrong lately) shows the bold label. After the child has got it right and quickly on two different days (and it has reached box 2) the label goes faint; after it is fluent (box 4) and right six times it goes. A wrong answer drops the fact back to box 1, so its bold label comes back by itself. When the step moves up (tens to fives to twos) the new facts have no record, so the labels are bold again, which is the gap the evaluator saw. Inside a round, after three hops in a row where the first glow-worm tapped was wrong, every hop for the rest of that round shows the bold label and Bella says "Here are the hops again to help." (said once, only if some hop still to come was not already bold; not saved, so the next round starts from the child's own facts).

What a teacher sees: the "Step labels on the hops" switch is still the override. Off means no labels for anyone and the three-in-a-row boost does not turn them back on. The switch text and the game's "about" text no longer say the labels go by days: they say the labels follow what each student knows and come back after a slip, and that three wrong first taps in a row bring them back for the rest of that round.

What stays on the calendar: the colour of the pads, the scenery, the jar and the friend, and the counting-back hops on days 21 to 30. A round that was already open when this went live has no help saved on its hops, so it shows the calendar's label for that round only.

How it is built: `makeRound` in `shared/hop/round.ts` saves a help value `h` ('full', 'faint' or 'none') on every hop, worked out with the kit's `helpForFact` from the child's record of that fact. The hops are already saved as JSON, so there is no migration and no new column. The kit is unchanged. The browser shows the hop's own `h`, falls back to the calendar help when a hop has none, and `wrongFirstRun` (in `shared/hop/play.ts`) counts the wrong-first-tap run using the kit's `STRUGGLE_GOES`. Only the `hop` function needs to be redeployed (it holds `makeRound`); until it is, children keep seeing the calendar labels.

Choices made without asking: the faint to none step needs six right answers (Weka uses twelve), because Hop only practises about three dozen facts and a child sees each one only every few days. The labels are not changed by the child's day count at all. There is no per-student line on the teacher's page about labels.

## 11. Results: Penguin Pairs (built 7 Nov 2026, branch `r6-korora-help`)

What a child sees: the picture with each go now belongs to the fact, not the calendar. A fact that is new to the child (or that they got wrong lately) shows the full picture: the clear reflection with each fish joined to its mirror fish, and halves shared out one by one. After the child has got it right and quickly on two different days (and it has reached box 2) the picture goes faint; after it is fluent (box 4) and right six times it goes. A wrong answer drops the fact back to box 1, so its full picture comes back by itself. When the level moves up (doubles to 5, halves to 10, doubles to 10, halves to 20) the new facts have no record, so their pictures are full again. Inside a round, after three goes in a row where the first stone tapped was wrong, every go for the rest of that round shows the full picture and Bella says "Here is the picture again to help." (said once, after the line for that wrong stone, and only if some go still to come was not already full; not saved, so the next round starts from the child's own facts). "Let's look together" still shows the full picture and "Now you try" goes back to the go's own help.

What a teacher sees: the "Picture help" setting still wins. Always on shows full pictures on every go, Off shows none, and with Off the three-in-a-row boost does not bring pictures back (before this change it did). The Fades text and the game's "about" text no longer say the pictures go by days: they say the help follows what each student knows and comes back after a slip, and that three wrong first taps in a row bring it back for the rest of that round.

What stays on the calendar: the stepping stones, the light and scenery, the shoes and the friend, and the two "fair or not?" goes that end a gold-day round (which goes are asked, not how much picture each shows). A round that was already open when this went live has no help saved on its goes, so it shows the calendar's help for that round only (bronze days full, silver faint, gold none).

How it is built: `makeRound` in `shared/korora/round.ts` saves a help value `h` ('full', 'faint' or 'none') on every go, worked out with the kit's `helpForFact` from the child's record of that fact. The goes are already saved as JSON, so there is no migration and no new column. The kit is unchanged. The browser shows the go's own `h` (`Goes.tsx`, `helpAt`), falls back to the calendar help when a go has none, and uses the kit's `STRUGGLE_GOES` for the in-round boost. Only the `korora` function needs to be redeployed (it holds `makeRound`); until it is, children keep seeing the calendar's pictures.

Choices made without asking: the faint to none step needs six right answers (as Hop; Weka uses twelve), because each level has only five facts. The pictures are not changed by the child's day count at all. The teacher's Off now also stops the in-round boost, so "the teacher's setting wins" holds in every case. The "fair or not?" facts (`oddeven:`) follow the same rule as doubles and halves.

## 12. Results: Pipi's Hidden Shells (built 7 Nov 2026, branch `r6-pipi-help`)

What a child sees: the frame and outlines now belong to the split, not the calendar. A split that is new to the child (or that they got wrong lately) shows the five-frame or ten-frame with a dashed outline where each hiding pipi is. After the child has got it right and quickly on two different days (and it has reached box 2) the frame goes and the outlines are faint; after it is fluent (box 4) and right six times the hiding ones leave no mark. A wrong answer drops the split back to box 1, so its frame and outlines come back by itself. When the level moves up (wholes 3 to 5, then 6 and 7, then 8 to 10) the new splits have no record, so they start with the full help. Inside a round, after three goes in a row where the first shell tapped was wrong, every go for the rest of that round shows the frame and outlines and Bella says "Here are the outlines again to help." (said once, after the line for that wrong shell, and only if some go still to come was not already full; not saved, so the next round starts from the child's own facts). Before this change Pipi had no help boost inside a round at all. "Let's look together" and "Now you try!" from #271 are unchanged.

What a teacher sees: the "Help in the sand" switch is still the override. Off means no frame and no outlines for anyone, and the three-in-a-row boost does not bring them back. The switch text and the game's "about" text no longer say the help goes by days: they say it follows what each student knows and comes back after a slip, and that three wrong first shells in a row bring it back for the rest of that round.

What stays on the calendar: the colour of the shells, the scenery, the pearl and the friend, and which goes are asked (the "how many altogether?" goes on silver and gold days and the two-tides goes on gold days). A round that was already open when this went live has no help saved on its goes, so it shows the calendar's help for that round only (bronze days full, silver faint, gold none).

How it is built: `makeRound` in `shared/pipi/round.ts` saves a help value `h` ('full', 'faint' or 'none') on every go, worked out with the kit's `helpForFact` from the child's record of the go's own fact (for a two-tides go that is the split as it is after the swap, which is the fact it records). The goes are already saved as JSON, so there is no migration and no new column. The kit is unchanged. The browser shows the go's own `h`, falls back to the calendar help when a go has none, and `wrongFirstRun` (in `shared/pipi/play.ts`) counts the wrong-first-shell run using the kit's `STRUGGLE_GOES`. Only the `pipi` function needs to be redeployed (it holds `makeRound`); until it is, children keep seeing the calendar's help.

Choices made without asking: the faint to none step needs six right answers (as Hop; Weka uses twelve). Pipi has 15 to 30 splits a level and ten goes a day, so most splits will stay faint for a long while before they go. The boost can start on the first wrong shell of the third go, and takes the current go to full at once. The teacher's Off wins over the boost. The edge splits (none or all hiding) still come at most once a round.
