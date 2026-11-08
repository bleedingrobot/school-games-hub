# Maths review 2: final scores and decisions (8 Nov 2026)

Reader: James. Scores are 1 to 4 on the rubric in `docs/reviews/maths-review/research-design.md` ("The checklist (25 items) and rubric" to "Caveats to remember when scoring"). The go-live bar is a 3 on every line.

## 1. How the scores were set

- Twelve helpers each scored one game blind and wrote `docs/reviews/maths-review-2/games/<game>.md`. They worked separately, so they were uneven.
- The final scorer (this file) was also blind. Read: the rubric section above, and the twelve game files. Then code, to check the claims.
- Scoring was done criterion by criterion across all twelve games, not game by game, using the same test each time.
- NOT read, on purpose: `docs/reviews/fundamental-maths-review.md`; `docs/reviews/maths-review/games/*`, `DECISIONS.md`, `coverage.md`, `data-*.json`, `page/*`; `docs/plans/maths-review/R*.md`; `docs/LEARNING-DESIGN.md`; git history, PRs and memory.
- A few helpers said they opened `docs/LEARNING-DESIGN.md` (Penguin Pairs, Weka) before writing. They say it changed nothing. I did not use their scores on trust: every score below is re-argued from the rubric wording.
- No game code was changed. Nothing was committed.

**How evidence was weighted.** Play beats code, code beats plan. Where evidence is code only, it is said. Things no one could check: the recorded voice (nobody could hear it); the real server and the teacher pages in a real browser; fading across several days (every helper used the preview buttons to set the level, none earned it over days). Swamp Hen was played by script, with only a few screenshots. Parrot was played only on day 1 and 2 plus preview buttons. Hop and Penguin Pairs "faint" help was never seen on screen. Robin's "why panel below the fold" was seen by one helper in one window size and I did not re-check it.

## 2. Final table

Columns: M = Maths fidelity, C = Clarity, S = Support, F = Fading, P = Progression, Fb = Feedback, R = Progress recording, E = Engagement. "Under 3" counts the criteria below the go-live bar.

| Game | M | C | S | F | P | Fb | R | E | Total /32 | Under 3 |
|---|---|---|---|---|---|---|---|---|---|---|
| Kiwi's Beanstalk | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 23 | 1 (Progression) |
| Hop | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Penguin Pairs (Kororā) | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Pipi | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Tūī | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Weka | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Quick looks | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Pigeon | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Parrot | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Lizard | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Swamp Hen | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 0 |
| Robin | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 23 | 1 (Maths fidelity) |

No game gets a 4. A table of all 3s hides real differences, so the section "Which 3s are weak" below says where a 3 is shaky. The rubric says a clear game with honest maths, good help and kind feedback at 3 is already better than most apps.

## 3. Scores I changed from the helper drafts (9)

