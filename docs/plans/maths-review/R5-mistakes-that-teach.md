# R5. Mistakes that teach (all six games)

> **Update 7 Nov 2026:** follow [LEARNING-DESIGN.md](../../LEARNING-DESIGN.md) and check [GAME-KIT-PLAN.md](../GAME-KIT-PLAN.md) first. If kit stage K2 (`mistakes` and `ShowWhy`, lifted from Beanstalk) is merged, use it instead of copying another game's code; if not, write this so it can move into the kit later.

Status: Beanstalk LIVE 7 Nov 2026 (#252). Hop, Penguin Pairs, Pipi, Tūī and Weka are going in one at a time; each game's own status is in its part of section 3 and on the review page. Written 7 Nov 2026. Games: Kiwi's Beanstalk, Hop's Glow-worm Pond, Penguin Pairs (folder `korora`), Pipi's Hidden Shells, Tūī's Ten Tree, Weka's Stepping Stones. Quick looks is not in R5 (its feedback fixes are in R3).

## 1. The problem

Pattern 1 in DECISIONS.md, and the biggest single gap. In all six games a wrong tap gets a wobble and "Try again!", and nothing else. Taps are free and unlimited, so tapping every choice always wins, and the wrong choices mostly are not real mistakes.

What the evaluators saw:
- **Beanstalk:** 26 wrong and 8 right taps to finish a day, no thinking (`docs/reviews/maths-review/games/beanstalk.md`, "Problems found" 1 and 4). Live data: 3.2 wrong taps a round on average, 14% of rounds with 10 or more wrong taps (DECISIONS.md, live data). The wobble is at `src/games/beanstalk/Round.tsx:85-87`, the words at `words.ts:22`.
- **Hop:** on tens, only one glow-worm ends in 0, so "tap the one ending in 0" wins with no counting (`shared/maths/skillPacks/earlyFacts.ts:158`, the +1/-1 distractors). Three wrong first taps and the pad still turns and the finish screen looks the same.
- **Penguin Pairs:** doubles offer n×n (5 + 5 offers 25, 10 + 10 offers 100), which is a times-tables slip and not a doubles error (`earlyFacts.ts:65`).
- **Pipi:** the same wrong shell can be tapped again and again; the pearl comes anyway.
- **Tūī:** 3 nests with distractors of different shapes (nests for 10 + 1 were 2, 10, 11). Only the reversal (41 for 14) is a real misconception (`shared/tui/round.ts:225`).
- **Weka:** wrong choices are always the answer ±1 and ±2, so no wrong choice can say why it is wrong (`shared/maths/skillPacks/addSub.ts:67-72`).

The answers are checked by the server, and only the first tap of a go is saved to the child's records (`play.ts` in each game), so the records are honest. What is missing is teaching at the moment of the mistake.

## 2. The research behind it

- `research-maths.md`, "Cross-cutting design principles" 3: "Feedback shows the maths. After a mistake, replay the structure: re-show the frames or groups, highlight the missing or extra part." Principle 1: "The idea must be necessary to win. If the child can tap everything... the maths is optional."
- The research's misconception lists per idea are the source of every wrong choice below: bonds ("9 + 2 is 11, not 10: one too many"; 30 + 60 = 100 is the digit-not-tens slip), part-whole ("answers with the total or with the visible part"), teens ("writes 31 for 13"; 13 vs 30), doubles and halves ("double 6 = 8, adds 2"; "half = any two parts"), skip counting ("counts the jump as the landing number"; loses the step), make-ten ("fills to 10 then adds the wrong leftover").
- research-design.md rubric: criterion 6 (Feedback) wants feedback that shows the mistake with the same model; right/wrong only scores 2.

## 3. The change

### 3.1 The same rule in every game (the "show why" flow)

Per go (one question, or in Beanstalk one pair):

1. **Wrong tap 1.** The wrong choice greys out and cannot be tapped again. A one-line "why" appears and is read aloud, and the game's own model shows it (frames joined, fish counted, pebbles, number line). The wobble stays but is short. Not a red cross: grey, calm, as now.
2. **Wrong tap 2 (the cap).** Free taps stop. The game says "Let's look together" and plays the full explanation with the game's model, ending on the right answer (about 6 seconds; the child can tap to move on after 3 seconds). Then the **same question comes back** ("Now you try"): all choices back, in a new order, with the model at the child's own help level, not extra help. The child must now answer it.
3. **Counting.** The go was already saved as wrong at the first tap (as now). The redo is never saved as a fact answer (no box moves, no "right first time"). It is kept in the round's `taps` like any tap, so the server replay needs no change. A go with 2 or more wrong taps is a "shown" go; the teacher view (R7) can count them from `taps` with no new column.
4. **The day still counts.** Finishing the round still turns the leaf, pad, shell, pebble or stone (James's rule for 5-year-olds: no shame). Open question for James, with my view: keep it so.
5. **Better wrong choices.** Each game builds its own choices inside its own `shared/<game>/round.ts` (the pattern is `showGo` in `shared/tui/round.ts:215-229`, which already replaces the pack's choices). Never edit `shared/maths/skillPacks/earlyFacts.ts` or `addSub.ts` (off limits from a game branch, and other games read them). Every choice is tagged with its kind (e.g. `{ n: 41, kind: 'reversal' }`); the kind picks the why-line and the picture. The server rebuilds the same choices from the seed, so the replay check still passes. The function must be rebuilt with `npm run build:functions -- <name>`.
6. **Choices are not eliminable by shape.** Rule for every game: at most 2 of the 4 choices share the "tell" of the right answer (same ending, same parity, same teen shape). So elimination leaves 2 choices, not 1, and the cap handles the rest.

Voice: every line is a Kokoro clip (af_bella). Add each line to `voiceLines.ts` (`allVoiceLines`) and `words.ts`, run the game's `voiceLines.test.ts`, then on James's Mac `~/kokoro/.venv/bin/python -I scripts/voice-clips.py <game>`. A line with no clip falls back to the browser voice, so the game still works before the clips are made.

Order of work, lowest score first: Beanstalk (19), Hop (19), Penguin Pairs (20), Pipi (21), Tūī (22), Weka (24). One branch and one session each, one after the other (not at once: R6 touches the same `Goes.tsx` files, so do R5 then R6 for a game, not both together).

### 3.2 Beanstalk (the "go" is a pair of leaves)

Model: the two ten-frames of dots on the leaves (`Leaf.tsx:38-45`). A wrong tap here is a wrong **pair**, not a wrong number, so the kind comes from the pair's total S against the target T (10, 100 or 1000; unit u = T/10).

| Wrong pair (kind) | The mistake behind it (research) | Show why (the model) | Voice line |
|---|---|---|---|
| Total is over T, by 2 or more units (`over`) | "10 = 6 + 5" style counting without checking; no picture of the ten | The two leaves' frames slide together; the first frame fills and the extra dots hang out of it, glowing | "4 and 8 make 12. That is too many." |
| Total is under T, by 2 or more units (`under`) | same | The frames slide together; the empty squares glow | "3 and 4 make 7. Not enough." |
| Total is T ± 1 unit (`close`) | Off by one: counted, did not know | Same, with one dot out or one square empty | "4 and 7 make 11. Just one too many." / "…10…. Just one more to make 10" (wording fits the pair) |
| On the 100 and 1000 beanstalks, total is 90 or 900 or 110 or 1100 (`digit`) | Treats tens as ones: 30 + 60 = "10 tens" slip (research-maths bonds: "30 + 60 = 100 or 40 + 50 = 100") | Frames labelled "tens"; 3 tens and 6 tens make 9 tens: one tens-frame square empty | "30 and 60 make 90. 3 tens and 6 tens is 9 tens, not 10." |

Tap 2 (the cap): "Let's look together." One on-screen leaf pulses (say the 7). The game fills its frame with the partner's dots one at a time ("7 and 1, 2, 3 more make 10"), then the leaves go back and the child gets "Now you try: what goes with 7?" with the 7 leaf still pulsing and the partner not marked. The pair made counts for the round but is a "shown" pair.

Other changes in this game:
- Choices: when leaves float in, never put two of the same number on screen (that is R4; if R4 is not merged, do it here for the pairs only) and make sure each tray of six has at least one `close` temptation (a leaf that is one away from a partner).
- No 3-tap guessing: with 6 leaves there are 15 pairs; after tap 1 the wrong pair's leaves shake and the pair is remembered as "tried" (a small grey mark joins them) so the same pair cannot be tapped twice.

New voice lines: the `over`, `under`, `close` lines for every pair (a, b from 1 to 9, smaller first, 40 pairs per target, 3 targets: about 120 clips) and 9 "what goes with" lines per target (27). Generated in `allVoiceLines` by loops like the existing one (`voiceLines.ts:30-33`).

### 3.3 Hop (skip counting on lily pads)

Model: the row of pads with arcs and the "+10" step label (`Hops.tsx:121-135`), and the 100 board (`HundredsBoard.tsx`). Choices are rebuilt in `shared/hop/round.ts`: four glow-worms, exactly two of them landing places on the same step (the answer and the one-hop-short or one-hop-too-many), and two misconceptions.

| Wrong choice (kind) | The mistake (research) | Show why | Voice line |
|---|---|---|---|
| Answer ± 1 (`off1`) (e.g. 39 or 41 for 40) | "Counts a jump as the starting number (off by one)" | Hop hops from the pad before the gap; the arc is lit; the wrong number appears one step beside the pad and fades | "30, then 10 more is 40, not 39." (clip per fact: about 30 for tens, fives, twos; back hops 30 more) |
| The pad before (`stay`) (e.g. 30 for 40) | Did not hop | Hop stays; the arc is shown empty | "That is where Hop is. Hop has to jump." |
| One hop too far (`far`) (e.g. 50 for 40) | Skipped a pad ("loses track of the jumps") | Hop jumps to the gap, then a ghost hop beyond it | "That is two hops. We need one hop." |
| Landing of a different step (`step`): before + 5 on tens, before + 2 on fives, before + 10 on twos | "Loses the step" | Arc label changes to "+10" and the wrong landing is crossed off the 100 board | "We are counting in tens. Each hop is 10." (one line per step) |
| Counting back only: the number going up instead (`way`) | Direction confused with "next" | Arc flips to point left | "We are counting back, so we go down." |
| A number already on a pad is no longer used | Easy to rule out, teaches nothing | Dropped | none |

Tap 2: "Let's look together." Hop hops the whole row from the start, saying each number ("10, 20, 30, 40"), the 100 board opens with the pads' numbers lit, the right pad glows; then "Now you try" asks the same hop again with the labels at the child's own level.

Rule for choices: the "ends in 0" tell is no longer enough: on tens, answer and answer ± 10 both end in 0 (two tells), and the two misconceptions do not.

**Hop status (7 Nov 2026, built, not merged, not live).** Every hop now has four glow-worms built in `shared/hop/round.ts`: the right one, one more on the same step (the pad Hop sits on, one hop too far, or when counting back the number going up), one more or less than the answer, and where a different step would land. Exactly two of the four end like the answer, so tapping "the one ending in 0" no longer wins. A wrong first tap greys that glow-worm (it cannot be tapped again), shows a small row of pads with the mistake, and Hop says why. A second wrong tap stops the free taps: "Let's look together", Hop hops the row from its first pad to the answer saying each number, the 100 board lights them (where the board sits beside the pond; on a phone it is left alone so it does not cover the pads), then "Now you try" asks the same hop again with all four glow-worms back in a new order and the labels at the child's own level. Only the first tap of each hop is saved to the facts, as before. Differences from the table above: the "off by one" line leaves out the wrong number ("30, then 10 more is 40.") so one clip serves 39 and 41; the line for a different step says the game's step, so it is one line per step; on twos the different-step landing is a hop of 5 (not 10), because a hop of 10 lands on an even number and would share the right answer's ending. Voice: 206 new Bella clips, the old "Try again!" clip removed. Merging redeploys the `hop` function.

### 3.4 Penguin Pairs (korora)

Model: fish on the rock and the same fish upside down in the water for doubles (`Goes.tsx:35, 267-295`), fish dealt one each to two chicks for halves (`Goes.tsx:333-370`), Bella counting each fish (`countTogether`, `Goes.tsx:111-126`).

| Question | Wrong choice (kind) | The mistake | Show why | Voice line |
|---|---|---|---|---|
| Double n | n (`same`) | Forgot to double | Rock fish only lit; the water fish appear and join the count | "Double 3 is 3 and 3 again." |
| Double n | n + 1 (`plus1`) | Counts on one ("double 5 is 10 but double 6 is 11") | Water fish count along; one fish in the rock row is shown too many | "Double means the same again, not one more." |
| Double n | 2n − 1 or 2n + 1 (`miscount`) | Miscounted the fish | Bella lights each fish while counting | "Let's count them: 1, 2, 3, 4, 5, 6." |
| Double n, n of 3 or more | n + 2 (`plus2`) | "Confuses doubling with adding 2 (double 6 = 8)" | Rock and water rows side by side, equal | "Double is two lots of 6, not 6 and 2." |
| Half of n | n (`all`) | "Didn't share" | All the fish go to the chicks one each; one chick's nest is lit | "That is all the fish. Half is one chick's share." |
| Half of n | n/2 ± 1 (`miscount`) | Counted one off | The fish are dealt out slowly and counted | "Share them out: one for you, one for me." |
| Half of n | n − 2 (`minus2`) | "Took 2 away", not "shared in 2" | Deal in two groups, both equal | "Half means two equal groups." |
| Half of n | 2n (`double`) | Halved and doubled mixed up | The pile gets smaller as it is shared | "Half is smaller. The pile goes into two nests." |

Removed: n × n (25 for 5 + 5, 100 for 10 + 10). Gold-day "fair or not" is left to R9.
Tap 2: the picture comes back in full for that go (as the existing second-wrong behaviour at `Goes.tsx:145-148` does) and Bella does the whole explanation, then "Now you try" shows the question again at the child's own help level.

### 3.5 Pipi (hidden shells, part-whole)

**Pipi status (7 Nov 2026, built, not merged, not live).** Every go now has four shells built in `shared/pipi/round.ts`: the right one, a one-more-or-less near miss always, and the slips from the table below (the number showing, the whole, whole plus showing, the first tide's number, or one part when asked altogether), with at most two the same odd or even. A wrong shell greys out for good and shows its picture and line; the second wrong shell lifts the sand, all the pipi wave and "7 = 4 + 3" fills in, then the same go comes back with all four shells in a new order at the child's own help. Only the first shell of a go is scored. New lines and clips are made. The live function redeploys when this merges. The old "Try again!" line and clip are gone.

Model: the pipi on the sand, the dashed outlines of the hidden ones, the shells with numbers (`Goes.tsx`, `spotsFor`).

| Kind of go | Wrong choice (kind) | The mistake | Show why | Voice line |
|---|---|---|---|---|
| Hiding | The number showing (`shown`) | "Answers with the visible part" | Showing pipi lit, hidden outlines dashed and counted | "4 are showing. How many are hiding?" |
| Hiding | The whole (`whole`) | "Answers with the total" | All pipi glow, then the showing ones step aside | "7 is all the pipi. Some are hiding." |
| Hiding | Whole + showing, when 20 or less (`add`) | "Treats 'and' and 'left' as the same operation" | Shows 7 and 4 would be 11, more than 7 | "We started with 7. The answer cannot be more." |
| Hiding | Answer ± 1 (`off1`) | Counted the outlines off by one | Outlines counted aloud, slowly | "Look: 1, 2, 3 hiding." |
| Altogether | One part alone (`part`) | Part and whole mixed | The showing group and the popped-up group join | "4 here and 3 popped up. Together that is 7." |
| Altogether | Whole ± 1 (`off1`) | Counted off by one | Count along | "Let's count all of them." |
| Two tides | The number from the first tide (`before`) | Did not see the split changed | Both tides shown, same whole | "The whole stays 7. Only the split changes." |

Tap 2: the sand lifts and all the pipi wave; the split is shown as "7 = 4 + 3" with the parts coloured to match (one line, see R5's sibling idea "show the number sentence", `pipi.md` candidate 7, but here only after a show-why, never on a right answer); then "Now you try" asks the same go again.
Also remove the no-hint wobble loop: shells that were tapped wrong stay greyed.

### 3.6 Tūī (ten and some)

Model: the full ten-frame and the loose berries, the nests, and the arrow cards sliding "4" onto "10" (`Goes.tsx`, `pictureFor` at `shared/tui/round.ts:244-270`). Today the wrong taps bring more picture (level up one, then every berry counted, then nests thin to two). Keep that idea but add the explanation; the answer is still not shown until tap 2.

| Way asked | Wrong choice (kind) | The mistake | Show why | Voice line |
|---|---|---|---|---|
| 10 + n, n + 10 | The reversal, 41 for 14 (`reverse`) | "Writes 31 for 13" | Arrow cards show 4 tens and 1 one beside the real 14 | "41 is four tens and one. We have one ten and four." |
| 10 + n, n + 10 | A round ten, 20 (`tens`) | Teen vs "-ty" confusion | Two full ten-frames next to the one we have | "That is two tens. We have one ten." |
| 10 + n | n alone (`ones`) | Reads only the loose berries | The ten-frame lit, then the berries | "That is just the loose berries. Add the ten." |
| 10 + n | n ± 1 (`off1`) | Counted all by ones, slipped | Berries counted in from the ten | "Ten, then 1, 2, 3, 4: 14." |
| 10 + ? = 1n | The total (`total`) | Gives the whole | The ten greyed, the loose berries lit | "14 is the whole. How many with the ten?" |
| 1n − 10 | The total, 14 (`total`) | Did not take the ten away | The ten flies off the tree, loose berries stay | "Take the ten away. What is left?" |
| 1n − 10 | n + 10 more (`up`) | Direction | The ten leaves, not joins | "Take away makes it smaller." |

Also (from the eval, candidate 3): four nests at every help level; all choices teen-shaped except one reversal at most, so no single odd one out.
Tap 2: arrow cards play the sum, then "Now you try". Because Tūī passes steps on `first_right` (8 of 10 first taps), shown goes do not count as first-right, as today.

### 3.7 Weka (make ten)

Model: stepping stones with the big rock at 10, "9 + 1 = 10, then + 6", pebbles in two ten-frames (`Goes.tsx`, `Pebbles.tsx`). Weka asks two things per full go: "how many hops to 10?" and "where will Weka land?" Both get tagged wrong choices (rebuilt in `shared/weka/round.ts`, keeping the server's rebuild check).

| Question | Wrong choice (kind) | The mistake | Show why | Voice line |
|---|---|---|---|---|
| Landing for 8 + 5 | 10 (`rock`) | Stopped at the ten | Weka on the rock; 3 more hops lit | "That is where Weka is. 3 more hops." |
| Landing | 10 + the whole small number (15) (`double`) | "Fills to 10 then adds the wrong leftover": did not take the 2 used | The 5 split into 2 and 3 on the bond | "5 is 2 and 3. The 2 got Weka to the rock." |
| Landing | big + the hops to ten, again (e.g. 10 for 8 + 2; or 11 for 8 + 3) (`part`) | Took the wrong part of the split | Pebbles: gold 8, silver 5 moved to fill ten | "8 and 2 make 10. We still have 3." |
| Landing | answer ± 1 (`off1`) | Counting hops by ones | Weka hops, each stone counted | "10, 11, 12, 13." |
| Hops to ten for 9 + 7 | The other number, 7 (`other`) | Counts the whole small number | Weka hops from 9: 1 hop to the rock | "Only 1 hop from 9 to 10." |
| Hops to ten | 10 (`ten`) | Mixes where Weka lands with how far | The rock highlighted | "10 is the rock. How many hops get there?" |
| Hop-back, 13 − 5 | 13 − 3 = 10 (`rock`) | Stopped at ten | Weka on the rock, 2 hops left | "That is the rock. Hop 2 more." |
| Hop-back | 13 + 5 = 18 (`add`) | Added | Hops go backwards along the line | "Hop back means go down." |

Tap 2: Weka hops the whole make-ten sentence with the pebbles filling the first frame, then "Now you try" (the same go at the child's own help; Weka's existing full/split/faint/none rules in `helpForStats`, `round.ts:101-108`, are not changed).
Existing: after 3 goes in a row with a wrong first tap, full help comes back for the rest of the round (`Goes.tsx:47, 97-99`); keep it.

## 4. Files affected

All inside each game's own folders (no shared file, no shared maths): for `<game>` in beanstalk, hop, korora, pipi, tui, weka:
- `shared/<game>/round.ts` (own choices with kinds; `play.ts` only if the replay needs to accept the extra redo taps, which it should not)
- `src/games/<game>/Goes.tsx` (Beanstalk: `Round.tsx` and `Leaf.tsx`; Hop: `Hops.tsx`), the show-why view, and its css
- `src/games/<game>/words.ts`, `voiceLines.ts`, `voiceLines.test.ts`; new clips in `public/voice/<game>/`
- `supabase/functions/<game>/index.ts` is rebuilt (`npm run build:functions -- <name>`; names: beanstalk, hop, korora, pipi, tui, weka). The check "index.ts is up to date" fails if forgotten.
- A short "Mistakes that teach" section in each game's plan doc (`docs/<GAME>-PLAN.md`).

No shared file needs James's OK. (A tiny helper shared across games would, so each game keeps its own copy of the 20-line flow; the logic is a counter of wrong taps and a state: `asking` / `why` / `shown` / `redo`.)

## 5. Database / migration needs

None. Taps (`taps` jsonb, `mistakes`) are already saved per finished round (`taps` and `mistakes` columns in each game's migration). A "shown" go is any go with 2 or more wrong taps in `taps`, so R7 can count it later with no new column. Deploying: merging the PR runs "Test and publish", which deploys the rebuilt function by itself (guide section 8, step 1). Say so in each PR.

## 6. Test steps

Automated (at most 8 per game; suggested 5 to 6):
1. Choices: every go of a seeded round has 4 choices, the right one among them, kinds tagged, and no choice from the removed kinds (for Penguin Pairs: no n × n).
2. Tell rule: for each game, the right answer is never the only choice sharing its shape (Hop: not only one ending in 0; Tūī: no lone non-teen).
3. Replay: a go with 2 wrong taps then right taps replays with the same result as today, and only the first tap is saved to the facts.
4. Flow state: after one wrong tap the tapped choice is gone; after two the state is `shown` and the choices come back; the redo's right tap does not change the fact record.
5. Voice: `voiceLines.test.ts` lists every new line, and every kind has a why-line.
6. Server: `handler.test.ts` still passes and the rebuilt `index.ts` is current.
Beanstalk adds: wrong-pair kind from the total (`over`, `under`, `close`, `digit`) for 10, 100 and 1000.

By playing the preview (`npm run <game>:preview`): make each kind of mistake on purpose and read the line and the picture; make 2 wrong taps and check the redo; tap all four and confirm it is no longer possible; finish the day and check the leaf still turns; check with Voice off and with the browser voice (no clips yet); check the finish screen and the teacher page still work.

## 7. Effort and impact

L overall (six games, about 120 voice lines each for Beanstalk and about 30 to 60 for the others), **Very high** impact: it fixes the single biggest gap, moves Feedback from 2 to 3 in six games, and makes guessing stop working.

## 8. Session prompts (ready to paste, one per game, each its own branch)

Do them in this order. Prompt 1 is the one in the JSON file.

### Prompt 1: Beanstalk (lowest score, do first)

```text
Work in /Users/jriley/games-hub-isles. Start by running: git fetch origin, then make your own worktree and branch from origin/main named r5-beanstalk-mistakes (see section 6 of the guide). Read /Users/jriley/games-hub-isles/CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, and the plan docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.2 are yours). Also read docs/reviews/maths-review/games/beanstalk.md and docs/reviews/maths-review/DECISIONS.md.

Build "mistakes that teach" for Kiwi's Beanstalk only:
1. In shared/beanstalk/round.ts: classify a wrong pair by its total against the target (over, under, close, digit) for targets 10, 100 and 1000; each tray of six leaves must have at least one close temptation; a wrong pair is remembered as tried so it cannot be tapped twice. Keep the server replay and the saved taps unchanged (only the first tap of a pair is scored to the facts).
2. In src/games/beanstalk/Round.tsx and Leaf.tsx: after wrong tap 1 show the two leaves' frames joining with the extra dots out or the empty squares glowing, and read the line. After wrong tap 2 play "Let's look together": one leaf pulses, its frame fills with the partner's dots, then ask "Now you try: what goes with N?" with the partner not marked. That pair counts for the round but is a shown pair, never a clean right.
3. Add every why-line to words.ts and voiceLines.ts (allVoiceLines loops for all pairs and the three targets), keep the lines short and in the style of the plan. Do not make clips yourself unless the Kokoro folder exists; tell James the exact command.
4. Add at most 8 tests (kind from total, removed duplicates not required, replay unchanged, tried pair cannot repeat, flow state, voice lines).
5. Rebuild the function with npm run build:functions -- beanstalk. Do not touch shared/maths, src/maths, src/styles.css, src/components or any other game.
6. Run typecheck, npm run test:changed, and play the preview (npm run beanstalk:preview) on bronze, silver and gold days and the 100 beanstalk, making each kind of mistake.
Stop and tell James before any live step. Open a PR when done and say in it that merging deploys the rebuilt beanstalk function. Add a short "Mistakes that teach" results section to docs/BEANSTALK-PLAN.md.
```

### Prompt 2: Hop

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r5-hop-mistakes. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.3 are yours) and docs/reviews/maths-review/games/hop.md.

Build "mistakes that teach" for Hop only:
1. In shared/hop/round.ts build the four glow-worm choices yourself (do not edit shared/maths/skillPacks/earlyFacts.ts): the answer, one choice on the same step (answer plus or minus one hop), and two misconceptions (off by one, the pad before, one hop too far, a different step's landing, and for counting back the number going up). Tag each with its kind. Never let one choice be the only one with the right ending. Keep the server's rebuild check satisfied (see showGo in shared/tui/round.ts for the pattern).
2. In src/games/hop/Hops.tsx: wrong tap 1 greys the choice out and shows the kind's picture on the pads and says its line. Wrong tap 2: Hop hops the whole row saying each number, the 100 board opens with the pads lit, then the same hop is asked again ("Now you try") at the child's own label level. Only the first tap is saved to the facts.
3. Add every line to words.ts and voiceLines.ts (per-fact lines for tens, fives, twos and the back hops, plus the generic ones).
4. At most 8 tests, rebuild with npm run build:functions -- hop, typecheck, npm run test:changed, and play the preview on all three steps and a gold day.
Stay inside Hop's own folders. Stop and tell James before any live step. Open a PR when done (merging deploys the rebuilt hop function).
```

### Prompt 3: Penguin Pairs (korora)

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r5-korora-mistakes. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.4 are yours) and docs/reviews/maths-review/games/korora.md.

Build "mistakes that teach" for Penguin Pairs (folder korora) only:
1. In shared/korora/round.ts build the four number stones yourself (do not edit the shared pack): doubles offer same, plus1, miscount, plus2 (n of 3 or more); halves offer all, miscount, minus2, double. Remove n times n. Tag each choice with its kind. Leave fair-or-not as it is (that is R9).
2. In src/games/korora/Goes.tsx: wrong tap 1 greys the stone out and shows the kind's picture (water fish, dealing to the chicks, counting) and says the line. Wrong tap 2: Bella explains the whole go with the full picture, then the same go is asked again ("Now you try") at the child's own help level. Only the first tap is saved to the facts.
3. Add the lines to words.ts and voiceLines.ts; at most 8 tests; rebuild with npm run build:functions -- korora; typecheck; npm run test:changed; play the preview on days 1, 11 and 21 (full, faint and no pictures).
Stay inside Penguin Pairs' own folders. Stop and tell James before any live step. Open a PR when done (merging deploys the rebuilt korora function).
```

### Prompt 4: Pipi

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r5-pipi-mistakes. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.5 are yours) and docs/reviews/maths-review/games/pipi.md.

Build "mistakes that teach" for Pipi's Hidden Shells only:
1. In shared/pipi/round.ts build the four shells yourself for hiding, altogether and two-tides goes (kinds: shown, whole, add when 20 or less, off1, part, before); tag each choice with its kind; keep the server rebuild check satisfied.
2. In src/games/pipi/Goes.tsx: wrong tap 1 greys the shell out and shows the kind's picture (outlines counted, showing group lit, whole glowing) and says the line. Wrong tap 2: the sand lifts, all pipi wave, the split is shown as "7 = 4 + 3" with matching colours, then the same go is asked again at the child's own help level. A tapped wrong shell can never be tapped again. Only the first tap is saved to the facts.
3. Add the lines to words.ts and voiceLines.ts; at most 8 tests; rebuild with npm run build:functions -- pipi; typecheck; npm run test:changed; play the preview on bronze, silver and gold days.
Stay inside Pipi's own folders. Stop and tell James before any live step. Open a PR when done (merging deploys the rebuilt pipi function).
```

### Prompt 5: Tūī

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r5-tui-mistakes. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.6 are yours) and docs/reviews/maths-review/games/tui.md. If R1 (the fading bug in shared/tui/round.ts placeAfter) is not merged yet, do not fix it here: tell James.

Build "mistakes that teach" for Tūī's Ten Tree only:
1. In shared/tui/round.ts showGo build four nests at every help level (not 3 at the low levels), from the kinds reverse, tens, ones, off1, total, up; tag each with its kind; no lone non-teen shape.
2. In src/games/tui/Goes.tsx: wrong tap 1 greys the nest out and shows the kind's picture (arrow cards for the reversal, two full frames for 20, the ten lit and then the berries, the ten flying off for a take-away) and says the line. Wrong tap 2: the arrow cards play the whole sum, then the same go is asked again at the child's own level. Keep pictureFor's extra help but never show the answer before tap 2. Shown goes do not count as first-right.
3. Add the lines to words.ts and voiceLines.ts (and make Hear it again say the same line as the go, eval candidate 8, only if it is a one-line change); at most 8 tests; rebuild with npm run build:functions -- tui; typecheck; npm run test:changed; play the preview on steps 1 to 5.
Stay inside Tūī's own folders. Stop and tell James before any live step. Open a PR when done (merging deploys the rebuilt tui function).
```

### Prompt 6: Weka

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r5-weka-mistakes. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/plans/maths-review/R5-mistakes-that-teach.md (sections 3.1 and 3.7 are yours) and docs/reviews/maths-review/games/weka.md.

Build "mistakes that teach" for Weka's Stepping Stones only:
1. In shared/weka/round.ts build the choices yourself (do not edit shared/maths/skillPacks/addSub.ts) for the landing question (kinds rock, double, part, off1), the hops-to-ten question (other, ten) and hop-backs (rock, add); tag each choice with its kind; keep the server rebuild check satisfied. Do not change helpForStats or the help rules.
2. In src/games/weka/Goes.tsx: wrong tap 1 greys the choice out and shows the kind's picture on the stones, the bond or the pebbles and says its line. Wrong tap 2: Weka hops the whole make-ten sentence with the pebbles filling the first frame, then the same go is asked again at the child's own help. Only the first tap is saved to the facts.
3. Add the lines to words.ts and voiceLines.ts; at most 8 tests (extend weka.test.ts, keep the wekaGuide test passing); rebuild with npm run build:functions -- weka; typecheck; npm run test:changed; play the preview on days 1, 11 and 21 and a hop-back go.
Stay inside Weka's own folders. Stop and tell James before any live step. Open a PR when done (merging deploys the rebuilt weka function).
```
