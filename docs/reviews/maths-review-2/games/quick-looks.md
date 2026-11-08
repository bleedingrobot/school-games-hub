# Quick looks (subitising): second review evaluation

Blind rerun, 8 Nov 2026. Played in the preview on port 5307 (browser used; scores come from play plus code). The real hub page also saves to the server through Training; I read that code but could not play it (the preview saves in the browser only). I did not read the first review. "Seen" = seen in play, "Code" = read in code.

Code: `src/subitising/` (SubitisingApp, FlashRunner, PictureSvg, Garden, voiceLines, saving), `shared/subitising/` (config, engine, trials, placement, patterns, keys, saved), `preview/subitising/main.tsx`, plus the Training save path `shared/training/save.ts`, `supabase/functions/training`, `supabase/migrations/20261018002200_training.sql`, `20261022000300_training_first.sql`, `20261104000300_training_keep_quick_settings.sql`, `20261107000100_foundational_teacher_views.sql`.

## How it works

A child sees a picture (dots, dice, a five-frame, a ten-frame) for about one second. It disappears and five number buttons unlock a second later. They tap how many they saw. After the tap the same picture comes back with the answer and the groups ("Yes! 5: 3 and 2."). A round is 12 pictures. A new child first sees one demo picture that stays on screen, then a 6-picture "quick check" that places them at a starting stage. Later stages ask the opposite question, "How many empty squares?", on five- and ten-frames. After two wrong in a row, or taking more than 4 seconds to answer, the next picture stays on screen with the groups outlined in colour. Progress shows as a garden of seven plants. A tick box turns flashing off.

## The maths

Seven stages, defined in `shared/subitising/config.ts:44-52`:

| Stage | Name | Pictures | Numbers | Flash (ms) |
|---|---|---|---|---|
| 1 | A few dots | line, cluster, slanted | 1 to 3 | 1200 / 800 |
| 2 | Ten-frame to 5 | counters on top row | 1 to 5 | 1200 / 800 |
| 3 | Dice and dots | dice, turned dice, dice-like dots | 4 to 5 | 1000 / 1000 |
| 4 | Five-frames | five-frame, five plus more, two colours | 3 to 7 | 1000 / 600 |
| 5 | Ten-frame to 10 | rows, pairs | 5 to 10 | 1000 / 800 |
| 6 | Empty squares | five-frame, ten-frame, pairs; answer 1 to 7 | | 1000 / 800 |
| 7 | Mix it up | scattered ten-frame; half counting, half empty squares | 5 to 10 | 1000 / 800 |

- Choosing the next stage: a stage is finished when 7 of the last 8 counted answers are right (85%, `config.ts:56-57`) and every picture type has been seen twice in the last 24 (`engine.ts:43-53`). Progress is rebuilt from the answers each time (`engine.ts:61-91`). A finished stage stays finished.
- Starting stage: 3 tests of 2 pictures, a binary search over the stages, first test at stage 4; both right passes (`placement.ts:25-37`). Stages below the start count as finished.
- Review: once any stage is finished, 20% of pictures come from finished stages (`trials.ts:59-62`).
- Step back: under 60% right over the last 5 in the stage gives smaller numbers and the first picture type only (`engine.ts:89`, `trials.ts:64,83`).
- Flash gets shorter after a good run: stage 4 goes 1000 to 600 ms (`engine.ts:101-106`).
- Answer buttons are five whole numbers in a row, with the right one at a random spot (`trials.ts:43-56`). They are locked for 1 s after the picture goes (`config.ts:70`).
- Help: struggle = 2 wrong in a row, or over 4 s thinking (`engine.ts:94-98`). The next picture then stays on screen with groups drawn (`FlashRunner.tsx:178-187`). Help answers are saved under `subh:`/`gaph:` keys and do not count towards a stage (`keys.ts:30`, `engine.ts:72-73`).

## Scores

**1. Maths fidelity: 3.**
- Seen: the flash with a hidden picture makes the child look and recognise, not count. The maths action is the game (`FlashRunner.tsx:76-108`). Pictures are right: the dots and frames matched what I counted in the SVG.
- Seen: guessing is not free of value. Five buttons in a row means a fixed guess hits about one in five. On stage 1 (answers 1 to 3 of 1 to 5) one fixed button hits about 1 in 3. Mastery needs 7 of 8, so a tapper cannot pass a stage, but can pass 2 or 3 of 12 pictures.
- Code: "Keep the picture on the screen" lets the child count one by one (`SubitisingApp.tsx:172`). It is saved as practice only, so honest but it turns the skill into counting.
- Loophole: no cost to a wrong tap, so tapping the same button every time is cheap. Wrong choices are never built from real misconceptions.

