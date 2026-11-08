# Swamp Hen's Reed Rows: second review (blind, 8 Nov 2026)

Folder: `swamphen`. Read: rubric, `docs/SWAMPHEN-PLAN.md`, N4 plan, all of `src/games/swamphen/`, `shared/swamphen/`, the function, the migration `20261107001100_swamphen.sql`, the kit parts it imports. Played in the preview on port 5311 (the Browser pane was shared with other helpers and I could not open my own tab, so I drove the page in tab-8 mostly by script, with a few screenshots). Each piece of evidence is marked **(play)** or **(code)**.

**Switch status.** The card carries `inDevelopment: true` (`src/games/swamphen/index.tsx`), which only draws an "In development" sticker (`src/components/GameCard.tsx:93`). It does not hide the game. It is really on: `SWAMPHEN_ON = true` (`switch.ts:8`), the database column `app_settings.swamphen_enabled ... default true` (migration line 161), and the `hub_games` row is inserted. So every class has it on unless a teacher switches it off. I could not check the live database, so "applied live" is unverified; the go-live note says the workflow applies the migration on merge.

## How it works

Each day is ten goes in a reed garden. The child sees an array of shoots (rows by shoots in a row) and taps one of four cards: the total number, or (in "Which garden") one of four pictures. The garden shows more or less help depending on a help level 5 to 0 (every row shaded with running totals, down to a bare rectangle with edge numbers, down to the sum alone). Kinds of go: plant rows one by one then count, a mat covers all but the first row, turn the garden, which garden is R rows of C, share a pile into equal rows, cut a big garden in two, and "one row short of ten". A wrong tap shows a one-line reason (named slip), a second wrong tap runs "Let's look together", then "Now you try". The server makes and replays the round. The first finish each NZ day turns one of ten reed rows (30 days to a Golden Reed Garden).

## The maths

Six steps (`shared/swamphen/round.ts:54-61`; names at lines 32-39):

| Step | Name | What | Keys |
|---|---|---|---|
| 1 | Equal rows | Plant rows of 2, 5, 10, count all (e.g. 2 rows of 2, 5 rows of 10) | `rows:` with row size 2, 5 or 10 (`STEP_ONE_ROW_SIZES`, config.ts) |
| 2 | Turn the garden | A x B turned is B x A; "which garden is R rows of C" with four pictures | `turn:` and `which:` |
| 3 | Under the mat | Other rows facts with the array hidden under a mat | remaining `rows:` keys |
| 4 | Share them out | N shoots into R equal rows, how many in a row (division) | `share:` |
| 5 | Cut the garden | Big array cut at 5 rows (5 x b plus the rest), rows 6 to 8 | `cut:` rows < 9 |
| 6 | One row short | 9 x b as 10 x b minus b | `cut:` rows = 9 |

How the next level is chosen: only on the day's first finish (`server.ts` finish; `result.rowChanged === null` leaves the place alone). `placeAfter` (`round.ts:99`, kit `help.ts` `placeAfter`): 8 or more right at the first tap = a good round; 2 good rounds at a step pass it (`GOOD_TO_PASS`, config.ts:19), never drops back. Help level: 2 good rounds in a row take it down one; 4 or fewer right puts it up one; a new step brings it up 2 unless it faded the same day (`NEW_STEP_HELP`). Within a step, 7 goes are the step (weakest first) and 3 are earlier steps (`makeRound`, round.ts:194-203). A new child starts at step 1 level 5, or step 2 if Hop's counting is secure, or step 5 level 2 if the 2 to 5 times tables are secure (`startFor`, round.ts:111). Every times fact also records the plain `mul:AxB` key.

## Scores (1 to 4)

