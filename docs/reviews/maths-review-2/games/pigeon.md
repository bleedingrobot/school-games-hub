# Pigeon's Number Line: second review (blind)

Maths idea: placing, reading and comparing numbers on a number line (0 to 100, then 0 to 1000). Played in the preview on port 5308 (own tab, closed after; server stopped). Scores below say "seen" (played) or "code" (read in code). Nothing from the first review was read.

**Switched on?** Yes, really on. `src/games/pigeon/switch.ts:8` sets `PIGEON_ON = true`, `src/games/registry.ts:73` adds the game when `pigeonOn()`, and the migration (`supabase/migrations/20261107000200_pigeon.sql:161`) adds `app_settings.pigeon_enabled boolean not null default true`, so it is ON for every class unless a teacher turns it off (the server also checks the switch on every call, `shared/pigeon/server.ts:107`). The "In development" sticker is only `inDevelopment: true` at `src/games/pigeon/index.tsx:45`; it shows on the card (`src/components/GameCard.tsx:93`) and changes nothing about who can play.

## How it works

Each day a child helps Pigeon (a wood pigeon) fly a berry branch: ten goes on a painted forest scene, each go a number line. Four kinds of go: tap where a number goes on the line, read the number at a marked spot (four number cards), "ten more / ten less than 63" (four cards), "is 64 closer to 60 or 70?" (two cards). Zoom goes show a lens over part of the line. Help is how many numbers are written on the line (every number marked down to just 0 and 100). A wrong tap shows a one-line reason, the second wrong tap gives "Let's look together" (line fully marked, voice names the marks either side), then "Now you try". The first finish each NZ day turns one of ten berry clusters bronze, silver, gold; 30 days wins a Golden Berry Branch and a new bird friend. No points, no ranking. The server makes each round, and replays the child's taps to mark it.

## The maths

Seven steps, in this order (`shared/pigeon/round.ts:30-54`):

1. Tens on the branch: place 10, 20 ... 90 on 0 to 100 (keys `place100:t..`). Ten goes on nine tens, the weakest twice (`round.ts:202-205`).
2. Read the arrow: pick the number at a marked point on 0 to 100 (`read100`). Four cards.
3. Place any number: 0 to 100 (`place100:n..`).
4. Ten more, ten less: from a number, four cards (`tens100`).
5. Which ten is closer: two cards, two posts (`near10`). The halfway numbers (65) only come once 70% of the others are secure (`round.ts:62-67`, `config.ts:44`).
6. Zoom in: place and read on a lens such as 70 to 80 inside 0 to 100 (`zoom` keys; odd number placed, even read, `round.ts:178-182`).
7. The long branch: 0 to 1000, place, read, nearest hundred (`round.ts:53`).

How the next level is chosen: two separate things, both per child, both worked out by the server when a round starts (`shared/pigeon/server.ts:125-146`).
- Step: passed after 2 "good" challenges (8 or more of 10 right at the first tap) at that step. Never goes back (`round.ts:104-109`, kit `shared/kit/help.ts:121-130`, `config.ts:14-16`).
- Help level (5 down to 0): two good challenges in a row take it down one; a hard one (4 or fewer) brings one back; a new step brings two back unless it just faded; zoom and long branch start at level 3 or more (`round.ts:104-109`, `help.ts:96-110`). Only the day's first finish moves either (`server.ts:152-153`); play-again changes nothing.
- Which goes: from step 2, 7 goes from today's step (weakest box first) and 3 review goes from earlier steps (`round.ts:206-209`, `config.ts:7`). A new child who already knows Ruru facts or ten-and facts starts further on (`round.ts:112-118`).
- Wrong cards: built from named slips (digits reversed, a whole ten out, one out, mirror), at most two cards share the answer's last digit (`round.ts:252-276`).

## Scores

**1. Maths fidelity: 3**
- Placing a number by tapping the line is the maths itself; the line is correct and evenly scaled, zoom lens is drawn above the whole line with dashed lines (seen; screenshot of the zoom go). Read goes show the dot on the same line (seen).
- Place goes cannot be won by guessing: tolerance is 1/20 of the line (1/30 for tens) (`round.ts:279-283`, seen: tapping 4 off a ten was wrong, 3 off right). But a child can tap at every ten (10 taps) at no cost to finish, and with every number marked the answer is a "match the numeral" task, not a sense of size.
- Near goes have only two cards (`round.ts:309`): a blind guess is right half the time (code, and seen "Is 4 closer to 0 or 10? 0,10").
- Random tapper on a four-card go (seen, step 2): tapped all four cards in turn, the go ended with no maths and nothing lost except the first-tap record. After the third wrong tap the game removes cards, but the one left with the answer is one already tried and wrong (45 and 54 were left, 45 already tapped), so the answer is effectively given (`round.ts:378-381`, seen).
- The "arrow" in "What number is at the arrow?" is a dot with a tiny "?" above it, no arrow (seen). Mildly confusing.