**2. Clarity: 3.**
- Seen: a new child gets a demo picture that stays on screen first, which works well. The prompt is written text; the voice is OFF by default and the toggle is on the home screen and in play (`FlashRunner.tsx:266-271`). A pre-reader must find and tick "Read the words out loud to me".
- Seen: one thing on screen at a time, big buttons, no clock (`config.ts:66-70`). Buttons are locked grey for 1 s after the flash, which a child could take as broken.
- Seen: "Finish for now" and the read-aloud toggle sit under every picture, and the garden scene behind is calm.

**3. Support and structure: 3.**
- Seen: help arrives by itself after 2 wrong or a slow answer: groups are outlined in two colours and the heading says "Can you see smaller groups?" (`FlashRunner.tsx:178-187`, `PictureSvg.tsx:77`). "Peek again" is offered after a help picture (seen: `peek=true`).
- Seen: a demo before the first check only. No demo when a new stage first appears (stage 6 "empty squares" has only a small square icon and words). Model (ten-frame, five-frame) is the picture itself.
- Seen: the help picture is a new picture, not the one the child failed.

**4. Fading: 3.**
- Code: the flash gets shorter with success (`engine.ts:101-106`); help picture returns after struggle, and its `recent` is reset after a help answer (`FlashRunner.tsx:117-120`). So both fade and return exist.
- But the steps are two (1000 ms vs 600 to 800 ms) and groups never fade gradually (help is all or nothing). Stage 3's two times are the same (1000/1000). The step-back also only changes numbers and type. Not stepwise per skill.

**5. Progression: 4.**
- Code: research-ordered stages (dots to 3, ten-frame to 5, dice, five-frame, ten-frame to 10, gaps, mixed) (`config.ts:45-51`). Placement (`placement.ts`), mastery (`engine.ts:43-53`), step-back (`engine.ts:89`), 20% review (`trials.ts:59-62`), mixed stage 7.
- Seen: after the check, the garden showed stage 1 "In flower" without the child ever finishing it (stages below the start count as finished: `engine.ts:67`).
- Weakness: placement is only 2 pictures per test and a lucky guess (1 in 5) can move a child up two stages. Within a stage the range does not adapt toward 75 to 90%, only step-back at below 60%. I give 4 because items 13, 15 and 16 are clearly met and 14 partly.

**6. Feedback: 3.**
- Seen: a wrong answer says "Let me show you again. It was 5: 3 and 2." with the same picture, groups outlined (`voiceLines.ts:33-36`, class `sb-picture-help`). Gap feedback: "Not quite. 3 counters and 7 empty squares make 10." with dashed ghost counters (seen). Tone is kind.
- But the child is told the answer straight away and cannot try again on the same picture. They tap Next. No "why" that matches a particular wrong choice (item 17 only partly, 18 no).
- Praise is "Yes!" and "Nice looking!" only; no strategy praise.
- Small bug: the screen-reader label reads "1 counters and 4 empty".

**7. Progress recording: 3.**
- Code: every answer is saved as a Training answer: key `sub:<type>-<n>` or `gap:<type>-<n>`, given, correct (marked on the server), ms, day, time, seed (`saving.ts:13-21`, `training_answers`). Help answers go under `subh:`/`gaph:`. So the wrong number chosen IS saved (`given`), and help is saved.
- Code: settings (starting stage, stages finished, keep-picture) ride in `training_students.typing.q` (`saved.ts:35`).
- Teacher sees: stage, stages finished of 7, recent % right, keep-picture on/off on the pupil page (`StudentPage.tsx:193-235`), and a Today alert/flag. No view of wrong answers, picture types, or help rate. Not a 4.

**8. Engagement: 3.**
- Fun is mostly the quick look itself, the ladybird friend, and the garden that grows (`growth()`, `engine.ts:109-113`). No timer or speed score, which is kind.
- Choices are tiny: read aloud and keep-picture tick boxes, nothing else. Growth is shown, so the child has a visible goal. Garden grows on rightness, not tapping, because help answers do not count. A teacher can ask "how did you see it?" naturally.

## The 25-item checklist

