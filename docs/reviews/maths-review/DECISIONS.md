# Main-session decisions (scores, patterns, ranking)

These override the helpers' draft scores where they differ. All helper files are in this folder.

## Final scores (1–4), calibrated across games against the rubric in research-design.md

| Game | Fidelity | Clarity | Support | Fading | Progression | Feedback | Recording | Engagement | Total /32 |
|---|---|---|---|---|---|---|---|---|---|
| Weka's Stepping Stones | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 3 | 24 |
| Quick looks | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 23 |
| Tūī's Ten Tree | 3 | 3 | 4 | 2 | 2 | 2 | 3 | 3 | 22 |
| Pipi's Hidden Shells | 3 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | 21 |
| Penguin Pairs | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 20 |
| Kiwi's Beanstalk | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 3 | 19 |
| Hop's Glow-worm Pond | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 3 | 19 |

Calibration changes from the helper drafts:
- Beanstalk and Hop feedback 1 → 2: "wobble + Try again" is right/wrong-only feedback, which the rubric scores 2 (1 is none or harmful). The same score applies to every game that does this.
- Pipi support 2 → 3: the ten-frame and outlines are shown automatically on bronze days, which is the same as Penguin Pairs (3).
- Penguin Pairs recording 2 → 3: per-fact records are saved and the teacher's pupil page shows the 3 hardest facts, the same as Tūī and Weka (3). Beanstalk, Hop and Pipi stay at 2 because the per-fact data is saved but no teacher page uses it. Quick looks stays at 2 because no teacher page reads it at all.

## Live data (7 Nov 2026, read-only queries; small numbers because the games are 1–6 days old)
- Beanstalk: 15 pupils, 29 finished rounds, 3.2 wrong taps per round on average; 14% of rounds had 10+ wrong taps (a guessing signal).
- Hop: 10 pupils, 15 rounds, 1.0 wrong taps per round.
- Penguin Pairs: 10 pupils (4 on level 1, 2 each on levels 2–4).
- Early-facts records (all games sharing them): bonds to 10 84% right (48 pupils), bonds to 20 85%, doubles 95%, halves 92%, "ten and" 93%, skip 10s 93%, parts of 3–5 80–92%.
- Quick looks: 21 pupils, 378 counted answers, 81% right; 43 helped answers, 74% right.
- Reading: accuracy sits at or above the 75–90% target, so the games are not too hard. The risk is the other way: too easy, or answers found by elimination. Re-run in 3–4 weeks when there is more data.

## Patterns across games (the cross-game judgements)
1. **Mistakes teach nothing (all 7).** A wrong tap gets a wobble and "Try again!". Wrong taps are free, so tapping every choice always wins. Wrong choices are mostly answer ±1 or easy to rule out (only even number, only one ending in 0, only teen-shaped number), not real misconceptions. This is the biggest single gap and it is shared.
2. **Help fades by the calendar, not the child (Beanstalk, Hop, Penguin Pairs, Pipi).** Bronze, silver and gold days are set by days played. Help never comes back for a struggling child. Tūī adapts but has a bug that cancels fading for a good child (round.ts:92–104). Weka and Quick looks are the best models of per-child fading.
3. **The 5-second rule can trap careful children (games using shared/maths/leitner.ts afterAnswer).** A fact only moves up when correct within QUICK_MS, and in Hop the clock starts while the voice is still reading. afterAnswer already takes a quickMs argument, so each game can pass a junior value and start the clock after the voice, with no change to shared/maths.
4. **Teachers can't see who is stuck (all 7).** Per-fact data is saved (gem_keep_facts early-facts packs; training_answers for Quick looks), but there are no Today-page alerts, no class grid of stuck pupils, and Quick looks has no teacher view at all (teacher_training_student exists but is not called). Beanstalk's Maths column says "Bonds to 10" even on the 100 and 1000 beanstalks.
5. **Short ladders with no "what's next" (Penguin Pairs, Tūī, Beanstalk).** Each game stops at its own top level, with no link on to the next idea (for example Tūī → Weka, Pipi → Beanstalk).
6. **Strengths to keep:** voice read-aloud, bright themes and calm pacing (clarity 3 everywhere), real representations (ten-frames, number lines, pebbles), and server-checked answers.

## Recommendations for existing games (priority order: quick wins first)
| ID | Title | Games | Effort | Impact |
|---|---|---|---|---|
| R1 | Fix Tūī's fading bug | Tūī | S | High |
| R2 | Fair step-up for careful children (junior quickMs, clock starts after voice) | Hop, Penguin Pairs, Pipi, Beanstalk, Tūī, Weka | S | High |
| R3 | Quick looks fixes: "keep picture" practice doesn't count to pass, save reaction time, a demo first, help-prompt bugs | Quick looks | S | Med |
| R4 | Beanstalk: show the target number, no duplicate numbers on screen, a bridging step 10 → 100 | Beanstalk | S | Med |
| R5 | Mistakes that teach: misconception-based wrong choices, "show why" with the same model, a cap on free taps then a guided redo | all 6 games | L | Very high |
| R6 | Help that follows the child: per-child help level that fades with success and returns with struggle (copy Weka's approach) | Beanstalk, Hop, Penguin Pairs, Pipi | M | High |
| R7 | Teacher view for Foundational skills: class grid of stuck/secure per idea, Today-page alerts, Quick looks wired in | all 7 | M | High |
| R8 | Longer ladders and "what's next" links between the foundational games | Penguin Pairs, Tūī, Beanstalk, Hop | M | Med |
| R9 | Game-specific depth: Hop counting back earlier; Penguin Pairs "Fair or not?" with a real pile; Weka pebble step where the child stops at ten; Tūī keys 10+n and n−10 separately | Hop, Penguin Pairs, Weka, Tūī | M | Med |

## Gap ranking (main-session judgement; the helper's ranks were mostly tied at 9)
Tie-breaks: (a) fit for the 5–8 age group that the Foundational group serves; (b) it builds on a game we already have; (c) how often the hub already asks it as a bare quiz (understanding first).
1. **Comparing, ordering and the number line (one more/one less, where does 37 go?)**: the base for place value, rounding and mental strategies; very game-friendly. Concept: *Pigeon's Number Line*.
2. **Equals as balance and missing numbers (8 = ? + 5)**: the classic misconception that blocks algebra; no game touches it. Concept: *Balance scales / see-saw*.
3. **Place value to 100 and beyond (bundling tens)**: Tūī stops at 20. Concept: *Bundle sticks into tens*.
4. **Equal groups and arrays (what multiplication means)**: times tables are the most-asked content in the hub, but always as a bare quiz. Concept: *Orchard rows / egg trays*.
5. **Counting out a set (one-to-one, cardinality, "give me 7")**: the very first skill for new entrants. Concept: *Feed the ducks: give exactly N*.
6. **Money: NZ coins, totals and change**: high engagement and real-life use. Concept: *Dairy shop*.
Later (score 6, sketched only): repeating and growing patterns; adding and subtracting beyond ten (28 + 5, near doubles: extends Weka); picture graphs and tally charts; position and direction; time.

New-game plans are written for gaps 1–5 (N1–N5). Money (N6) is a sketch only.

Overall priority order (fixes and new games together):
R1, R2, R3, R4 (quick wins) → R5 → R6 → R7 → N1 Number line → N2 Balance → R8 → N3 Place value → N4 Arrays → R9 → N5 Counting out → N6 Money.