| Game | Criterion | From | To | Reason (rubric wording) |
|---|---|---|---|---|
| Beanstalk | Support | 4 | 3 | A 4 needs items 7, 8 and 9 all met ("model, automatic help and a demonstration for new skills"). The helper's own checklist says item 9 is "partly": the missing-leaf goes (4th, 7th, 10th) start with no introduction. The rubric's 3 says "maybe no worked example for new types", which is this. |
| Beanstalk | Progression | 3 | 2 | The rubric's 2 is "A sensible fixed order, but the same for every child; stuck children stay stuck, quick ones are bored." The sum changes only by number of Golden Eggs (30 finished days each), `targetFor(eggs)` at `shared/beanstalk/progress.ts:20`. The pairs are the same for every child. Only the dots (help) adapt, and help is the Fading criterion, not Progression. Own checklist: items 14, 15, 16 all "no". A child who gets 6+4 wrong still moves to 20 at day 30; a child who knew it on day 3 spends 27 more days on 10. The rubric's 3 needs "some adaptation" of difficulty, such as step up/down by streaks. |
| Beanstalk | Progress recording | 2 | 3 | The rubric's 2 is "Totals saved but no per-skill, per-attempt detail." Beanstalk saves per child, per bond fact: attempts, correct, time, box, last seen (`gem_keep_facts`, keys `bond10:a+b`, `bond20:a+b`; `shared/beanstalk/round.ts:94-101`), plus every tap per round, plus it appears in the teacher Foundational grid. That is the rubric's 3. Its gaps (bonds to 100 and 1000 share one key each; taps saved as leaf positions, not numbers) stop it reaching 4 but not 3. The other games with similar saving were scored 3. |
| Hop | Fading | 4 | 3 | A 4 needs items 10, 11 and 12 all met. Item 12 (a child who clearly knows it is not slowed) is only partly met: the ladder keeps a fact on full help until box 2 and two quick days (`shared/hop/round.ts:146-151`, `until: { box: 2, quickDays: 2 }`), whatever the child already knows. The fading steps were also never seen across days (code only). Weka, with the same kit function and the same kind of ladder, was scored 3 for this very reason; the same test must apply to all. |
| Penguin Pairs | Fading | 4 | 3 | Same reasons as Hop. Identical ladder at `shared/korora/round.ts:101-106`. The "faint" picture was read in code only, never seen. |
| Pipi | Fading | 4 | 3 | Same. Identical ladder at `shared/pipi/round.ts:84-89`. The helper's own draft called it "borderline", with the faint rung "code only", and checklist item 12 "partly". |
| Parrot | Fading | 4 | 3 | One help level for the whole child (all question kinds), moved once a day; own checklist item 12 "partly"; fading was never seen on screen (code and a simulation only). The rubric's 3 covers "or only for some skills". |
| Quick looks | Progression | 4 | 3 | A 4 needs items 13 to 16. The helper's own checklist has item 14 (adapts toward 75 to 90%) as "partly", and the helper said so when awarding the 4. Placement is two pictures per test and a lucky guess can place a child two stages up. Evidence is code only. Quick looks is the closest game to a 4 on this line. |
| Lizard | Progression | 4 | 3 | Same test. Item 14 "partly" in the helper's own checklist (good/hard bands of 8 and 4 out of 10, moved once a day, not a measured target rate). Evidence code only. |

Nothing was lowered below 3 except Beanstalk Progression (above) and nothing was raised except Beanstalk Recording (above). Robin Maths fidelity was already 2 and stays.

## 4. Scores I considered changing and kept

**Maths fidelity (the main question).** Under the rubric, a 3 allows "one or two loopholes". A 2 is "bolted-on quiz, or guessing often works".

