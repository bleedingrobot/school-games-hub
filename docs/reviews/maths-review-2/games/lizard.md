# Lizard's Bundles: second review (8 Nov 2026)

**Marking basis: played in the browser (built preview on port 5310, own tab, desktop and a 375px phone width) plus all code read.** Evidence is marked "seen" (play) or "code". Play was driven by scripted clicks on the real buttons, with screenshots at the key moments. I did not hear the audio (no sound check). I changed no game code and made no commit. First pass was code only; this pass corrects it.

Blind rule kept: I did not read the first review, its scores, or any R*.md plan.

## How it works

The child helps Lizard tie sticks into bundles of ten (and ten bundles into a raft of a hundred). One challenge a day is ten goes. A go is one of five kinds: **Build** a number on a mat with + and − buttons for sticks, bundles and rafts, then press "That's it"; **Bundle** (tie loose sticks into bundles with a "Tie ten" button); **Swap** (untie one bundle into ten sticks); **Read** a picture of bundles and sticks and tap one of four number cards; **More/less** (ten or a hundred more or less, four cards). Bella reads each question, there is a Hear it again button and a Voice off button. The first finish of each NZ day turns one of ten den bundles from twine to bronze, silver, gold; 30 days gives a Golden Raft, then a new friend's den. A wrong try shows a one-line "why", a second wrong try opens "Let's look together" (a labelled model) then "Now you try". The server makes and marks every round from the saved taps.

## The maths

Seven steps (`shared/lizard/round.ts:30-38`, keys per step at `:48-56`, pool for step 7 at `:61`):

| Step | Name | Goes |
|---|---|---|
| 1 | Bundles of ten | Build tens only, 10 to 50 (5 keys, each asked twice, `:184-186`) |
| 2 | Tens and ones to 50 | Build and Read, 11 to 50 |
| 3 | To 100, and zero | Build and Read above 50, plus Read of empty-ones-place numbers (`pvzero`) |
| 4 | Tie and untie | Bundle (`pvregroup:b`, 23 sticks etc.) and Swap (`pvregroup:s`, 47 is 3 tens and 17 ones) |
| 5 | Ten more, ten less | `pvten:+/-`, four cards |
| 6 | Hundreds | Build and Read of rafts to 999, zeros in the middle |
| 7 | All mixed | `pvhun` (a hundred more/less) plus step 6 keys |

Choosing the next level: only the day's first finish moves anything (`shared/lizard/server.ts:156`). `placeAfter` (`round.ts:94-99`) uses the kit rule (`shared/kit/help.ts`): 8 or more right of 10 at first tap (GOOD, `config.ts:15`) is good; two good at a step passes it (`GOOD_TO_PASS`, `config.ts:19`); two good in a row drop help one level; 4 or fewer (HARD, `config.ts:17`) raise help one; a new step raises help two; hundreds start at help 3 at least (`config.ts:27`). A step never drops back. Inside a round: step 1 is the five tens repeated; from step 2, 7 goes are today's step (weakest Leitner box first) and 3 are review from earlier steps (`round.ts:188-191`). A child with Tūī's "ten and" facts secure starts at step 2 or 3 (`round.ts:102-107`, `config.ts:31-35`). Wrong cards are named slips (reverse, face value, zero, ignore, ones, way, join, near) built at `round.ts:237-262`.

## What I saw in play (8 Nov 2026)