| # | Item | Result |
|---|---|---|
| 1 | Maths is the game | Yes: flash and tap |
| 2 | Cannot win by guessing | Partly: mastery needs 7 of 8 but 1 in 5 hits; no cost |
| 3 | Representation right | Yes: dot patterns, frames, groups |
| 4 | Pre-reader can start alone | Partly: demo good; voice off by default |
| 5 | One thing at a time | Yes |
| 6 | Big targets, no timer, short | Yes: 12 pictures, 1 s lock |
| 7 | A model available | Yes: frames always, groups in help |
| 8 | Help automatic | Yes: 2 wrong or 4 s |
| 9 | Worked example for new type | Partly: one demo only, none for empty squares |
| 10 | Support reduced stepwise | Partly: flash shortens, groups all or nothing |
| 11 | Support returns on failing | Yes |
| 12 | Expert not slowed | Partly: help only on struggle; locked 1 s every picture |
| 13 | Research order | Yes |
| 14 | Adapts toward 75 to 90% | Partly: stage mastery plus step-back |
| 15 | Spacing and mixing | Yes: 20% review, stage 7 |
| 16 | Mastery to move up | Yes: 7 of 8 and every type seen |
| 17 | Shows what went wrong, same model | Partly: reveal with groups, not tied to the choice |
| 18 | Another go with help | Partly: next picture is helped, not the same one |
| 19 | Kind praise about effort | Partly: kind, but "Yes!" only |
| 20 | Per skill saved | Yes: key per picture type, correct, help, ms, day |
| 21 | Wrong answer saved | Yes: `given` |
| 22 | Teacher sees who is stuck | Partly: stage and recent %, no type view |
| 23 | Rewards decorate success | Yes |
| 24 | Real choices, visible growth | Partly: garden yes, few choices |
| 25 | Clear goal and thinking | Yes |

## Problems found (worst for learning first)

1. **Wrong answer then the answer, no retry.** Steps: play any picture, tap a wrong number. The picture and answer are shown at once, then Next. The child never has another go on the same picture; the "help" picture is a different one.
2. **Placement can be lucky and gives free stages.** Steps: tap the check (6 pictures). Two lucky guesses pass a stage; everything below shows "In flower" (seen after my check: stage 1 in flower, stage 2 sprouting) though stage 1 was never played. A child placed too high meets hard pictures with no review path except stepping back.
3. **Guessing is cheap.** Always tapping the same button: no cost, 20 to 33% hit. The 7 of 8 rule stops a stage being passed but a child who guesses never gets a "not yet" message beyond "Let me show you again".
4. **Voice off by default.** A 5 year old who cannot read "How many did you see?" gets no voice until a tick box is found. Peek button and help heading are text.
5. **No demo for empty squares (stage 6).** Heading "How many empty squares?" with a tiny square icon; the question flips from "dots" to "gaps" with no worked example.
6. **Slow thinking counts as struggling.** More than 4 s after the buttons unlock triggers a help picture (`config.ts:68`). Careful 5 year olds who are counting will be helped without needing it. (I saw help appear after slow clicks in my test harness.)
7. **Guided mode turns subitising into counting**, and nothing nudges the child off it (the garden says "your plants are waiting").
8. Minor: aria label "1 counters"; buttons grey and locked for 1 s every picture can look broken; stage 3 flash times are identical (1000/1000).

## Saved per child on the server

- Table `public.training_answers`: `player`, `batch_id`, `seed`, `fact_key` (`sub:ten-8`, `gap:five-3`, helped versions `subh:`/`gaph:`), `given`, `correct` (marked on the server from the key, `shared/training/save.ts:23`), `answer_ms` (thinking time, 0 when picture stayed), `typing_ms` (0), `day`, `answered_at`. Table `training_students`: `sessions_done`, `typing` JSON with `q` = `{p placed, s start stage, f stages finished, g keep-picture, v 2}`. Table for whole rounds: `training_sessions` rows with kind `quick` (counts for Training before games).
- Wrong choice: saved (`given`). Help: saved as `subh`/`gaph` key. Level: only the stage numbers in the key and settings; the flash time is not saved.
- Teacher today: pupil page panel (working on, stages finished, recent % right, keep-picture); class flags and Today alert via `teacher_quick_looks_class` (`20261107000100...sql:89-130`); skill-map cells. Not shown: which types or numbers are wrong, wrong choices, help rate, how many help pictures.

Read-only queries (not run):

```sql
-- 1. Stage / picture types played and their error rates
select split_part(fact_key, ':', 1) as kind, split_part(split_part(fact_key, ':', 2), '-', 1) as picture,
       count(*) as tries, round(100.0 * avg((not correct)::int), 1) as wrong_pct
from public.training_answers
where fact_key ~ '^(sub|gap)h?:'
group by 1, 2 order by wrong_pct desc;

-- 2. Pupils with the most wrong in the last 14 days, and how many were help pictures
select p.display_name, count(*) filter (where not a.correct) as wrong, count(*) as tries,
       count(*) filter (where a.fact_key ~ '^(subh|gaph):') as help_pictures
from public.training_answers a join public.profiles p on p.id = a.player
where a.fact_key ~ '^(sub|gap)h?:' and a.answered_at > now() - interval '14 days'
group by 1 having count(*) >= 20 order by wrong::float / count(*) desc limit 20;

-- 3. Stages reached (from the saved settings) and pupils stuck at one
select (s.typing -> 'q' ->> 'f')::int as stages_finished, count(*) as pupils
from public.training_students s where s.typing ? 'q' group by 1 order by 1;
```