**1. Maths fidelity: 3.**
- The array is correct and the big idea (equal rows, commutativity, one fact built from another) is the mechanic. Rows and columns neat, edges labelled. (play, `art.tsx` Garden)
- Tapping through: a round could be finished by tapping the first card each go with no maths. 10 goes, row turned bronze. Cost: only that the step never moves (needs 8 of 10 first-tap). With 4 cards and "joined digits" (23, 53, 63, 37) or "a+b" cards, many go can be eliminated by shape. (play: 3x7 cards were 10, 14, 21, 37; 2x3 cards were 3, 5, 6, 23)
- "Turn it round" only swaps the two edge labels and cannot be wrong; the answer does not need it. At level 2 the picture is a plain brown rectangle with "3" and "5" at the edges, no shoots at all. (play, screenshot)
- Under the mat at level 2 hides every row, including the first; the plan said the first row and column always show. A brown bar and a woven mat with the two numbers. (play, screenshot; `art.tsx` `covered = mat && r > 0` only removes shoots at levels that draw them)
- "Share" shows 5 empty lanes and a pile. Nothing deals. The child does not do the sharing. (play, screenshot)
- After the second wrong tap or at level 5 the running totals (3, 6, 9, 12) leave one skip-count to the answer. Fine as help, but it is nearly the answer. (play)

**2. Clarity: 3.**
- Every line has a clip (245 files in `public/voice/swamphen`), "Hear it again" always on the screen, voice toggle, a first-time two-tip card. The question is also written in big text. No timer. (code, play)
- Cards 120 x 69 px, same place every go; picture cards in "Which garden" are small (about 110 px) and have no labels. (play)
- On the "Which garden" go the question text was faint and almost the same colour as the scene. (play, screenshot)
- Home: the "Play" button is clear. No competing decoration found in a go; friend bird sits in the corner. (play)

**3. Support and structure: 3.**
- The model is there at the start (level 5, shaded rows with totals), and it comes automatically after a wrong tap (the picture rises a level at wrong tap 1, full at wrong 2). (play, `round.ts:300` `pictureFor`)
- A guided first go (2 rows of 2 with a pointing hand on "Plant a row") exists, but only for the very first go (`guided={state.daysDone === 0}`, `SwamphenGame.tsx`). No demonstration the first time mat, turn, share, cut or one row short appears; the child meets each with no example until they get it wrong. (code)
- Level-1 "Peek" is a button the child must find. (play, `Goes.tsx:77`)

**4. Fading: 3.**
- Six levels, fade after 2 good rounds, back up after a hard round (4 or fewer), a new step brings it back up 2 but not if it just faded. Done per child, not per skill (step), so one weak kind pulls all kinds up. (code, `help.ts`)
- The kit's "3 wrong goes in a row bring full help back for the rest of the round" is declared (`config.ts:35`, `STRUGGLE_GOES`) but nothing uses it. I found no use anywhere in `src/games/swamphen` or `shared/swamphen`. (code)
- Fading only counts on the day's first finish, so it moves at most one level a day: a strong child waits 2 days per help level, 10 days to reach level 0. (code)
- A new step lands the child on level 2 (`edges`), where the picture is an empty rectangle. That is a big drop for a new idea (division at step 4 starts with hidden Peek). (play)

**5. Progression: 3.**
- Order is research-like: equal rows of 2/5/10, turn, bigger rows under a mat, sharing, cut, one-row-short. (code)
- Adapts per child through steps and help level; a quick child can start at step 5. Mastery needs two 8-of-10 days. (code)
- Review: 3 of 10 goes from earlier steps, weakest first; "Which garden" and turn are mixed in step 3. Mixed kinds appear from step 2. (play)
- No target of 75 to 90 percent success is measured; the 8-of-10 gate is the only signal. A day can lift the help and the step together (play, a perfect day went to step 4 while review goes continued).