- **First go, no adult (seen):** Home shows Lizard, ten twine bundles, "Day 1 of 30", Step 1 and a big Play button. Go 1 is "Make 10 with bundles and sticks": only a stick +/- and "Tie ten" / "That's it" (bundle +/- hidden). A pointing hand sits on the stick +. Ten stick taps, "Tie ten" (it lights up), "That's it". Works, but ten taps is slow for a 5 year old. Buttons 52px (+/-), 64px high (Tie/That's it), Hear it again 56px: fine.
- **Right answers (seen):** Step 1 is ten Build goes on 10 to 50 (30, 20, 50, 40, 20, 30, 10 ...): same task ten times in a row, repeats of the same numbers. Two perfect days passed step 1; the finish screen said "Next time: tens and ones to 50" and the home page then showed Step 2. The finish screen never says how many were right.
- **Wrong 1, 2, 3 on a Build go (seen):** wrong 1: "Not quite. Count your bundles, then your sticks." with a thinking emoji, and the mat empties to 0. It does not say what the child made. Wrong 2: "Let's look together" shows the target mat (4 bundles, 0 ones) with its counts, which is the answer; about 8 seconds, then "Now you try". Wrong 3 (in the redo): nothing is said, the mat just empties again.
- **Wrong 1, 2, 3 on a Read go (seen):** "1 ten and 5 ones": tapped 6 -> "Count the tens as tens, not as ones." (the right slip line); tapped 51 -> "Let's look together", all cards greyed during the look; then "Now you try"; tapped 105 -> cards cut to two (6 and 15). So any card go ends in at most 4 taps.
- **Random tapper (seen):** Cards: tap in order and it ends in 4 taps, 1 in 2 on the last. Build: I pressed + bundle once, then twice, three, four, five times with "That's it" each time on "Make 50": it went wrong, wrong, redo, redo, then right on 5 bundles. No maths needed, no limit on tries, but the go is marked wrong and the level logic sees it. Also "Add a bundle" means tying is never needed after go 1 (seen: Build 40 done with 4 bundle taps).
- **Other kinds (seen):** Bundle and Swap goals work. Swap: "Untie one bundle. Then you have ten more sticks." with a lit Untie one button, then "That's it": it never asks for a count, just do the action; untying twice and "That's it" gives "Untie one bundle. Then count the sticks." and resets. Hundreds (step 6 at help 3): bundles and rafts drawn with no labels, "5 hundreds, 7 tens and 2 ones" read aloud, cards 527/572/575/582 (527 is the reversal). Rafts look like wide bundles and are small, so hundreds vs tens is hard to tell by picture alone. Build 200 shows three columns with - + each; fine.
- **New bug (seen):** the raft tip "Ten bundles tied together make a raft: a hundred." pops up on a Swap go with 2 tens and 9 ones (step 4, no raft anywhere), because the test looks at the stored answer (`Goes.tsx:178`, answer is bundles x 100 + sticks for bundle/swap goes). It shows again each time until the child presses Got it.
- **Phone width (seen):** at 375 wide the read go fits: question, mat, four cards wrapping to two rows, cards about 70px. Preview-tool button overlaps the progress dots (preview only).
- **Difficulty moving (seen):** the preview's step/help buttons set a place; two good days passed step 1 (seen); help fade and hard-day return not played (code only).

## Scores (played, then corrected)

**1. Maths fidelity: 3** (unchanged by play; the Build loophole was seen to work, so this is a firm 3, not 4)
- Bundling and place value is the action, not a quiz (Goes.tsx:332-340, round.ts:271-281): code read. Representations are correct (bundle = 10 sticks, raft = 10 bundles, `Goes.tsx:269-271`): code read.
- Loophole: Build, Bundle and Swap have no limit on wrong tries. A child can press + once, "That's it", + again, "That's it" until it is right (`Goes.tsx:258`, `sendable` at `:281`). After two wrong tries the "Let's look" model shows what the answer is made of (`targetMat`, `:58-61`), then "Now you try" lets them copy it. Costs: the go is recorded wrong, but no maths is needed to finish. Code read.
- Build go: the child can press "+ bundle" four times instead of tying; tying ten sticks is only required in the guided first go (`withBundles: !(guided && at === 0)`, `:326`). So the "ten ones become one ten" action is optional after go 1. Code read.
- Card goes: 1 in 4 by luck, and after 3 wrong taps only 2 cards are left (`round.ts:327-330`), so tapping everything finishes any card go in at most 3 taps. Code read.
- Swap is almost unguessable-free but also trivial: one lit button ("Untie one") then "That's it" (`:339`).

**2. Clarity: 3** (unchanged: seen that the first go is understandable with the hand and voice line text, controls large, phone width fine; but ten stick taps, the tip bug and no sound check keep it at 3)
- Voice reads every question, replay button, voice toggle, no timer, ten pips for progress (`Goes.tsx:288-294`, `LizardGame.tsx:127-131`): code read. 310 recorded voice clips exist in `public/voice/lizard`.
- Guided first go: a pointing hand on the stick button and the bundle +/- hidden (`Goes.tsx:277,326`): code read.
- Concerns not checkable without playing: mat with 3 columns, + and − per column, a Peek button, tie buttons and a "That's it" button on one screen; button sizes and the ones ten-frame on narrow phones. The plan's guide ("Show me" next-step line, Lots/Some/Off replay) is not in the code (no match for "Replay the guide"). First-time tip only for rafts (`:178-186`).

**3. Support and structure: 3**
- Models are present by default at help 5 (labelled mat, counts, ten-frame for ones, `Goes.tsx:78-90, 92-119`): code read.
- Help after mistakes is automatic (ShowWhy, then LookTogether, `Goes.tsx:243-245, 351-365`): code read.
- Worked example for new kinds: only the guided first go (tie ten) and the raft tip. A first Swap, first Bundle or first "ten more" has no demonstration, only the question line (`voiceLines.ts:31-37`). That is why it is not a 4.

**4. Fading: 3**
- Six levels of picture help (`round.ts:306-331`), shown level follows the child's saved level (`round.ts:115,196`). Fades by steps with success, returns after a hard challenge, two up on a new step, wrong tap raises help for that go: code read.
- Why not 4: help is one level for the whole child across all kinds of go (not per skill/key); it moves only once a day (`server.ts:156`) so 5 to 0 takes at least 10 days of play; the within-round "three first tries wrong in a row, full help for the rest of the round" is defined (`config.ts:38 STRUGGLE_GOES`) but never used in `Goes.tsx` or `round.ts` (code read). Expertise reversal is handled only by the slow fade and the teacher's Off setting.

**5. Progression: 4**
- Research order: bundles of tens, tens and ones, zero, regroup, ten more/less, hundreds, mixed (`round.ts:30-38`): code read.
- Adapts per child: start place from Tūī records, step and help per child, weakest keys first (`round.ts:149-153, 188`); good/hard bands of 8 and 4 of 10 roughly aim at 75 to 90% (`config.ts:15-17`): code read.
- Mastery: two good challenges at a step to pass, never one lucky go (`config.ts:19`). Spaced review: 3 of 10 goes from earlier steps, step 7 mixes (`config.ts:10`, `round.ts:189`). Slight worry: step 6 jumps to 3 digits with one tip.

**6. Feedback: 3** (confirmed in play: emoji picture, mat emptied on a wrong try, no count of what was built, wrong 3 in the redo is silent)
- A wrong card gets a one-line named-slip reason (`voiceLines.ts:44-53`) and a picture that is a thinking emoji, not the child's own wrong number built on the mat (`Goes.tsx:352`; the plan wanted "74 becomes 7 bundles and 4 sticks"). So the reason is not shown on the same model: code read.
- On a wrong Build/Bundle/Swap the mat is reset to the start (`Goes.tsx:240 setMat(go.from)`), wiping the child's attempt rather than building on it.
- Second wrong tap: Let's look together with the labelled model, then "Now you try" (`Goes.tsx:243-244, 358, 365`): good, another go with help. Praise is "Yes! That is it." / "Well done!" (`words.ts:42`), not about strategy; tone never shames. 

**7. Progress recording: 3**
- Per key facts saved through `recordMathsAnswers` to `gem_keep_facts` (correct, attempts, Leitner box, time) once per key per round (`play.ts:58-61`, `entry.ts:74`): code read.
- The full round (every go's key, kind and help level `l`) and every tap (the actual number picked or built) are kept in `lizard_rounds` (`migration:40-53`), so wrong choices and help level are saved; slips are worked out on the teacher page (`shared/lizard/teacher.ts`).
- Teacher view is only the per-pupil panel and the Games table line (players and Golden Rafts); nothing in the class grid or Today alerts (grep of `shared/kit/teacherGrid.ts` and teacher pages finds no lizard). Help level and wrong answers are not in the fact row itself.

**8. Engagement: 3**
- Fun comes mostly from the build/tie/untie action; the den and Golden Raft are decoration on a counted-days arc, no points, no ranking: code read.
- Real choices are few (no choice of kind or step). Clear goal (30 days) and visible growth (den, step line). A teacher could ask "how did you know?" on the bundle goes. Marked "In development" on the home card.

## The 25-item checklist

| # | Item | Result |
|---|---|---|
| 1 | Maths action is the game | Yes (bundling mat), though tying is optional after go 1 |
| 2 | Cannot win by guessing/tapping all | Partly: cards finish in at most 3 taps; build can be brute-forced |
| 3 | Representation right | Yes: bundles, rafts, ten-frame for ones |
| 4 | Pre-reader can start alone | Partly: hand and question on go 1 (seen); ten taps; sound not checked |
| 5 | One question, one action | Partly: mat, three buttons on one screen; raft tip appears on the wrong go (seen) |
| 6 | Big targets, no timer, short | Yes: buttons 52 to 70px, no timer, 10 goes (seen) |
| 7 | Model for new skill | Yes: help 5 labelled mat |
| 8 | Help automatic after mistakes | Yes: why line, then Look together |
| 9 | Worked example first time | Partly: guided first go and raft tip only |
| 10 | Support reduced step by step | Yes: six levels |
| 11 | Support returns on failing | Partly: per challenge and per go; in-round struggle rule not used |
| 12 | Expert not slowed | Partly: slow fade (days), teacher Off |
| 13 | Research order | Yes |
| 14 | Adapts per child to 75 to 90% | Partly: bands 8/4 of 10, once a day |
| 15 | Old skills return, mixed | Yes: 3 of 10 review, step 7 mixed |
| 16 | Move up needs steady success | Yes: two good challenges |
| 17 | Mistake shown on same model | Partly: emoji picture, mat reset, model only on second wrong |
| 18 | Another go with help | Yes |
| 19 | Praise about effort, not shaming | Partly: kind, but generic "Well done" |
| 20 | Server saves attempts, level, help, time, date | Partly: facts hold attempts/time; level/help only inside round JSON |
| 21 | Wrong answer chosen saved | Yes: taps in `lizard_rounds` |
| 22 | Teacher sees stuck/not played | Partly: per pupil only, no grid or alerts |
| 23 | Fun from the maths | Yes |
| 24 | Real choices, visible growth, kind social | Partly: growth yes, choice little, no social |
| 25 | Clear goal, active thinking | Yes |

## Problems found (worst first for learning)

1. **Build, Bundle and Swap can be brute-forced with no cap (seen).** Steps: Build 47, press + stick once, "That's it", repeat. Each wrong try only says "Not quite. Count your bundles, then your sticks." (`voiceLines.ts:39`). After two wrongs the model is shown and copied. Costs only a wrong mark on that fact.
2. **Wrong mat attempt is erased** (seen; `Goes.tsx:240`), so the child cannot see what they built versus the target; the why picture is an emoji (`:352`).
3. **Tying is skipped:** "+ bundle" buttons build tens directly from go 2 (`:326`), so the key idea (ten ones become one ten) is not forced after the guided go.
4. **Random tapper on cards:** four cards, at most 3 taps to finish any read or more/less go; the first-try mark and level rise catch it, but it needs no maths to finish.
5. **No demonstration of new kinds** (Swap, Bundle, ten more) and no "Show me" next-step line or help-setting replay, despite the plan.
6. **In-round struggle rule unused:** `STRUGGLE_GOES` (`config.ts:38`) has no user. A child failing three goes in a row keeps the same help for the round.
7. Help moves only once a day, so a stuck child is stuck at the same help for a day at a time.
8. **Raft tip shows on a Swap go with no raft (seen):** play step 4, wait for an "Untie one bundle" go.
9. **Step 1 is the same go ten times** (build tens only, 10 to 50), and the finish screen shows no result of how many were right (seen).
10. **Rafts are drawn like small bundles** so tens and hundreds look alike at help 3 (seen).
11. Teacher: no class grid or Today alert (stuck or inactive pupils must be opened one by one).

## Saved per child on the server

- `lizard_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at): `migration:28-38`.
- `lizard_rounds` (player, seed, round jsonb with each go's key/kind/help level `l`, open, taps jsonb of `{pick, ms}`, mistakes, first_right, started_at, finished_at): `:40-53`. Wrong choice and help level are saved here, not as columns.
- `gem_keep_facts` rows, pack `early-facts`, key family `pvbuild`, `pvread`, `pvzero`, `pvregroup`, `pvten`, `pvbuild3`, `pvread3`, `pvhun` (attempts, correct, box, time).
- Teacher sees today: Games table line (players, Golden Rafts, `teacher_lizard_class`), pupil page line and panel (days, step, help level, last played, five hardest keys, most common slip from the last 3 rounds, `teacher_lizard_student`). Not in class grid or Today alerts. Achievements: first bundle, tidy den, tens and ones, hundred raft, golden raft.

Read-only SQL for James (not run):

```sql
-- Where pupils are: step and help level
select step, level, count(*) from lizard_progress group by 1,2 order by 1,2;

-- Error rate by key family (early-facts pack, lizard keys)
select split_part(fact_key, ':', 1) as family, sum(attempts) att, sum(correct) ok,
       round(100.0 * (sum(attempts) - sum(correct)) / nullif(sum(attempts), 0), 1) pct_wrong
from gem_keep_facts
where pack = 'early-facts' and fact_key ~ '^(pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun):'
group by 1 order by pct_wrong desc;

-- Possibly stuck: on the same step for 10+ rounds, ordered by rounds
select p.player, p.step, p.level, p.days_done, count(r.*) rounds
from lizard_progress p join lizard_rounds r on r.player = p.player and not r.open
group by 1,2,3,4 having count(r.*) >= 10 and p.level >= 4 order by rounds desc;
```

## Is it really switched on? (the "In development" sticker)

In code: yes. `LIZARD_ON = true` (`src/games/lizard/switch.ts:9`), the registry includes it when `lizardOn()` (`src/games/registry.ts:73`), and the migration adds `app_settings.lizard_enabled boolean not null default true` (`20261107001000_lizard.sql:161`) plus the `hub_games` row. The sticker comes from `inDevelopment: true` (`src/games/lizard/index.tsx:41`), shown by `src/components/GameCard.tsx:93`; it is a label only and does not hide or gate the game. Whether the migration and function are applied on the live database I cannot see from code.

## Strengths

- Real manipulative: bundles, rafts and untie/tie are the maths action.
- Wrong cards are named place-value slips, saved as taps, so slips are readable by the teacher.
- Six-level help ladder with teacher Fades/Always/Off, start place from Tūī records.
- Spaced review and mixed final step; server replays every tap.
- Uses a lot of the shared kit and has 310 voice clips.

## Gaps

- Build/Bundle/Swap loophole and reset of the child's mat.
- Tying optional after go 1.
- No demonstrations for new kinds; no guide replay or "Show me".
- Help is one level per child and moves once a day; in-round struggle rule unused.
- No class grid or Today alerts; help level not in the fact rows.
- Sound not checked.

## Candidate improvements

1. **Cap tries on Build/Bundle/Swap.** Problem: unlimited brute force. Change: after 2 wrong "That's it" presses show the look-together model then redo (already exists); also lock "That's it" for 2 seconds after a wrong try and say the count ("You made 46"). Files: `src/games/lizard/Goes.tsx`, `voiceLines.ts`. Effort S. Impact: medium.
2. **Show the child's own wrong picture.** Problem: emoji why picture, mat reset. Change: keep the attempt on the mat (greyed) next to the target in ShowWhy; for cards build the tapped number as bundles and sticks. Files: `Goes.tsx`, `art.tsx`. Effort M. Impact: high.
3. **Make tying the action.** Change: remove "+ bundle" on Build for steps 1 to 3 so tens come from tying ten sticks, keep it for hundreds. Files: `Goes.tsx:326`. Effort S. Impact: high.
4. **Demonstrate each new kind once.** Change: FirstTimeTip with a short worked go for Swap, Bundle, ten more and raft, remembered per device. Files: `Goes.tsx`, `words.ts`, voice clips. Effort M. Impact: medium-high.
5. **Use STRUGGLE_GOES.** Change: three first-try misses in a row set the rest of the round to help 5. Files: `Goes.tsx`, `round.ts`. Effort S. Impact: medium.
6. **Faster, per-kind help.** Change: let help level move per key family from fact boxes so a child strong at reading but weak at swapping gets help only for swap. Files: `shared/lizard/round.ts`, `server.ts`. Effort L. Impact: medium.
7. **Teacher class grid and Today alert.** Change: register lizard in the kit teacher grid and flag pupils at help 4 or 5 for 8 or more rounds. Files: `shared/kit/teacherGrid.ts`, teacher page. Effort M. Impact: medium (teacher time).
8. **Save help level with each answer.** Change: add `help` to the answer record or a view over `lizard_rounds` so queries need no JSON. Files: migration, `entry.ts`. Effort S. Impact: low-medium.

## Learning-design rules (read after scoring; evidence from code)

| Rule | Status | Evidence |
|---|---|---|
| 1 The maths is the move | Partly met | Bundling mat; but brute force of mat goes and optional tying |
| 2 One thing at a time, voice first | Partly met | Bella clips, HearAgain; busy mat screen |
| 3 Concrete, then picture, then number | Met | Levels 5 to 0, number-only with Peek (`round.ts:306-331`) |
| 4 Help arrives by itself | Partly met | Why and look-together automatic; example only for first go and rafts |
| 5 Help follows the child | Partly met | Per-challenge fade/return, teacher override; in-round struggle rule unused, once-a-day moves |
| 6 Progression | Met | Seven steps, two good to pass, review 3 of 10, what's-next line on finish (`LizardGame.tsx:204`) |
| 7 Mistakes teach | Partly met | Named slips, look then redo; emoji picture, mat reset |
| 8 Fair timing | Met | Quick clock after the voice, junior value (`Goes.tsx:174-176`, `entry.ts:74`) |
| 9 Record evidence | Partly met | Taps with picks saved, teacher slip line; no grid or alerts |
| 10 Fun from the maths | Met | No points, den is decoration on counted days |

Kit parts used: `TenFrame`, `FirstTimeTip` (rafts only), `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy`/`LookTogether`/`NowYouTry`, `WhatsNext`, `NextPartChip`, `shared/kit/mistakes`, `shared/kit/help`, `shared/kit/dayArc`, `voiceLinesSuite`, junior quick time. Not used but could be: `shared/kit/teacherGrid` (class grid), a `FirstTimeTip` for each new kind, `NumberLine` (for ten more/less, optional), `shared/kit/replay` (not confirmed either way).
