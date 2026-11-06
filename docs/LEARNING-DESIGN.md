# Learning design for School Games Hub maths games

*How to design a maths game so children actually learn from it: structure, support, fading, progression, mistakes, materials and what to record. Written 7 November 2026 from the Foundational maths games review (`docs/reviews/fundamental-maths-review.md`) and its research notes (`docs/reviews/maths-review/research-design.md` for game design, `research-maths.md` for the maths ideas). Read this before you plan any game with maths in it. [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md) covers how to build it and get it live; this doc covers what to build.*

Shared parts that put these rules into code are planned in [plans/GAME-KIT-PLAN.md](plans/GAME-KIT-PLAN.md). Until a kit part is merged, copy the "best example" named under each rule.

---

## 0. In one minute

1. **The maths is the move.** Winning needs the idea. Tapping everything or guessing must not work.
2. **One thing at a time, voice first.** A 5-year-old can start alone.
3. **Concrete, then picture, then number.** Pick the right model for the idea and fade it.
4. **Help arrives by itself** when a child is stuck, with an example the first time something new appears.
5. **Help follows the child, not the calendar.** It steps back after steady success and comes back after struggle.
6. **Progression:** research order, aim for 75 to 90 percent right, move up on steady success, bring old skills back, and say what's next at the top.
7. **Mistakes teach.** Wrong choices are real misconceptions; a wrong tap shows why on the same picture, then the child tries again.
8. **Fair timing.** The clock starts after the question is read, and young children get longer.
9. **Record evidence a teacher can use,** and show the teacher who is stuck.
10. **Fun comes from the maths,** and rewards celebrate real success.

Every rule below has: what it means, what it looks like in our games, the best example to copy, and the trap we fell into.

---

## 1. Why this doc exists

The review scored the seven Foundational games 19 to 24 out of 32. They were clear, warm and honest (voice, big buttons, real maths pictures, answers checked on the server). The same five gaps showed up in nearly all of them, because each game was copied from the last:

- **Mistakes taught nothing.** A wobble and "Try again!". Taps were free, so tapping every choice always won (one Beanstalk round: 26 wrong taps, 8 right).
- **Help faded by the calendar.** Bronze, silver and gold days took the pictures away whether or not the child was ready, and never brought them back.
- **Careful children were blocked.** A fact only moved up if answered within 5 seconds, and in Hop the clock ran while the voice was still reading.
- **Teachers couldn't see who was stuck.** The data was saved, but no screen showed it.
- **Ladders were short,** with no link to the next game.

Fixes R1 to R5 have started on these (`docs/plans/maths-review/`). This doc makes sure new games start without them.