- "Tap every choice finishes a go and still earns the day's reward" holds at 3. Every one of the eleven daily-challenge games has it (Quick looks does not pay a day reward for tapping, so it is the cleanest). It is one loophole, the same size in each game, and in each the first tap is the scored one, so tapping everything cannot move a child up or pass a step (the server replays the taps). It is a Feedback/Engagement problem as much as a Maths one (see patterns below). It does not push any game to 2 on its own.
- **Robin stays at 2, and is the only 2 on this line.** The size of the hole truly differs. In every card go the right answer is almost always the third of four cards: wrong cards are built as n+1, n-1, n-2 (How many) or n, n+2 and 1 (One more), then sorted (`shared/robin/round.ts:216-222`). A child who taps the third card every time is right about 95% of the time (helper's simulation 2275 of 2392; seen in play on 5 of 8 goes, the other 3 were n=1 and n=2). Marking berries is optional, so counting is never needed. Unlike the tap-all hole, this pattern passes the step gate (8 of 10 at the first tap, twice). That is "guessing often works". The Give goes (steps 1, 3, part of 6) are honest and good, which is why this is a 2 and not a 1.
- **Parrot stays at 3.** The helper said card goes are won by picking "the number not printed in the sum". Checked: the wrong cards are a+b (the biggest), and the two printed numbers (`shared/parrot/round.ts:211`, `:231`). That leaves the answer and one off-by-one card, so the tell gives 50%, not 100%. It affects only card goes (levels 3 and below). The default start is stone goes (levels 5 and 4), which cannot be done by the tell. True or false has three buttons (1 in 3). It does not pass the gate by pattern. Keep 3; fix the off-by-one-only leftover.
- **Pigeon stays at 3.** Numeral matching at full help is a representation problem that fades with help (six levels). The "near" goes with two cards are a 50% coin toss (about 5% chance of 8 of 10 on a given day). Not "guessing often works" for the step.
- **Lizard stays at 3** (not 2). Build goes can be brute-forced by adding a bundle each try, and tying ten sticks is only required in the guided first go (`withBundles: !(guided && at === 0)`, `src/games/lizard/Goes.tsx:326`). That weakens the "ten ones become one ten" idea, but the first-try mark is recorded wrong, mastery cannot be passed that way, and the representation is correct. It is the weakest 3 on this line, with Robin the only one lower. Tapping cards ends in at most 3 taps, the same hole as other games.
- **Beanstalk stays at 3.** Elimination (a tried pair is blocked, `src/games/beanstalk/Round.tsx:159`) lets a tapper find the partner in at most 4 taps, and the missing-leaf goes can leave one choice. But the go is recorded wrong and cannot pass a step.
- **Swamp Hen stays at 3.** "Share" has the child do nothing (a pile, empty lanes), "turn" cannot be answered wrongly, and after 3 wrong taps the forced answer remains. Those are weak representation points, but the counting-rows goes are honest. Watch it: if "turn" and "share" are the new ideas of the game, those goes are watched, not done. (Helper-played by script; I did not re-check these in code.)
- **Hop, Pipi, Tūī, Weka, Penguin Pairs:** tap-all only, plus "look together gives the answer and the redo can be copied". Stay 3.

**Clarity.** All twelve stay at 3.
- Parrot: the numbered see-saw is flat (`'rest'`, `src/games/parrot/Goes.tsx:188`) on every non-stone go, and after a wrong true-or-false tap the why-picture stays still (`:139`). That makes the true-or-false lesson weaker (it hurts Feedback item 17 more than Clarity). It is "a few cluttered or fiddly moments", not instructions unclear. I did not check in code that "=" is printed on false sums (helper saw it in play).
- Robin: "why" panel at the bottom of the window (one helper's play, 768 px high), no written question on "How many?", berries fade in late and overlap. Several fiddly moments, but voice, "Hear it again", a hand and big targets are there. Keep 3, and verify the panel position on a real laptop before go-live; if help is off screen, Feedback would fall too.
- Lizard: emoji "why" picture is Feedback, not Clarity. Ten taps for 10 is slow but clear.
- Beanstalk: long number string in "look together", and the why-panel overlaps for a moment. Fiddly, not unclear.
- Hop and Pipi: no "Hear it again" (the kit's `HearAgain` is not used). That is what keeps them from 4; the rubric's 2 needs unclear instructions or too much on screen as well.
- Quick looks: voice is OFF by default (`src/speech.ts:11-17`, the saved setting must equal "true"). A pre-reader must find a tick box. There is a good demo picture first. Weakest 3 on this line; I kept 3 because the rubric's 3 says "voice available" and a 5 to 8 year old can tap a number they know.

**Support.** All stay 3 after Beanstalk's change. Every game has a demonstration for the very first go only (or for nothing); none has one for each new kind.

**Fading.** Beanstalk, Tūī, Weka, Pigeon, Lizard, Swamp Hen, Robin, Quick looks stay at 3 for the reasons in their files (one level per child, slow once-a-day moves, `STRUGGLE_GOES` unused in three of them).

**Progression.** Pipi stays at 3 (a level-2 round has only wholes 6 and 7; kinds follow the calendar; same-day replays can move a level). It adapts per child by a 70% rule, which is "some adaptation". Robin stays at 3, with a warning: the step gate can be passed by the third-card pattern.

**Feedback.** Can they stay at 3 given the problems found? Yes.
- Rubric 3: "Some elaborated feedback (a hint or reason) for some mistakes, kind tone." Rubric 2: "right/wrong only, or the answer is simply shown." Every game gives named-slip reasons for card goes and a second attempt with help. None is "answer simply shown" except possibly Quick looks, below.
- Lizard: the why-picture is an emoji and the child's own attempt is wiped (`Goes.tsx` resets the mat); the third wrong in the redo is silent. Still gives a one-line named slip for card goes and a labelled model on the second wrong. 3, weak.
- Robin: slip lines are good; the picture is a row of the picked number, not the child's own count; the redo marks the right card. 3, weak.
- Parrot: true-or-false gets no tilt picture; stone goes get the generic "Not quite". Card goes are good. 3.
- Pigeon, Swamp Hen: emoji/still picture with a text line. 3.
- Quick looks: the answer is shown at once with the groups drawn ("It was 5: 3 and 2"), the same picture, no retry, and no reason tied to the wrong choice. This is the closest to the rubric's 2 ("the answer is simply shown"). I kept 3 because the reveal shows the structure of the picture (the subitising strategy) and the next picture is helped. If James reads item 18 (another go) as a must, this would be a 2.
- Beanstalk: the strongest of the junior games.
- Same finish praise in nearly all games ("Well done! A lily pad turned bronze!" shown after 9 wrong of 10 in Hop, after 23 wrong of 33 in Weka, Penguin Pairs, Swamp Hen, Parrot). That is an Engagement/praise problem; the rubric's 1 ("misleading or shaming") is for the per-answer feedback, which is kind.

**Progress recording.** The question: should the five games missing from the teacher's Foundational view be lower than the six?
- Verified. `src/teacher/foundational/config.ts` `GAMES` holds exactly beanstalk, hop, korora, pipi, tui, weka (lines 44 to 50), the migration `supabase/migrations/20261107000100_foundational_teacher_views.sql` builds the class object from exactly those six (lines 27 to 80), and a grep of `src/teacher` and `shared/kit/teacherGrid.ts` finds no pigeon, parrot, lizard, swamphen or robin.
- Decision: no, not lower than 3, because the rubric's 2 is "Totals saved but no per-skill, per-attempt detail" and all five save per-fact attempts and correct (shared maths records) plus every tap per round; and the rubric's 3 only needs that "a teacher could work out who is stuck with some effort". Each has a pupil page (hardest facts, usual slip), so the effort is opening each pupil. Robin and Parrot save the slip kind as well.
- But the gap is real and is the reason none can reach 4 (item 22: "at a glance who is stuck on what, and who has not played"). The six with the grid and Today alerts are better here, and it should be fixed before those five are used by a whole class.
- Even the six are held at 3: the wrong answers chosen are saved but never shown; Hop's teacher config knows only steps 10, 5 and 2 with `top: 2` (`config.ts:45`), so children on threes, fours or tens past 100 have no level name and fall out of the grid column; Penguin Pairs' config stops at level 4 with `top: 4` (`config.ts:46`) so a child on level 5 (near doubles) can be flagged "same level too long" just for being at the top.
- Quick looks: saves every answer, including the number given, time and help (so items 20, 21 met), but the teacher sees stage, stages finished and recent % only (item 22 partly). Thin, but 3.

**Engagement.** All stay 3. Every game pays its day reward for finishing, not for being right; none has choices. That sits within the rubric's 3 ("some extrinsic rewards; limited choice"). Robin's card goes and Swamp Hen's "turn" and "share" are the least satisfying maths.

## 5. Which 3s are weak (not a score, a warning)

Order is weakest first among games with at least one shaky 3:
1. Robin (Maths 2; also Feedback and Clarity shaky).
2. Beanstalk (Progression 2).
3. Lizard (Maths, Feedback).
4. Swamp Hen (Maths and Feedback: share and turn are watched; Recording: no grid).
5. Quick looks (Clarity: voice off; Feedback: answer shown, no retry).
6. Parrot (Clarity and Feedback on true-or-false).
7. Pigeon (Support: Peek button; Maths: coin toss near goes).
8. Hop, Pipi (no replay of the question).
9. Penguin Pairs (new halves share themselves on full help; level 5 not in teacher config).
10. Tūī, Weka (steadiest 3s; Weka's four-screens-per-go is its main fiddly point).

## 6. Spot-checks (code)

| # | Claim (helper) | Where | Held? |
|---|---|---|---|
| 1 | Foundational teacher view covers only six games; pigeon, parrot, lizard, swamphen, robin are absent | `src/teacher/foundational/config.ts:44-50`; `supabase/migrations/20261107000100_foundational_teacher_views.sql:27-80`; grep of `src/teacher`, `shared/kit/teacherGrid.ts` | Held |
| 2 | Hop teacher config knows only steps 10, 5, 2, `top: 2` | `src/teacher/foundational/config.ts:45` | Held |
| 3 | Penguin Pairs teacher config stops at level 4, `top: 4`, so level 5 has no name | `src/teacher/foundational/config.ts:46` | Held |
| 4 | Robin: right answer is nearly always the third card (wrong cards n+1, n-1, n-2 or n, n+2, 1, then sorted) | `shared/robin/round.ts:216-222` (and `pickWrongs`, `:189-201`) | Held. The first three offsets are taken first, so cards are [n-2, n-1, n, n+1] and [1, n, n+1, n+2]. Exceptions only when an offset falls outside 1 to the max card (n=1, n=2), as the helper said |
| 5 | Parrot: card goes won by picking the number "not printed in the sum" | `shared/parrot/round.ts:211`, `:231` | Partly held. The three wrong cards include the two printed numbers and the total (the biggest), plus one off-by-one card, so the tell narrows to two cards (50%), not one. Helper overstated |
| 6 | Parrot: see-saw drawn flat on card goes; why-picture stays still after a wrong true-or-false tap | `src/games/parrot/Goes.tsx:188`, `:139` | Held (flat/still). "=" printed on a false sum: not checked in code, play only |
| 7 | Beanstalk: a tried pair is blocked, allowing elimination | `src/games/beanstalk/Round.tsx:159` | Held |
| 8 | Beanstalk: next sum depends only on eggs (30 finished days), not skill | `shared/beanstalk/progress.ts:20` (`targetFor`) | Held. Decides the Progression 2 |
| 9 | Beanstalk: bonds to 100 and 1000 share one key each | `shared/beanstalk/round.ts:98-99` | Held |
| 10 | Hop: day count and the pad depend only on finishing, not on right answers | `shared/hop/progress.ts:82-86` (`finishChallenge` has no accuracy input); `shared/hop/server.ts` finish block | Held |
| 11 | Hop, Penguin Pairs, Pipi share the same help ladder (full until box 2 and two quick days) | `shared/hop/round.ts:146-151`; `shared/korora/round.ts:101-106`; `shared/pipi/round.ts:84-89` | Held. Decides the Fading change |
| 12 | `STRUGGLE_GOES` is never used in Pigeon, Lizard, Swamp Hen (three wrong goes in a row do not bring full help back) | `shared/pigeon/config.ts:38`, `shared/lizard/config.ts:38`, `shared/swamphen/config.ts:35` are definitions only; grep of the three game folders for "struggle" or `wrongFirstRun` finds nothing. It is used in Hop, Parrot, Pipi, Penguin Pairs, Weka, Robin, Beanstalk | Held |
| 13 | Lizard: tying is skipped after go 1 (bundle +/- shown) | `src/games/lizard/Goes.tsx:326` (`withBundles: !(guided && at === 0)`) | Held |
| 14 | Lizard: raft tip shows on a Swap go with no raft | `src/games/lizard/Goes.tsx:178`; `shared/lizard/round.ts:274` (swap answer is `(t-1)*100 + o + 10`, so at least 100 for any swap with two or more tens) | Held (the cause). A real small bug |
| 15 | Pigeon: after three wrong taps the one wrong card left is one already tried | `shared/pigeon/round.ts:378-381` | Partly held. The code keeps the first wrong card not yet tapped; it falls back to a tried one only when all three wrong cards were already tapped. So it is just "tap-all", not an extra loophole. Helper overstated |
| 16 | Tūī: the planned "third wrong tap fades nests to two" is not used by the game | grep for `pic.nests` in `src/games/tui` (none); `shared/tui/round.ts:238` says four nests at every level by design | Held, but not a defect: the plan was dropped on purpose (maths review R5) |
| 17 | Quick looks: voice is off by default | `src/speech.ts:11-17` (`readSaved` is true only if saved as "true") | Held |
| 18 | Robin: why panel below the fold; berries fade in late | play only | Not checked in code |
| 19 | Swamp Hen: share is not done by the child; turn cannot be wrong; forced answer after 3 wrong | play (script) only | Not checked in code |

## 7. Cross-game patterns, ranked by harm to learning

1. **A fixed pattern beats the card goes (Robin).** The third-card tell passes the step gate with no counting, so the game moves a child on without the idea. Worst because it breaks the mastery rule that every other game relies on. Also Parrot (50% tell, card goes, lower levels) and Pigeon (two-card "near" goes at 50%).
2. **The day's reward and "Well done" are paid for finishing, not for right answers.** All eleven daily games (Quick looks excepted). Tap-all finishes a go in every one of them. The records stay honest and the level does not move, so the harm is to the child's picture of what the game is for, and to a teacher who sees a full row of gold. Seen: 9 wrong of 10 in Hop and 23 wrong of 33 in Weka and Penguin Pairs still got "Well done! A ... turned bronze!". Examples: Hop, Penguin Pairs, Pipi, Tūī, Weka, Beanstalk, Pigeon, Parrot, Lizard, Swamp Hen, Robin.
3. **"Look together" shows or says the answer and the redo can be copied.** Hop, Penguin Pairs, Pipi, Tūī, Weka, Lizard (target mat), Robin (right card marked), Parrot (right card marked), Beanstalk (fills the frame to the target). The first tap is already scored wrong, so this is a teaching-quality problem more than a data one. Pigeon alone does not show the answer.
4. **Elimination leaves the answer forced.** After wrong taps greyed cards or tried pairs fall away: Beanstalk (tried pairs blocked), Lizard (cards cut to 2 after 3 wrong), Pigeon, Swamp Hen, Robin, Tūī, Parrot (two cards on redo).
5. **No demonstration the first time each new kind appears.** All twelve have a guided first go at most. Cold starts: Weka's hop-back, Hop's counting back and "from 3", Parrot's true-or-false and subtraction, Swamp Hen's mat, share and cut, Pigeon's zoom, Lizard's Swap and Bundle, Penguin Pairs' halves, near doubles and fair-or-not, Robin's How many? and One more, Beanstalk's missing-leaf, Quick looks' empty squares.
6. **Help moves once a day, one level for the whole child (not per kind of go), and the in-round "three wrong in a row" rule is missing.** One level for all kinds: Tūī, Beanstalk, Pigeon, Parrot, Lizard, Swamp Hen, Robin. Rule unused: Pigeon, Lizard, Swamp Hen (verified). Slow for a child who already knows it (about 10 days to reach no help in several). Expertise reversal is partly handled by a class-wide teacher "Off".
7. **Progression is mostly "weakest facts first plus a 70% rule", with no target success rate, little revisiting of passed steps, and some can be rushed by "Play again" the same day** (Penguin Pairs, Pipi count a repeat day toward the level). Beanstalk is the worst: sum by calendar only, no review of earlier sums.
8. **The teacher's view lags the games.** Pigeon, Parrot, Lizard, Swamp Hen, Robin are not in the class grid or Today alerts (verified); Hop's config misses threes, fours and tens past 100; Penguin Pairs' config misses level 5 and near doubles in "hardest" (config verified, SQL not checked); no game shows the wrong answers chosen to the teacher; Quick looks shows only stage and recent %.
9. **The "why" picture is not the child's own work** (Lizard emoji and a wiped mat, Pigeon and Swamp Hen emoji/still picture, Robin a row of the picked number, Parrot's true-or-false still picture, Hop's mini row). The words are good; the model is not the one the child was using.
10. **The question cannot be replayed or heard by default.** Hop and Pipi have no "Hear it again"; Quick looks has voice off by default; Tūī loses the voice for the numbers at its lowest help levels; Robin has no written question on "How many?". Nobody could hear any recorded voice in this review.
11. **Praise is about the result or the child, not the strategy** ("Well done!", "You are so good at this!"), everywhere except Weka's and Beanstalk's per-answer lines ("10 and 3 make 13").
12. **Small bugs:** Lizard's raft tip on a Swap go (verified); Quick looks' screen-reader label "1 counters and 4 empty"; Penguin Pairs' near-double "reflection" has an extra fish; Pigeon's "arrow" is a dot and the line jumps up about 80 px when the reason panel opens (play only).

## 8. Helper claims I found wrong or overstated

- **Beanstalk Recording 2** was not supported by the rubric (per-fact attempts and correct are saved). Raised to 3.
- **Beanstalk Progression 3** counted the dots as "adaptation"; that is Fading, and the sum is the same for every child by calendar. Lowered to 2.
- **Beanstalk Support 4** contradicted the helper's own checklist item 9 "partly". Lowered to 3.
- **Hop, Penguin Pairs, Pipi Fading 4:** item 12 was marked "yes" or "partly" but the ladder is the same one that gave Weka a 3. Pipi's helper called the 4 borderline. All lowered to 3. **Parrot Fading 4** called per-skill although help is one level per child; lowered.
- **Quick looks and Lizard Progression 4** were given with item 14 admitted as "partly". Lowered to 3.
- **Parrot, "won by picking the card not printed in the sum"** is overstated: it leaves two cards (the answer and one off-by-one), 50%, not a sure win (`shared/parrot/round.ts:211`, `:231`).
- **Pigeon, "the one wrong card left is one already tried, so the answer is forced"** is true only after the child tapped all three wrong cards (`shared/pigeon/round.ts:378-381`); it adds nothing beyond tap-all.
- **Tūī, "the planned fading to two nests is built but not used"**: correct that it is unused, but the design now has four nests at every level on purpose (`shared/tui/round.ts:238`), so it is not a bug.
- **Evidence limits not wrong, but worth stating:** Swamp Hen's play was by script; Robin's below-the-fold panel is from one window size; the Penguin Pairs "hardest ignores near doubles" claim is in a migration I did not open.
- Two helpers (Penguin Pairs and Weka) say they opened `docs/LEARNING-DESIGN.md` before writing. They say it changed nothing; I re-scored from the rubric wording, so nothing depends on it.