**2. Clarity: 3**
- Every go is read aloud, "Hear it again" is always top-centre, voice on/off, 349 clips in `public/voice/pigeon` (seen the buttons, clips counted). The goal is also written on screen ("Where does 50 go on the branch?").
- One question at a time; cards big (about 90 by 60 px) and in a fixed place at the bottom; no timer (seen).
- Guided first go: after 2.6 s a pointing hand points at the line (`Goes.tsx:27`, `useGuidedFirstGo`, code only; I did not wait for it to show).
- Layout jumps: when the reason panel appears the line moved up about 80 px mid-tap (seen, step 1 wrong tap). Taps on a thin line near ticks are fiddly for small hands.
- Zoom goes have no explanation at all of why the line suddenly has a second line under it (seen). The plan promised a short lens animation; the code has none.

**3. Support and structure: 3**
- The model (the line, with every number marked at first) is there from go one, and is the same model used in feedback (seen).
- Help is automatic: first wrong tap adds marks (level 0 went from 2 labels to 3, then 11 after the second wrong tap, seen), "Let's look together" after the second (seen). Level-1 children get a "Peek" button, which is hunting for help (`Goes.tsx:112,226`), though wrong taps also bring it.
- A guided first go exists (`round.ts:131`, `server.ts:122`). No demonstration the first time zoom, ten more/less, or "closer" appears (code; seen zoom with nothing).

**4. Fading: 3**
- Help fades in 6 steps (every number named with ticks, every ten, tens as ticks with ends and middle, middle, ends) with success (`round.ts:343-355`) and returns after a hard round, a new step or a new line length (code, `config.ts:22-26`). Seen the individual go levels change.
- But it is one level per child, not per skill: a child secure on placing tens and new to zoom share one level (`pigeon_progress.level`). The step change adds two back, so fading and stepping fight.
- The in-round struggle rule (three first-tap wrongs in a row brings full help for the rest) is in `config.ts:31` and the kit but is never used: no code in `src/games/pigeon` or `shared/pigeon` reads `STRUGGLE_GOES` (grep, code only). Level 5 to level 3 with ticks removed is a big visual jump.
- A child who knows it quickly gets help faded only after two good challenges, so can be slowed for about four days; the Off teacher setting exists.