The research behind it, in short: maths as the game mechanic beats a quiz between levels (Habgood and Ainsworth 2011); spoken words plus pictures beat text (Mayer); help should come when needed and go when not (Wood, Bruner and Ross; Kalyuga's expertise reversal); feedback that explains beats right-or-wrong (Hattie and Timperley; Shute); spaced and mixed practice beats cramming; move up on mastery, aiming for 75 to 90 percent success; choice and visible growth beat rewards for turning up (Ryan and Deci). Sources and caveats: `research-design.md`. The numbers (85 percent, 64 pixels, 10 minutes) are guides, not laws: most studies used older children.

---

## 2. The ten rules

### Rule 1. The maths is the move

**Means.** The thing the child does to play *is* the maths: hopping to ten, sharing fish, filling a frame. No quiz between levels. And there is no way to win without the idea.

**In our games:**
- **Cap free taps.** At most two wrong taps on a go, then the game shows the answer and the child redoes it (rule 7). Wrong taps never cost the child their day, but they can't be used to search.
- **No give-away choices.** At most 2 of 4 choices share the right answer's "tell" (same last digit, same odd or even, same teen shape). Hop's tens had only one choice ending in 0, so children won by spotting the 0.
- **Nothing on screen gives the answer away.** No duplicate numbers that can be matched by sight (Beanstalk, fixed in R4). The game doesn't do the step for the child (Penguin Pairs shared the halves out before the child did anything).
- **Only the first tap counts** to the child's records, and the server replays the taps.

**Best example:** Weka's Stepping Stones (the hops are the sum). Beanstalk after R5 for the tap cap.
**Trap:** "the child can always tap again" feels kind but makes the maths optional.

### Rule 2. One thing at a time, voice first

**Means.** A child who can't read yet can start alone. One question and one action on screen. Labels sit next to what they describe.

**In our games:**
- Every line read aloud by a Kokoro clip (af_bella), with **Hear it again** always visible. The answer is never spoken before the child answers.
- The goal is **written on screen too** (Beanstalk didn't show "10" anywhere when the voice was off; fixed in R4).
- Targets **64 px or more for ages 5 to 7**, 44 px for older children. Same button places every go. No visible timers.
- **Session length:** juniors 5 to 10 minutes (10 goes a day), Years 4 to 6 10 to 15 minutes. A natural stopping point, saved as you go.
- Don't hold the screen after every right answer for long (Tūī's 3.4 seconds added 45 seconds of waiting a round).

**Best example:** Quick looks (one picture, five buttons, every line voiced).

### Rule 3. Concrete, then picture, then number

**Means.** Start with something that looks like objects (fish, pebbles, berries), then a structured picture (ten-frame, number line), then numbers only. The picture must match the idea and be mathematically right. Section 3 lists the model for each idea.

**In our games:** a game plans its **help ladder** as the steps from picture to number, for example Weka: full (hops and sentence) → split first → faint → numbers only. Beanstalk: full dots → small dots → none.

**Best example:** Weka (number line with a rock at 10, pebble ten-frames, part-whole bond).
**Trap:** a picture that's pretty but not the maths (Penguin Pairs' fair-or-not icons didn't match the pile).

### Rule 4. Help arrives by itself

**Means.** The child never has to hunt for a hint. Help appears after a wrong tap or a long pause, and the first time a new kind of question appears there's a short demonstration.

**In our games:**
- **Wrong tap 1:** the "why" line and the picture (rule 7). **Wrong tap 2:** "Let's look together". **3 goes in a row with a wrong first tap:** full help for the rest of the round.
- **A demo or guided go the first time** a new kind appears (Quick looks' demo, R3; Weka's first go). Who has seen it comes from the server, so it follows the child to any Chromebook.
- Help **never gives the maths answer away** before the child has tried (Weka's `voiceLines.ts` header rule).

**Best example:** Weka (counting together after 2 wrong taps, a pointing hand after 3) and Tūī (the picture rises one level after each wrong tap).

### Rule 5. Help follows the child, not the calendar

**Means.** Help steps back as *this* child succeeds and comes back if they struggle, per fact (or per child where facts can't be told apart). Children who already know it aren't slowed by help they don't need.

**The rule to use** (the same numbers as Weka and Tūī):
1. **Start full.** Anything new (a new fact, step or level) starts with full help.
2. **Fade on steady success.** One step less help once the fact is secure: right and quick on **two different days** (Weka `helpForStats` in `shared/weka/round.ts`). Per child: two good rounds in a row (8 or more of 10 right first time), as in Tūī's `placeAfter` (`shared/tui/round.ts`).
3. **Return on struggle.** A wrong first tap puts that fact back to full help (automatic with the Leitner box rule in `shared/maths/leitner.ts`). Per child: a hard round (4 or fewer of 10) puts help up one step. In the round: 3 goes in a row wrong → full help until the round ends.
4. **Save it** with the round (the server works it out at start, the browser and the replay agree).
5. **Teacher override:** fade (default), always, off.
6. **The calendar is for rewards and looks only:** stone colours, new kinds of go on silver and gold days. Never for how much help a child gets.

**Best example:** Weka (`helpForStats`), Quick looks (flash time shortens at 85 percent, steps back under 60 percent). The plan for the other games: `docs/plans/maths-review/R6-help-follows-the-child.md`.
**Trap:** Tūī passed a step and reset help in the same go, so a strong child never saw help fade (R1). Test fade and step-up together.

### Rule 6. Progression

**Means.** Levels follow the research order, adapt to the child, need steady success to move, bring old things back, and lead somewhere.

**In our games:**
- **Order:** small numbers before big, one idea before mixing, concrete before abstract. Use the order in `research-maths.md` for each idea.
- **Adapt toward 75 to 90 percent right.** Weakest facts first in each round, but mix in secure ones so the round feels winnable.
- **Move up on mastery,** not one lucky answer: e.g. 70 percent of a level's facts in box 2 or more (Weka's rule, also the teacher skill map's).
- **Spacing and mixing:** a few goes each round revisit older, secure facts (the focus pack does 60 percent focus, 30 review, 10 stretch); once each kind is secure, mix kinds in a round.
- **A ladder long enough for a term.** A quick child shouldn't hit the top on day 12 and then repeat five facts for 18 days (Penguin Pairs).
- **What's next.** At the top of the ladder, a small card to the next game (Tūī → Weka). Table: `docs/plans/maths-review/R8-longer-ladders-whats-next.md`.
- **Practice replays** (playing again on the same day) mustn't move the child's level (Hop's did).

**Best example:** Quick looks (placement check, picture-type coverage needed to pass, step back) and Weka.

### Rule 7. Mistakes teach

**Means.** A wrong answer is the best moment to learn. Show what went wrong and why, on the same picture, then let the child try again. Kind words: "not yet", never shame. Praise the strategy ("You made ten first!"), not cleverness.

**The "show why" flow** (built in Beanstalk R5; `docs/plans/maths-review/R5-mistakes-that-teach.md`):
1. **Build wrong choices from real misconceptions,** each tagged with its kind (`over`, `under`, `close`, `digit`, `reversal`, `stopped-at-ten` …). Not just "answer ± 1". Section 3 lists the misconceptions per idea. The server rebuilds the same choices from the seed.
2. **Wrong tap 1:** that choice greys out, one "why" line is read aloud and shown on the game's own picture ("4 and 8 make 12. That is too many." with the extra dots glowing).
3. **Wrong tap 2:** "Let's look together": the picture works it through to the right answer (about 6 seconds, skippable after 3), then **"Now you try"**: the same question again with choices reshuffled. The redo isn't saved as a fact answer.
4. **The day still counts** for under-8s. A finished round still turns the leaf.
5. **Record the kind** of wrong choice (rule 9), so teachers see the misconception, not just "wrong".

**Best example:** Beanstalk (R5, `mistakeKind`, `hasNearMiss` in `shared/beanstalk/round.ts`). Quick looks' feedback ("It was 7: 5 and 2") is a good right-or-wrong one.
**Trap:** a wrong answer that isn't a real mistake for this idea (Penguin Pairs offered 25 for 5 + 5: a times-tables slip, not a doubles one).

### Rule 8. Fair timing for careful children

**Means.** Speed is for later, once the idea is secure. Early speed pressure rewards quick counting or guessing.

**In our games:**
- **Start the answer clock after the voice finishes:** `speak(text, clipFolder, onEnd)` in `src/speech.ts` calls `onEnd` once the line ends.
- **Juniors (ages 5 to 8) get `JUNIOR_QUICK_MS`** (10 seconds, `shared/juniorQuick.ts`), passed as the last argument to `recordMathsAnswers` or to `afterAnswer`. Everyone else keeps the pack's quick time.
- Don't count animations in the time (Penguin Pairs' sharing animation ran on the clock).

### Rule 9. Record evidence a teacher can use

**Means.** Save enough per child and per fact to see who is stuck on what, and show it.

**Save, per answer:** the fact key, right or wrong on the **first tap**, time, the **kind of wrong choice** picked, the **help level** shown, and the date. Choose fact keys that separate the ways of asking (Tūī's `tenand:n` can't tell "10 + 4" from "14 − 10"; Beanstalk's `bond100:tens` lumps every pair to 100 together).

**Show the teacher:**
- the pupil page line (`studentSummary`) and 3 hardest facts (`hardest`, `src/teacher/Hardest.tsx`)
- stuck signals on Today's "Needs you" (`alerts`), with the reason in words: same level too long, looks like guessing (many wrong taps), under 60 percent right, needed the explanation often, gone quiet (R7's table has first-guess numbers)
- for Foundational games, the shared class grid (R7, `docs/plans/maths-review/R7-teacher-foundational-view.md`)

Never show one child's maths results to classmates.

### Rule 10. Fun comes from the maths

**Means.** The satisfying bit is doing the maths (the frog lands, the berries fly into the frame). Rewards celebrate real success. Children have real choices and see themselves growing. A teacher could ask "how did you know?" about any go.

**In our games:** warm painted art and a guide character; growth you can see (a stalk, a pond, a tree); a long goal (30 days to a golden reward) plus a small one each day. Avoid rewards for just turning up when the maths was guessed. Keep social features optional and kind. No ranks by maths.

---

## 3. Materials and models (the maths pictures)

Pick the model from this table, plan how it fades, and build wrong choices from the misconceptions column. Full notes: `docs/reviews/maths-review/research-maths.md`.

| Idea | Model to use | Fades to | Misconceptions to build wrong choices from | Our game |
|---|---|---|---|---|
| Subitising | Dot patterns, ten-frames (5 and some), rekenrek; structured then scattered | Shorter flash, scattered layouts | Counts one by one (off by one on 5, 6); knows dice patterns only; freezes above 5 | Quick looks |
| Counting and cardinality | Objects to touch and move one at a time; a tidy row | Objects without a row | Skips or double counts; can't say "how many" after counting; recounts from 1; thinks a spread-out row has more | N5 (planned) |
| Part-whole, hidden amount | Part-whole diagram, ten-frame with empty squares, cover-up | Outline, then nothing | Answers with the total or the visible part; thinks a new split changes the total | Pipi |
| Bonds to 10, 100, 1000 | Ten-frames (the empty squares are the partner); tens frames for 100 | Small dots, then numbers | Off by one (6 + 5); 30 + 60 = 100 (digits not tens); 37 + 73 (reversed digits) | Beanstalk |
| Make ten to add | Number line with a mark at 10; two ten-frames, child moves counters | Split shown first, then faint, then none | Takes the wrong split; fills to ten then adds the whole second number; counts on by ones | Weka |
| Teen numbers | Two ten-frames (full ten + some), arrow cards, bundles | One ten-frame, then the sum | 31 for 13 (reversal); 13 vs 30; counts all instead of seeing the ten | Tūī |
| Doubles and halves | Mirror pictures, double ten-frames, sharing into two equal groups | Groups without the mirror, then numbers | Double 6 = 8 (adds 2); double 6 = 11 (adds 1); half means "any two parts"; half of 70 is 5 | Penguin Pairs |
| Skip counting | Number line with arcs and "+5" labels; hundreds board | Labels faint, then gone | Counts the jump as the landing; rote chant only; loses the units starting from 34 | Hop |
| Comparing, number line | Number line with landmarks (0, 50, 100) | Fewer landmarks | Bigger digit = bigger number (19 vs 21); one more / one less at the decade | N1 (planned) |
| Equals as balance | Balance scales, true or false equations | Scales without blocks | "=" means "the answer comes next" (8 = ? + 5 → 13) | N2 (planned) |
| Place value to 100+ | Bundles of ten sticks, tens and ones blocks, arrow cards | Blocks, then digits | 30 for 3 tens 0 ones vs 3; "1" in 13 is "one"; 103 for "ten-three" | N3 (planned) |
| Equal groups, arrays | Rows of trees, egg trays | Rows without objects | Counts all one by one; adds instead of groups; 3 × 4 as 3 + 4 | N4 (planned) |
| Money | NZ coins and notes | Coins as numbers | Counts coins not value; one coin "is" one dollar | N6 (sketch) |

**Picture rules.** Draw the model in code (SVG), not as a painted picture, so it can be exact, change number, highlight a part and fade step by step. Painted art is for the world around it (the pond, the beach). Keep the model the same from first go to "show why", so feedback uses the picture the child already knows.

---

## 4. Two age bands

| | Juniors, ages 5 to 8 (Foundational group) | Years 4 to 6 |
|---|---|---|
| Where the maths comes from | The game's own round from the early-facts records (`shared/maths/skillPacks/earlyFacts.ts`, or its own keys), recorded with `recordMathsAnswers` | The shared focus system (`makeFocusPack`, guide section 4) |
| Screen | Big picture, 3 to 4 big choices, every line voiced, no typing | `QuestionModal` (typed or choices), short words |
| Targets | 64 px or more | 44 px or more |
| A day | About 10 goes, 5 to 10 minutes | One sitting 10 to 15 minutes |
| Quick time | `JUNIOR_QUICK_MS` (10 s), clock after the voice | The pack's quick time |
| Mistakes | The full "show why" flow (rule 7) | At least show the right answer with a reason ("7 × 8 = 56: 7 × 4 is 28, doubled"); never the bare answer only |
| Help and fading | Per fact, picture steps (rule 5) | Per player: hints at a decision, fading with Lots / Some / Off (guide 1a item 7) |

---

## 5. The junior game skeleton

Every Foundational game shares this shape. Copy **Weka** (the best scorer) for structure, and **Beanstalk** for mistakes, until the kit parts exist.

- **A day:** 10 goes, one fact per go, first tap counts. Finishing a round marks the day: 30 days of bronze, silver and gold, then a golden reward, then the next stage.
- **Rules in `shared/<game>/`:** `round.ts` (`makeRound(seed, stats, opts)`, weakest first, help level per go saved in the round, wrong-choice kinds), `play.ts` (`replay(round, taps)`), `progress.ts` (the day arc), `server.ts` (load, start, finish; replays taps; records first taps with `JUNIOR_QUICK_MS`).
- **Screens in `src/games/<game>/`:** a `Goes.tsx` with the model, Hear it again, a pointing hand on the guided first go, the show-why panel; `voiceLines.ts` (`allVoiceLines()`), `words.ts`, `voiceLines.test.ts`.
- **Voice:** add each line to `allVoiceLines`, run the game's `voiceLines.test.ts`, then on James's Mac: `~/kokoro/.venv/bin/python -I scripts/voice-clips.py <game>`. Clips go to `public/voice/<game>/`. A line without a clip falls back to the browser voice.
- **Teacher:** fade / always / off help setting, pupil page summary, `hardest`, and a stuck alert.
- **The group:** `group: 'foundational'` in the definition.

---

## 6. Checking a design

Before building, the plan (`docs/<GAME>-PLAN.md`) answers each of these in a line, and gives James a recommendation where there's a choice:

1. Which maths idea, and which model from section 3? What does the child *do* that is the maths?
2. How could a child win without the maths, and what stops it?
3. The help ladder (picture to number), and the rule that fades it and brings it back.
4. The demo or guided go for each new kind of question.
5. The levels in order, how a child moves up, what comes back for review, and what's next at the top.
6. A **wrong-answer table:** each misconception, how it shows up as a choice, its "why" line and what the picture does.
7. What's recorded per answer, and what the teacher sees (summary, hardest, alert).
8. Where the fun is, and what the child is growing towards.

After building, score it against the 25-point checklist and the 1 to 4 rubric in `docs/reviews/maths-review/research-design.md`. **The bar for going live is a 3 on every line.** A 4 everywhere isn't expected. Prefer what you see the game do (play it in the preview with deliberate wrong taps and random tapping) over what the plan says.
