# Game kit catalogue

What the shared parts are and how a game uses them. The plan is [docs/plans/GAME-KIT-PLAN.md](../plans/GAME-KIT-PLAN.md); the rules the parts keep are in [docs/LEARNING-DESIGN.md](../LEARNING-DESIGN.md). More parts (models, junior bits, art tools) will be added here as their stages are built.

## Parts built so far

| Part | Where | What it does | Used by |
|---|---|---|---|
| Help that follows the child | `shared/kit/help.ts` | Help steps from a fact's record or from how rounds went, the teacher's fade / always / off, the boost after three wrong first taps | Weka |
| Tap replay | `shared/kit/replay.ts` | Replays a child's taps, scores the first tap of each go | Weka |
| Day arc | `shared/kit/dayArc.ts` | Bronze, silver and gold days, the golden reward, New Zealand dates | Weka |
| Mistakes that teach | `shared/kit/mistakes.ts` | Wrong choices with a kind, the "at most 2 share the tell" check, near-miss check, the two-tap flow | Beanstalk, Penguin Pairs |
| Show why | `src/kit/ShowWhy.tsx` | `ShowWhy`, `LookTogether`, `NowYouTry` and `useLookTogether` (the timing of "Let's look together") | Beanstalk, Penguin Pairs |
| Junior bits | `src/kit/` `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `WhatsNext`, `FirstTimeTip`; test helper `voiceLinesSuite` | Hear it again button, the pointing hand and its "try this one" label, the first-go hand timing, the end-of-round panel, a helper's first-time tip, the four voice-clip checks. A game passes its words, clip folder and CSS prefix | Weka (all but `FirstTimeTip`) |

### Using mistakes and show-why in a game

1. In the game's `shared/<game>/round.ts`, build each go's choices as `Wrong<YourKind>` values (`tagWrongs` drops the right answer and repeats). Never edit the shared maths packs from a game branch; build the choices in the game, so the server rebuilds the same ones from the seed.
2. Check the choices with `atMostShareTell(answer, choices, tellOf)`: at most 2 of them (the answer included) share the tell (same ending, same parity, same teen shape). Where a tray of choices should always hold a tempting slip, use `hasNearMiss`.
3. In the screen, keep a go's place with `stepGo(state, 'wrong' | 'right' | 'lookDone')`. First wrong tap: phase `why`. Second: `look`, and taps are off. After the look: `redo` ("Now you try"; wrong taps show why again but never look again). A right tap starts a new go.
4. Show it with `ShowWhy` (first wrong tap), `LookTogether` (second) and `NowYouTry`, passing the picture, the lines and your CSS prefix (`bs`, `wk`...). Start the look with `useLookTogether(say).start({ anchor, steps, openingLine, fillLine, onEnd })`.
5. Words and clips belong to the game: add every line to the game's `words.ts` and `voiceLines.ts`, run its `voiceLines.test.ts`, then make the clips. `say` plays them from the game's own `public/voice/<game>/` folder.
6. Counting stays as it is: only the first tap of a go is saved as the child's answer (`replayTaps`), so a shown go is never a clean right.

## The misconception bank

One entry per mistake kind: what it looks like, why a child makes it, and how to show why. The kind is the tag on the wrong choice (`Wrong.kind`); the line is read aloud by Bella and written in the game's `words.ts`. Source: `docs/plans/maths-review/R5-mistakes-that-teach.md` (sections 3.2 to 3.7), the research in `docs/reviews/maths-review/`, and the Beanstalk build. "Built" marks kinds that are live.

### Bonds to 10, 100 and 1000 (pairs of numbers, built in Beanstalk)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `over` (built) | A pair two or more units too big: 4 and 8 | Both frames slide together; the first fills and the extra dots hang out, glowing | "4 and 8 make 12. That is too many." |
| `under` (built) | A pair two or more units too small: 3 and 4 | Frames join; the empty squares glow | "3 and 4 make 7. Not enough." |
| `close` (built, bonds to 10) | One unit off: 4 and 7 | Same, one dot out or one square empty | "4 and 7 make 11. Just one too many." |
| `digit` (built, 100 and 1000) | Treats tens as ones: 30 and 60 = "10 tens" | Frames labelled in tens; 3 tens and 6 tens is 9 tens, one square empty | "30 and 60 make 90. 3 tens and 6 tens is 9 tens, not 10." |

Look together: one leaf pulses, its frame fills with its partner's dots, counted ("7 and 1, 2, 3 more make 10"), then "Now you try: what goes with 7?".

### Skip counting (Hop)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `off1` | 39 or 41 for 40: counts the jump as the starting number | Hop jumps from the pad before the gap; the arc is lit; the wrong number sits one step beside the pad and fades | "30, then 10 more is 40, not 39." |
| `stay` | The pad before (30 for 40): did not hop | Hop stays; the arc shown empty | "That is where Hop is. Hop has to jump." |
| `far` | One hop too far (50 for 40): skipped a pad | Hop jumps to the gap, then a ghost hop beyond it | "That is two hops. We need one hop." |
| `step` | Lands by a different step (+5 on tens, +2 on fives): loses the step | Arc label changes to the right step; the wrong landing is crossed off the 100 board | "We are counting in tens. Each hop is 10." |
| `way` | Counting back, the number goes up: direction | The arc flips to point left | "We are counting back, so we go down." |

### Doubles and halves (Penguin Pairs, built 7 Nov 2026: all seven kinds below are live)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `same` | Double n gives n: forgot to double | Rock fish lit; water fish appear and join the count | "Double 3 is 3 and 3 again." |
| `plus1` | Double n gives n + 1 | Water fish count along; one fish in the rock row shown too many | "Double means the same again, not one more." |
| `plus2` | Double 6 = 8: doubling mixed up with adding 2 (n of 3 or more) | Rock and water rows side by side, equal | "Double is two lots of 6, not 6 and 2." |
| `miscount` | 2n ± 1, or n/2 ± 1: counted a fish wrong | Bella lights each fish while counting | "Let's count them: 1, 2, 3, 4, 5, 6." |
| `all` | Half of n gives n: did not share | All the fish go to the chicks one each; one nest lit | "That is all the fish. Half is one chick's share." |
| `minus2` | Half of n gives n − 2: took 2 away | Fish dealt into two equal groups | "Half means two equal groups." |
| `double` | Half gives 2n: halved and doubled mixed up | The pile gets smaller as it is shared | "Half is smaller. The pile goes into two nests." |

n × n (25 for 5 + 5) is not a doubles slip: leave it out.

### Part and whole (Pipi)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `shown` | Answers with the part showing | Showing pipi lit, hidden outlines dashed and counted | "4 are showing. How many are hiding?" |
| `whole` | Answers with the total | All pipi glow, then the showing ones step aside | "7 is all the pipi. Some are hiding." |
| `add` | Whole + showing (when 20 or less): "and" and "left" mixed up | Shows 7 and 4 would be 11, more than 7 | "We started with 7. The answer cannot be more." |
| `off1` | Answer ± 1: counted the outlines off by one | Outlines counted aloud, slowly | "Look: 1, 2, 3 hiding." |
| `part` | One part alone when asked altogether | The showing group and the popped-up group join | "4 here and 3 popped up. Together that is 7." |
| `before` | The number from the first tide: did not see the split change | Both tides shown, same whole | "The whole stays 7. Only the split changes." |

### Teen numbers (Tūī)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `reverse` | 41 for 14: writes 31 for 13 | Arrow cards show 4 tens and 1 one beside the real 14 | "41 is four tens and one. We have one ten and four." |
| `tens` | A round ten (20 for 12): teen and "-ty" mixed up | Two full ten-frames next to the one we have | "That is two tens. We have one ten." |
| `ones` | n alone: reads only the loose berries | Ten-frame lit, then the berries | "That is just the loose berries. Add the ten." |
| `off1` | n ± 1: counted by ones, slipped | Berries counted in from the ten | "Ten, then 1, 2, 3, 4: 14." |
| `total` | The whole when asked for a part, or when taking the ten away | The ten greyed, loose berries lit (or the ten flies off) | "Take the ten away. What is left?" |
| `up` | n + 10 when taking away: direction | The ten leaves, not joins | "Take away makes it smaller." |

At most one reversal among the choices, and every choice teen-shaped, so no single choice stands out.

### Making ten (Weka)

| Kind | Looks like | Show why | Line (example) |
|---|---|---|---|
| `rock` | Stops at 10 for 8 + 5 | Weka on the rock; the 3 more hops lit | "That is where Weka is. 3 more hops." |
| `double` | 15 for 8 + 5: fills to 10 and adds the whole small number | The 5 split into 2 and 3 on the bond | "5 is 2 and 3. The 2 got Weka to the rock." |
| `part` | Takes the wrong part of the split | Pebbles: gold 8, silver 5 moved to fill ten | "8 and 2 make 10. We still have 3." |

See R5 section 3.7 for the hops-to-ten question and the remaining kinds.

### Rules that go with every kind

- The wrong choice greys out and cannot be tapped twice. Grey and calm, never a red cross.
- Wrong tap 1: the why-line and the picture. Wrong tap 2: "Let's look together", then "Now you try". The redo is never a fact answer.
- At most 2 of the choices share the right answer's tell.
- The finished round still turns its leaf, pad or stone: a shown go never costs the child the day.