**5. Progression: 3**
- Order is research-based: tens, read, any number, ten more, closer, zoom, 1000 (code). Adaptive in two ways (step and help), 3 review goes in each challenge from earlier steps (code, `round.ts:206-209`; seen steps 5 round included place goals).
- Mastery: 2 good challenges of 8 of 10 at the first tap (`config.ts:14`). Reasonable. Step 1 is thin (only nine numbers, two days' worth) and step 2 jumps the child straight to any number to read.
- Things never come back mixed after step 7 except through the 3 review goes; no step down if a child struggles after a step-up (only help returns). "Closer" halfway numbers unlock only at 70% secure.
- With 7 steps and 2 good challenges each, a quick child reaches the top in about 14 days and the remaining 16 days are step 7 only.

**6. Feedback: 3**
- Wrong card: named slip lines, read aloud: "Those digits are the wrong way round", "That is a whole ten away", "Close! Count along from the nearest ten", "That is on the other side of the branch" (`voiceLines.ts:25-31`, seen the reverse and "Close" lines). Wrong place tap: "too early / too far" and a ring where the tap landed (seen). Kind, never shaming.
- Second wrong: "Let's look together" then "Now you try" (seen). But the reasons show as text with a thinking emoji beside the line, not on the line itself (e.g. the near-ten gap is not drawn). Place look-together only adds two marks.
- After the third and later wrong taps there is no more reason, only "Now you try" (seen; stays on screen).
- Praise is generic ("Well done!", "Lovely! You found it."), not about strategy.

**7. Progress recording: 3**
- Server saves per child: `pigeon_progress` (days, step, help level, streak counters) and `pigeon_rounds` (the whole round, every tap, mistakes, first_right, started_at). Each key per round also goes to the shared maths facts (`recordAnswers`, correct on first tap, time) (`server.ts:156-162`).
- The wrong card or position tapped is saved in `taps` (and the cards offered, and the help level per go, in `round`); the slip name can be rebuilt. Not in a table a teacher can query easily.
- Teacher sees: Games table line (players, Golden Berry Branches), pupil page summary, hardest 5 keys, average placing distance and "squashed line" check (`src/pages/TeacherPigeon.tsx`, `shared/pigeon/teacher.ts`). Not seen anywhere: Today alerts, class grid (grep found no pigeon in `src/teacher` or `shared/kit/teacherGrid.ts`). So a teacher has to open each pupil.

**8. Engagement: 3**
- The maths action (find the spot, read the spot) is the play; painted forest and a cheering friend decorate success; day and cluster growth is visible; 30 days for a golden branch, new friend after. Choice is small (voice on/off only). No points or ranking.
- Right answers hold the screen 1.9 s (`Goes.tsx:35`), about 19 s per round of waiting.
- Reward is per day, not per tap, so tapping does not pay.

## The 25-item checklist

| # | Item | Result | Note |
|---|---|---|---|
| 1 | Maths action is the game | yes | Tapping the line is the maths. |
| 2 | Cannot win by guessing or tapping everything | partly | Place goes tight; cards and near (50%) can be tapped through; tapping each ten works. |
| 3 | Representation matches and is correct | yes | Even line, correct zoom lens, ticks. |
| 4 | Pre-reader can start alone | yes | Voice, Hear again, written question. Zoom unexplained. |
| 5 | One question, one action | partly | Clean, but panel appearance shifts the line. |
| 6 | Big targets, no timer, short | partly | Cards big; line thin; no timer; 10 goes. |
| 7 | Model available when new | yes | Full numbered line at start. |
| 8 | Help automatic after mistakes | yes | More marks after wrong tap; look together. Peek is a button at level 1. |
| 9 | Worked example for new types | partly | Guided first go for placing only; none for zoom, ten more, closer. |
| 10 | Support reduced step by step | yes | Six levels. |
| 11 | Support returns if failing | partly | After a hard challenge, per child; within-round rule unused. |
| 12 | Experts not slowed | partly | Two good challenges per level; teacher Off setting; start-further-on for known children. |
| 13 | Research order | yes | Tens, read, any, ten more, closer, zoom, 1000. |
| 14 | Adapts per child toward 75 to 90% | partly | Help adapts; the step only moves up, never down. |
| 15 | Old skills return and mix | partly | 3 review goes of 10; no full mixing at the top. |
| 16 | Move up needs steady success | yes | 2 challenges of 8+. |
| 17 | See what went wrong, on same model | partly | Voice and text line; the line shows only a ring and marks. |
| 18 | Another go with help | yes | Look together, then Now you try; answer not shown. |
| 19 | Praise effort; no shaming | partly | Kind, but generic praise. |
| 20 | Saves per child per skill | yes | Facts plus rounds with taps, ms, help level. |
| 21 | Wrong answer saved | partly | In taps JSON, not in a fact table or queryable per slip. |
| 22 | Teacher sees stuck and inactive | partly | Pupil page and hardest only; no alert or grid. |
| 23 | Fun from the maths; rewards decorate | yes | Per-day reward only. |
| 24 | Real choices, visible growth, kind social | partly | Growth yes; choice small; nothing social, which is fine. |
| 25 | Clear goal and active thinking | yes | "Where does 63 go?" invites "how did you know?" |

## Problems found

Ranked by harm to learning.

1. **Placing with every number marked is copying a numeral, so a child may not learn size.** Step 1 and level 5 always mark every ten (seen, step 1). Steps down over weeks, but the level goes back up two on every new step. Steps: new pupil, Play, tap on the matching numeral.
2. **Near goes are a coin toss.** Step 5 shows two cards (seen "Is 4 closer to 0 or 10?"). A guesser is right half the time, so a child can pass a step (8 of 10) with luck often enough. Steps: preview tool step 5, level 3, Play.
3. **After three wrong taps the one wrong card left is one already tried.** On a read go I tapped all four cards in turn (seen): after 45, 46 and 64 were wrong, "Now you try" left 45 and 54, so the answer is obvious. Code: `round.ts:378-381`.
4. **Within-round struggle rule is missing.** `STRUGGLE_GOES` is defined but unused, so a child failing three goes in a row gets no extra help until the next day.
5. **Zoom goes and ten-more goes arrive with no demonstration.** Steps: preview tool step 6, level 3, Play: lens and second line appear, only the voice line "Where does 73 go on the branch?"
6. **Teacher cannot see who is stuck without opening each pupil.** No Today alert, no class grid entry.
7. **Layout jump on the first wrong tap** (the line moves up about 80 px as the panel opens), and the reason sits below the line, away from the picture. Steps: step 1, tap 20 for 50.
8. **"Arrow" is a dot.** "What number is at the arrow?" shows a dot with a tiny "?" (seen, step 2).
9. **After the third wrong tap there is no new reason**, only "Now you try" (seen, step 1 tapping 10 then 90 then 10).
10. **"Peek" button at help level 1** puts the child in charge of asking for help; and the cluster day arc after finishing step 7 is 16 days of the same step.

Random tapper summary: on a card go it costs only the first-tap record (wrong) and the pupil's day still counts; it can be finished with no maths. On a place go, tapping each ten takes up to 10 taps and costs nothing.

## Saved per child on the server

- `pigeon_progress` (one row a pupil): `days_done`, `last_day`, `step`, `level` (help), `good_in_row`, `good_at_step`, `version`, `updated_at` (`20261107000200_pigeon.sql:28-37`).
- `pigeon_rounds` (a row per started challenge): `seed`, `round` (JSON with every go's key, kind and help level `l`, and cards), `taps` (JSON list of `{pick, ms}`: the card number or the place along the line 0 to 1000), `mistakes`, `first_right`, `started_at`, `finished_at`, `open`. Finished rounds older than 30 days go.
- Facts: `gem_keep_facts` pack `early-facts`, keys such as `place100:n63`, with attempts, correct, box, via `record_fact_answers`. Right/wrong at the first tap only, with time. The wrong choice and the help level are not in this table; they are in `pigeon_rounds` (the picks in `taps`, the help in `round.goes[].l`).
- Teacher sees: Games table line (players, branches), pupil page summary line (days, step, help level, prizes, hardest 3), a panel with last played, hardest 5 and the placing summary (average distance and a "squashed line" warning). Not on Today alerts or a class grid.

Read-only SQL for James (I did not run them):

```sql
-- Where every pupil is: step, help level, days done, last played
select p.player, pr.display_name, p.step, p.level, p.days_done, p.last_day, p.updated_at
from pigeon_progress p join profiles pr on pr.id = p.player
order by p.step desc, p.days_done desc;

-- Error rate per number-line key across all pupils (hardest keys first)
select fact_key, sum(attempts) as tries, sum(correct) as right,
       round(1 - sum(correct)::numeric / nullif(sum(attempts),0), 2) as error_rate
from gem_keep_facts
where pack = 'early-facts' and fact_key ~ '^(place100|read100|tens100|near10|zoom|place1000|read1000|near100):'
group by fact_key having sum(attempts) >= 10
order by error_rate desc limit 20;

-- Pupils with 3 or more finished challenges but 4 or fewer first-tap rights in the last three (stuck)
select player, array_agg(first_right order by finished_at desc) as last_firsts, max(finished_at) as last_done
from (select player, first_right, finished_at,
             row_number() over (partition by player order by finished_at desc) as rn
      from pigeon_rounds where not open) r
where rn <= 3 group by player
having count(*) = 3 and max(first_right) <= 4;
```

## Strengths

- Honest, correct maths: an even line, a proper zoom, tolerances that fit the line, no hidden shortcuts on placing.
- Kind, specific wrong-answer lines tied to real misconceptions (reversed digits, a whole ten out); wrong cards avoid same-ending tells.
- Help that follows the child with six levels, comes back per go after wrong taps, with a teacher Fades/Always/Off setting.
- Server makes the round and replays the taps; first tap only counts; play-again never moves levels.
- Taps saved in full, a "squashed line" check for teachers (rare and useful).
- Fully voiced, Hear it again, no timer, no points, nobody ranked.

## Gaps

- Near-ten goes only two cards; cards left after three wrongs give the answer away.
- No demonstration for zoom, ten more/less or "closer"; zoom appears with no explanation.
- Help is per child, not per kind of go; no in-round struggle rule though it is configured.
- No Today alert and no class grid entry for pigeon; teacher must open each pupil.
- The reason is text next to the line, not drawn on it; no reason after the third wrong tap; praise is generic.
- A quick child sits on step 7 for about two weeks.

## Candidate improvements

1. **Add a third and fourth card to "closer" goes.** Problem: 50% guess. Change: offer the two posts plus the other side's posts or the number itself (e.g. 60, 65?, 70), or ask the child to tap a post on the line. Files: `shared/pigeon/round.ts` (near branch), `Goes.tsx`, `pigeon.test.ts`. Effort S to M. Impact: medium (a clean pass of step 5 means something).
2. **Fix the leftover card after three wrongs.** Keep the answer and one card not yet tried (or add one fresh card). Files: `round.ts:378-381`. S. Impact: medium.
3. **Wire in the in-round struggle rule.** After three goes in a row with a wrong first tap, show every go at level 5 until the end of the round. Files: `Goes.tsx`, use `STRUGGLE_GOES` from `shared/kit/help.ts`. S. Impact: medium.
4. **A short demonstration for each new kind** (zoom: the lens opens from 0 to 100 into the gap with the voice saying "Zoom in to see between 70 and 80"; ten more: one jump of ten drawn). Files: `Goes.tsx`, `voiceLines.ts`, new clips; server holds "seen" in the progress row (new column, a migration). M. Impact: high for steps 4 to 6.
5. **Draw the reason on the line.** On a wrong place tap, show the span between the child's tap and the target; on "closer", draw the two gaps; keep the explanation after the third wrong. Files: `Goes.tsx`, kit `NumberLine` points. M. Impact: high (feedback is the learning).
6. **Teacher alert and class grid row.** Add pigeon to Today's "Needs you" (same level for 4+ days, last three challenges 4 or fewer right, gone quiet) and to the Foundational grid. Files: `supabase` teacher function, `src/pages/TeacherPigeon.tsx`, `shared/kit/teacherGrid.ts` (shared: James's OK). M. Impact: high for the teacher.
7. **Per-kind help level.** Keep a help level per step family (place, read, tens, near, zoom) so a child who is secure on placing is not given lots of help on zoom and vice versa. Files: `shared/pigeon/round.ts`, `progress` table (jsonb), migration, `server.ts`. L. Impact: high.
8. **Lengthen the ladder and stop the layout jump.** Add 2-digit "which is bigger" compare, 0 to 20 and 0 to 10 for beginners, and fractions of the line later; reserve space for the reason panel so the line does not move; make the dot an arrow. Files: `round.ts`, `pigeon.css`, `Goes.tsx`. M. Impact: medium.

## Learning-design rules

(Read after scoring. Checked against the code.)

| Rule | Met? | Evidence |
|---|---|---|
| 1. The maths is the move | partly | Placing is the move (`Goes.tsx`); but cards can be tapped through and near is a coin toss; no cap on wrong taps (the doc says at most two, then show and redo; here it is two, then the "look" phase, then free taps). |
| 2. One thing at a time, voice first | met | Voiced lines (`voiceLines.ts`), HearAgain, written question, no timer. Zoom is unexplained. |
| 3. Concrete, picture, number | partly | The line is the picture; no concrete step (berries on a branch are decoration); fades to ends only (`round.ts:343-355`). |
| 4. Help arrives by itself | partly | Wrong-tap marks and look-together are automatic; guided first go; but no demo for new kinds and the three-in-a-row rule is unused. |
| 5. Help follows the child | partly | Per child streak rules and teacher setting (`shared/kit/help.ts`); not per fact; the step-up and fade tested together as the doc asks. |
| 6. Progression | partly | Research order, 3 review goes, step only up; ends at step 7 with no "what's next" card; quick child waits at the top. |
| 7. Mistakes teach | partly | Named slips, look together, now you try; the redo is not saved as an answer (good); but a wrong tap shows only a text line and nothing after the third. |
| 8. Fair timing | met | Clock restarts after the voice ends (`Goes.tsx:111-113`), `JUNIOR_QUICK_MS` (`config.ts:60`), no visible timer. |
| 9. Record evidence | partly | Taps, ms, help level saved; hardest and placing summary shown; no Today alert, no class grid, slip kind not saved as a field. |
| 10. Fun from the maths | met | Reward per day only; guide character and visible branch; a teacher could ask "how did you know?". |

**Kit parts used:** `shared/kit/help.ts` (`placeAfter`, `helpWithSetting`, `ROUND_OF_TEN`), `shared/kit/mistakes.ts` (`stepGo`, `tagWrongs`, `atMostShareTell`), `shared/kit/dayArc.ts`, `src/kit` `NumberLine`, `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy` (`LookTogether`, `NowYouTry`), `WhatsNext`, `voiceLinesSuite` (in the voice test).

**Could use but doesn't:** `shared/kit/replay.ts` (the game has its own `shared/pigeon/play.ts`), `shared/kit/teacherGrid.ts` (no class grid row, the biggest miss), `FirstTimeTip` (would be the home for the zoom and ten-more demonstrations), `TenFrame` and `DotPicture` (a concrete berries-on-branch step before the line, for juniors).