**6. Feedback: 3.**
- Named slips (added, joined, short, spare, forgot, minus, rows, turned, scatter), one line each, kind tone ("Count equal rows instead"). Real misconceptions. (play, `voiceLines.ts SLIP_LINES`)
- The "why" panel shows a 🤔 emoji, not the garden with the mistake lit up. (play; `Goes.tsx` ShowWhy picture is an icon)
- "Let's look together" for share says "Deal the shoots out" but only the same still picture shows. (play, screenshot)
- Retry always follows; the answer is not shown. After 3 wrong taps the choices drop to 2, so the child gets there by elimination. (play: after taps 5, 20, 10 only 3 and 5 were left, and 5 had already been tried: the left-over wrong card is one the child already knows is wrong, so the answer is forced)
- Praise is "Well done!" even after a round of pure guessing; "You are so good at this!" at step up. Not about effort or strategy. (play)

**7. Progress recording: 3.**
- Round JSON (every go with key, kind, help level, cards) and the taps (each tap's pick and ms) are saved, so wrong choices and help level are recoverable by replaying. The maths facts (`rows:4x6`, `mul:4x6`) go to the shared records. (code, migration)
- Wrong answers are not in their own columns; a teacher sees only a computed "usual slip" from the last 3 rounds. (code, `teacher.ts`)
- Teacher sees: pupil page line, 3 hardest keys, usual slip, step and help level, last played. Not on Today's "Needs you", not on the class grid, not on "Hardest right now": the foundational code lists only six games (`src/teacher/foundational/alerts.ts` ENABLED map). (code)

**8. Engagement: 3.**
- The maths (counting rows, building on facts) is most of the play; rewards are a reed row a day and are not paid for taps. (code)
- Painted garden, bird friends, Golden Reed Garden for 30 days, five achievements; no ranking. Little real choice during play (no choice of friend, garden or route). (code)
- A random tapper still gets the day's reed row (the row turns on any finish). (play)

## 25-item checklist

| # | Item | Result |
|---|---|---|
| 1 | Maths action is the game | partly: counting rows is the task; "turn" and "share" are passive |
| 2 | Cannot win by guessing | partly: day finishes by tapping; step does not move, but elimination of odd-looking cards works |
| 3 | Representation matches | partly: array correct; at low help level just a rectangle; mat hides first row |
| 4 | Pre-reader can start alone | yes: voice clips, hear again, big text |
| 5 | One question, one action | yes |
| 6 | Big targets, no timer, short | yes: 120 x 69 px cards, 10 goes; which-garden pictures small |
| 7 | A model when new | yes: shaded rows with totals at level 5 |
| 8 | Help appears after mistakes | yes: picture rises, look-together; Peek needs a tap |
| 9 | Worked example for new types | partly: only the first go; none for mat, share, cut |
| 10 | Support reduced step by step | yes: 6 levels |
| 11 | Support returns on failing | partly: hard round raises a level; 3-wrong-in-a-row rule unused |
| 12 | Expert not slowed | partly: one level per day; teacher can set Off |
| 13 | Research order | yes |
| 14 | Adapts to about 75 to 90% | partly: steps on 8 of 10; no band target |
| 15 | Older skills return and mix | yes: 3 of 10 goes |
| 16 | Move-up needs steady success | yes: two good days |
| 17 | Sees what went wrong on same model | partly: text line and emoji; picture does not show the slip |
| 18 | Another go with help | yes |
| 19 | Praise about effort, not shaming | partly: kind, but "Well done" regardless |
| 20 | Server saves per child, per skill | yes: rounds with taps and help level, fact records |
| 21 | Wrong answer chosen is saved | yes: tap picks saved; slip derived on read |
| 22 | Teacher sees who is stuck | partly: pupil page only; no alerts or grid |
| 23 | Fun from the maths | yes, mostly |
| 24 | Choices, growth, kind social | partly: growth yes; few choices; no social |
| 25 | Clear goal, active thinking | partly: "how many shoots" is clear; share and turn are watching |

## Problems found (worst for learning first)

1. **Sharing is not done by the child.** Step 4: set step 4, play: 15 shoots, 5 lanes, a pile, nothing to move. "Let's look together" says "Deal the shoots out" and shows the same still picture. Division is only a number question.
2. **Under the mat and low help hide the structure.** Set step 3 level 2, play: a mat covers all rows, the first row is not shown. At level 2 turn goes show a plain rectangle with "3" and "5". The plan's "use the rows you can see" is not true.
3. **The round can be finished by tapping the first card each go.** Tap the first card every go (all kinds): a reed row turns bronze, "Well done!". Nothing lost but the step. Also a day's row and the "Well done" line do not look at score.
4. **Cards can be picked by shape.** "Joined digits" card (23, 53, 63, 37) is always the biggest odd one out; "a plus b" is a small number. After 3 wrong taps, 2 cards stay and one is a card already tried, so the answer is forced.
5. **Turn it round changes nothing the child must use.** Press or do not press: the answer cards are the same.
6. **No demonstration for new kinds.** Only the first go of the first day is guided; mat, share, cut, short first appear cold.
7. **Struggle rule unused.** `STRUGGLE_GOES` is never read. Three wrong goes in a row do not bring full help back for the rest of the round.
8. **Slow fading.** One day counts per level; Day count, not goes.
9. **"Which garden" question text faint, pictures small and not labelled.** Step 2 first go (screenshot).
10. **Not in Today alerts, class grid or the players tracker.**

## Saved per child on the server

- `swamphen_progress` (one row a pupil): `days_done`, `last_day`, `step`, `level`, `good_in_row`, `good_at_step`, `version`, `updated_at`.
- `swamphen_rounds` (one row a challenge): `player`, `seed`, `round` jsonb (each go: key, kind, help level `l`, plus the cards), `open`, `taps` jsonb (each tap `pick` and `ms`), `mistakes`, `first_right`, `started_at`, `finished_at`. Finished challenges older than 30 days are deleted.
- Facts go to the shared maths records (`gem_keep_facts`, pack `early-facts`, plus the plain `mul:` keys) through `recordMathsAnswers`, with a quick time of `JUNIOR_QUICK_MS`.
- Wrong choice: saved in `taps` (the picked number or picture code); the kind is worked out on reading. Help level: saved per go in `round`.
- Teacher today: pupil page line, 3 hardest keys, "usual slip" from the last 3 rounds, step and help level, class Games row (players, prizes), help setting (fade, always, off). Not on Today, the class grid or the tracker.

Queries to run (read-only, not run by me):

```sql
-- Where each pupil is: step, help level, days played
select p.player, p.step, p.level, p.days_done, p.last_day from public.swamphen_progress p order by p.step desc, p.days_done desc;

-- How a day went: right at first tap and wrong taps for each finished challenge
select r.player, r.finished_at::date as day, r.first_right, r.mistakes
from public.swamphen_rounds r where not r.open order by r.finished_at desc limit 200;

-- Possible tappers: finished challenges with 3 or more wrong taps per go on average and few right at first tap
select r.player, count(*) as rounds, avg(r.mistakes) as avg_mistakes, avg(r.first_right) as avg_first_right
from public.swamphen_rounds r where not r.open group by r.player having avg(r.first_right) < 4 order by avg_mistakes desc;
```

## Strengths

- Correct, tidy arrays; the "equal rows to times facts" link is made on the server (`mul:` keys).
- Voice for every line, hear-again always, large cards, no timer, ten goes.
- Misconception-built wrong cards with named slips, replayed on the server, so nothing that counts comes from the browser.
- Help follows the child (six levels, per-child fade and return), teacher can set it.
- Earlier steps return inside each round; a child who knows the tables starts higher.

## Gaps

- Sharing, turning and the mat are not hands-on; the help-level-2 picture is an empty rectangle.
- No worked example for new kinds; the struggle rule is dead code.
- Same-day replays and guesses still earn the row and the "Well done".
- The why panel does not show the mistake on the garden.
- Teacher alerts and class grid do not include this game.

## Candidate improvements

| # | Problem | Change | Files | Effort | Impact |
|---|---|---|---|---|---|
| 1 | Sharing is passive | Let the child tap a lane to deal one shoot each, round by round; the look-together plays the dealing | `Goes.tsx`, `art.tsx`, `round.ts` (a "dealt" tap not counted) | M | High: division becomes real |
| 2 | Level 2 and mat hide structure | Always draw the first row and first column (even under the mat and at edges level); never a bare rectangle | `art.tsx` Garden, `round.ts viewFor` | S | High |
| 3 | No demo for new kinds | A short guided go the first time each kind appears (mat, share, cut, short), saved per child (a `seen` kinds field) | `Goes.tsx`, `server.ts`, migration | M | High |
| 4 | Struggle rule unused | Three wrong first taps in a row set the rest of the round to level 5 (use `STRUGGLE_GOES`) | `round.ts`, `Goes.tsx` | S | Medium |
| 5 | Guessing by elimination | Make "joined" and "a plus b" cards follow the answer's size and ending; after 3 wrong never leave an already-tried card | `round.ts wrongCards`, `pictureFor` | S | Medium |
| 6 | Why panel is a 🤔 | Light up the slip on the garden (extra row glowing, rows versus columns) | `Goes.tsx`, `art.tsx`, `voiceLines.ts` | M | Medium |
| 7 | Teacher cannot see stuck children | Add swamphen to the Foundational grid, Today alerts and Hardest (and the players tracker) | `src/teacher/foundational/*`, `src/data/foundational.ts` (shared files, James's OK) | M | High for teachers |
| 8 | Slow fading, praise | Count the fade on goes in a round as well as days; praise strategy ("You counted the rows") instead of "Well done" after a low round | `shared/kit/help.ts` (shared), `words.ts` | M | Medium |

## Learning-design rules (read after scoring)

| Rule | Result | Evidence |
|---|---|---|
| 1 Maths is the move | partly | Counting an array is the move; turn, share and mat are passive; a round can be tapped through |
| 2 One thing at a time, voice first | met | 245 clips, hear again, big written question; which-garden pictures small |
| 3 Concrete, picture, number | partly | Six-level ladder, but level 2 is an empty rectangle, and kit `TenFrame`/`NumberLine`/`DotPicture` are not used |
| 4 Help arrives by itself | partly | After wrong taps, yes; first-time demo only for the first go; Peek is a button |
| 5 Help follows the child | partly | Per-child fade and return; per step not per fact; `STRUGGLE_GOES` unused; one level a day |
| 6 Progression | partly | Research order, review 3 of 10, mastery by two good days; no 75-90 target; ladder is 6 steps with a 30-day garden; no "what's next" at the top (`TOP_STEP` never passed; no card to another game) |
| 7 Mistakes teach | partly | Named slips, look-together, redo; picture does not show the slip; the redo is replayed |
| 8 Fair timing | met | Clock starts after the voice (`Goes.tsx` `say` callback); `JUNIOR_QUICK_MS` |
| 9 Record evidence | partly | Taps, help level, facts saved; no alerts or grid |
| 10 Fun from the maths | partly | Reed row a day regardless of score; growth visible; few choices |

**Kit parts used:** `shared/kit` `dayArc`, `help` (`placeAfter`, `helpWithSetting`), `replay`, `mistakes` (`tagWrongs`, `atMostShareTell`, `stepGo`); `src/kit` `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy`/`LookTogether`/`NowYouTry`, `FirstTimeTip`, `WhatsNext`. **Could use but does not:** K3 `TenFrame`, `NumberLine`, `DotPicture` (it draws its own `Garden`, `Pile`, `Lanes`); the kit's struggle rule (`STRUGGLE_GOES`); K5 teacher grid helpers (`shared/kit/teacherGrid`) and the foundational alerts.