## Strengths

- Real subitising mechanic with sound picture types and a research-based stage order.
- Mastery, placement, step-back and review all work from replaying saved answers, so they are testable.
- Kind tone, no clock, no red, 12-picture rounds.
- Wrong choices and help are saved; helped answers are kept out of mastery.
- Same picture shown again with groups after a miss.

## Gaps

- No retry on the same picture; wrong choices are plain consecutive numbers with no misconception.
- Voice is off by default and prompts are text.
- No demo for new kinds (empty squares, mixed).
- Help is all or nothing; no gradual fading of group outlines.
- Teacher view shows stage and a percentage only.
- Shared kit parts not used.

## Candidate improvements

1. **Voice on by default for under-8s.** Problem: pre-readers need the voice. Change: default read-aloud on (clips exist). Files: `src/speech`, `SubitisingApp.tsx`. S. Impact: high for clarity.
2. **Try again on the same picture.** Problem: the answer is simply shown. Change: after a first wrong tap, grey that button, outline groups on the same picture, ask again ("Now you try"); second wrong shows the answer. Files: `FlashRunner.tsx`, saving keys. M. Impact: high.
3. **Misconception choices.** Problem: choices are 5 in a row. Change: use `shared/kit/mistakes.ts` with kinds (one off, counted part only, forgot second group), and save the kind. Files: `trials.ts`, `saving.ts`. M. Impact: high for teacher and feedback.
4. **Teacher panel by picture type.** Problem: only stage and %. Change: show per type error rate, common wrong answers, help count; use query 1 above as an RPC. Files: new migration, `StudentPage.tsx`. M. Impact: medium to high.
5. **Gentler placement.** Problem: 2 pictures per test, free in-flower stages. Change: more pictures or a quick retest after the first mistakes at the new stage; mark skipped stages as "skipped" not flowers. Files: `placement.ts`, `Garden.tsx`. S/M. Impact: medium.
6. **Demo on first sight of empty squares and mixed.** Change: first picture of stage 6 and 7 stays with a spoken example. Files: `FlashRunner.tsx`, `voiceLines.ts`. S. Impact: medium.
7. **Gradual help fade.** Change: three help levels (groups drawn, groups hinted, none) following `shared/kit/help.ts`. Files: `engine.ts`, `PictureSvg.tsx`. M. Impact: medium.
8. **Fairer thinking time.** Change: raise the 4 s limit or use it only for 2 slow in a row for under-8s. Files: `config.ts`. S. Impact: small to medium.

## Learning-design rules

(`docs/LEARNING-DESIGN.md` read after scoring; checked against the code.)

| Rule | Result | Evidence |
|---|---|---|
| 1. Maths is the move | Met | Flash and tap IS subitising; 7 of 8 mastery. Guessing 1 in 5 hits, guided mode allows counting (`SubitisingApp.tsx:172`) |
| 2. One thing at a time, voice first | Partly | One question; voice clips exist but off by default (`useReadAloud`, `FlashRunner.tsx:162`) |
| 3. Concrete, then picture, then number | Partly | Dots, then frames, then gaps; always pictures, no concrete bridge to number-only |
| 4. Help arrives by itself | Met | 2 wrong or 4 s gives groups (`engine.ts:94-98`); demo once, none for new stages |
| 5. Help follows the child | Partly | Returns on struggle, flash shortens with success; no stepped fade or teacher setting (`shared/kit/help.ts` unused) |
| 6. Progression | Met | Placement, mastery, step-back, review (`engine.ts`, `trials.ts`, `placement.ts`); no "what's next" shown to child |
| 7. Mistakes teach | Partly | Answer and groups shown on the same picture; no tap-1 "why", no "Now you try", choices not misconceptions |
| 8. Fair timing | Partly | No answer clock, 1 s lock; 4 s "slow" triggers help for young children |
| 9. Record evidence | Partly | `given`, helped key, ms, day saved; teacher sees only stage and % |
| 10. Fun from the maths | Met | Garden grows on counted right answers only |

Shared game kit (`docs/plans/GAME-KIT-PLAN.md`): code in `src/subitising`, `shared/subitising` does not import anything from `shared/kit/`. Quick looks has its own parallel versions: its own help trigger (not `STRUGGLE_GOES` / `helpForFact`), its own read-aloud (`../speech` and its own `voiceLines`, with recorded clips, which is the kit's voice-list idea), its own garden. It could use: `shared/kit/help.ts` (stepped fade and the teacher's fade/always/off setting), `shared/kit/mistakes.ts` (misconception choices and the two-tap flow), `shared/kit/teacherGrid.ts` and `replay.ts` (per-type teacher view, server replay of rounds), and `dayArc.ts` for the day's reward.
