# Ruru's Number Trail (the number line: one more, one less, which is more, where it goes) — plan

Short id `ruru`. **Status: Stage 0, plan written 5 Nov 2026 (this version replaces the short first plan).** Game E in
`docs/EARLY-GAMES-PLAN.md`; the parts every early game shares are in section 7 there and aren't repeated here. Built the
same way as Tūī's Ten Tree (`docs/TUI-PLAN.md`) and Weka's Stepping Stones (`docs/WEKA-PLAN.md`): same look, voice, words
and way of fading help.

**Settled by James (4 and 5 Nov 2026):** the look and voice are Kiwi's Beanstalk's (clay, style B, and Bella); supports
and structure fade, and the help follows the child's results, not the days (his choice for Tūī and Weka). James paints the
final pictures in ComfyUI in the evening, so the build uses stand-ins drawn in code (`docs/RURU-ART-PLAN.md`,
`scripts/ruru-art.py`).

## 1. The game in plain words

Ruru, the morepork owl from Kiwi's Beanstalk (purple scarf), flies along a moonlit trail of fence posts at night, carrying
moths home to her two owlets. The posts stand in one straight line, left to right, numbered in order from 0.

- **Today's challenge, about 10 goes.** Four kinds of question, met one at a time (section 3):
  - **One more:** "Ruru is on 12. Fly to **one more** than 12." The child taps post 13.
  - **One less:** "Fly back to **one less** than 12." (Ruru turns round.)
  - **Which is more:** two owlets each hold up a number. "Which owlet has **more** moths, 9 or 14?" The child taps one.
  - **Where does it go:** the trail has only its ends numbered. "Drop the moth where **7** goes." The child taps a place
    on the line; close enough counts (section 3).
  A right answer: Ruru swoops to the post saying the number, the owlets hoot. A wrong one wobbles back and the trail
  helps a little more (section 4). No penalty, and the answer is never shown or said.
- **The magic things.** 10 lanterns hanging on the posts turn bronze, silver, then gold, one a day (the shared 30 days).
- **The win.** The Golden Moon on day 30. Then a new friend's trail (section 7).
- **Gold days finale, not recorded:** after the 10 goes, Ruru flies the whole trail home backwards while Bella counts
  back with the child ("twenty, nineteen, eighteen ... zero"). Counting back is the part young children find hardest.

## 2. What the research says, and what the game does about it

1. **A straight, numbered, left-to-right line builds number sense** (Siegler and Ramani 2008, 2009): about an hour of a
   simple linear number board game (1 to 10) improved young children's number-line estimates, comparing, counting and
   reading numbers, and the gains lasted; the same game on a circular board did not help.
   **So:** the trail is always one straight line, numbers growing to the right, posts evenly spaced, never a winding path.
2. **Children learn what they say as they move** (Laski and Siegler 2014, "you learn what you encode"): children who
   counted on from the number their counter stood on ("thirteen, fourteen") learned much more than children who counted
   "one, two" for the moves. **So:** every hop says the number Ruru lands on, and when the game counts with the child it
   counts on from Ruru's post, never from 0 and never "one, two".
3. **A number track and a number line are different pictures.** On a track each number sits in a space you count; on a
   line the numbers mark points and you count the gaps (hops), so children often count the post they start on and land
   one out (NCETM; Oak National Academy, "Explain where 6, 7, 8 and 9 lie on a number line", which moves from a track to
   a line on purpose). **So:** the most-help level is a **track** (each number on its own glowing lantern square), the
   trail then becomes posts on a line in a short "the squares become posts" moment, and a hop is drawn as one arc over
   one gap: "one hop, one more".
4. **One more and one less are the next and the previous counting number** (NCETM Mastering Number; NZ curriculum Phase 1,
   Years 1 and 2: read, order and say one more and one less for numbers to 20, and count forwards and backwards). One less
   is harder than one more because counting back is harder. **So:** one more comes first, one less is its own step, and
   gold days end with a count back.
5. **"More" is learnt before "less"** (Donaldson and Balfour 1968; early-years practice says "more" and "fewer" before
   "less"). **So:** "which is more?" comes first; "which is less?" joins only in the mixed step, about 3 goes in 10.
6. **Far apart is easier to compare than close together** (the distance effect, Moyer and Landauer 1967; Sekuler and
   Mierkiewicz 1977), and quick, sure comparing of written numbers predicts later maths (Schneider and others 2017,
   meta-analysis). **So:** comparing starts with far pairs (3 or 17), then middle pairs, then neighbours (13 or 14), from
   each child's own record (section 3). While help is on, both numbers light up on the trail: "further along the trail
   is more" (Clements and Sarama's comparing trajectory: from counting to the mental number line).
7. **Placing numbers on an empty line grows from "squashed" to even** (Siegler and Opfer 2003; Siegler and Booth 2004):
   young children squash big numbers together and spread small ones out, and the even picture arrives at 0 to 10 and 0 to
   20 before 0 to 100. How evenly a child places numbers predicts their sums later (Booth and Siegler 2008). **Feedback on
   where the number really goes moves children on quickly** (Opfer and Siegler 2007), and children who use the middle of
   the line as a landmark place numbers better (Peeters, Degrande, Ebersbach, Verschaffel and Luwel 2016).
   **So:** after every "where does it go?" tap, a lantern lights where the number really is, and Ruru flies from the
   child's tap to it; the help shows the middle mark first and fades it last.
8. **Help should follow the child, and come away once they can do it** (Wood, Bruner and Ross 1976; van de Pol, Volman
   and Beishuizen 2010; Kalyuga's expertise reversal: help a child no longer needs slows them down). **Concrete, then
   picture, then symbols, with the links shown** (concreteness fading, Fyfe, McNeil, Son and Goldstone 2014).
   **So:** six help levels (section 4) that move with the child's results, from the track, to a labelled line, to a line
   with only landmarks, to "one more than 12 = ?" in numbers, with the number line still a tap away ("Peek").
9. **Say it the same way every time** (NCETM stem sentences, as Tūī and Weka): "One more than 12 is 13." "14 is further
   along, so 14 is more." After a right answer with help, Bella says the te reo number too ("Tekau mā toru"), matching
   Tūī and Weka.

## 3. The maths

### Shared maths needed (its own small branch, live before the game: stage 1)

New families in `shared/maths/skillPacks/earlyFacts.ts`, all `ladderOnly` (only Ruru asks them):

| Family | Keys | The question | Wrong choices (used at help levels 0 and 1) |
| --- | --- | --- | --- |
| `more1` | `more1:0` to `more1:19` (20) | `["One more than", "12", "=", "?"]`, spoken "one more than twelve" | n − 1, n, n + 2, and the teen slip (21 for 12) where it makes sense |
| `less1` | `less1:1` to `less1:20` (20) | `["One less than", "12", "=", "?"]` | n + 1, n, n − 2 |
| `cmp` | `cmp:a-b`, a < b, both 0 to 20: 36 chosen pairs, 12 far (8 or more apart), 12 middle (3 to 7), 12 near (1 or 2), each group half to 10 and half to 20 | a pick-one question like odd and even: `["Which is more:", "9", "or", "14?"]`, `pick: ["9", "14"]`, the answer is the index. Variant 0 smaller first, 1 bigger first, 2 and 3 "Which is less" | the other number |
| `line10`, `line20` | `line10:1` to `line10:9`, `line20:1` to `line20:19` (28) | `["Where does", "7", "go on 0 to 10?"]`, answer 7 | none: the child taps a place |

**The "close enough" mark: the game's own rule, recorded as plain right or wrong.** The shared question shape keeps one
right answer, so nothing else on the hub changes. Ruru marks a "where does it go?" tap right when it lands within a tenth
of the line from the true place (within 1 on 0 to 10, within 2 on 0 to 20), and sends `recordMathsAnswers` a plain right
or wrong. The tap position (to one decimal place) is saved with the round so the teacher can see how far off a child was.

Ladder skills (`shared/maths/ladder.ts`), next to `parts-5` and `odd-even`, all `inWarmUp: false, inAuto: false` (an
older student's auto practice never meets them): `more-less-20` (more1 and less1), `compare-20` (cmp) and
`number-line-20` (line10 and line20). Curriculum tags `MS.Y1.NUM...` checked against the NZ curriculum in stage 1.
One test (`earlyFacts` round trip for each new family, plus the close-enough rule).

### Steps (the questions grow), from the child's own results, never dropping back

The server saves the furthest step `reached`, like Hop, Pipi and Tūī.

| Step | Name | Trail | New kind (about 7 of 10 goes) | Earlier kinds (about 3) |
| --- | --- | --- | --- | --- |
| 1 | One more | 0 to 10 | one more | — |
| 2 | One less | 0 to 10 | one less | one more |
| 3 | Which is more | 0 to 10 | which is more (far pairs first) | one more, one less |
| 4 | The long trail | 0 to 20 | one more and one less past 10 | which is more to 10 |
| 5 | More on the long trail | 0 to 20 | which is more to 20 (far, then middle, then near) | one more, one less to 20 |
| 6 | Where does it go? | 0 to 10, then 0 to 20 | where does it go | all the rest |
| 7 | All mixed | 0 to 20 | weakest facts first, "which is less" joins | — |

- A step is passed after **two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule).
- Inside a kind, the facts come weakest first (low Leitner box first), and comparing pairs come far, middle, near: a
  near pair is only asked once the child has the far pairs of that trail at box 2 or more.
- One more and one less on the long trail lean on the crossings that trip children up: 9 to 10, 10 to 11, 19 to 20, and
  the teens (one more than 13).
- **A child who already knows it** (at their first go, `facts-10` passed on the ladder, or 30 of the 40 one more and one
  less keys at box 2 or more) starts at step 4 and help level 2, so the game doesn't babysit them.
- **Recording** (Way A, shared section 7): each go is recorded once with `recordMathsAnswers`, right only if the first tap
  was right (or close enough). A go that needed more help after a wrong tap is still recorded as wrong.

## 4. Supports that fade

Two things fade, slowly and separately: the **trail** (six help levels) and the **voice**. One thing never fades: after
every right answer Ruru does the hop (or flies to the place) and Bella says the sentence ("One more than 12 is 13"). It is
the explanation, not a crutch (like Tūī's arrow cards).

### The six help levels

| Level | Name | One more and one less | Which is more | Where does it go |
| --- | --- | --- | --- | --- |
| 5 | The lantern track, counted | Every number on its own glowing square. A dotted arc leaves Ruru's square the right way ("one more goes this way"), not landing. Bella: "Ruru is on twelve. One more..." | Both numbers light on the track and Ruru flies along from 0 to the first, then on to the second | Every post numbered: "find 7" |
| 4 | The lantern track | The same track, no counting voice; the arc stays | Both numbers light on the track | Every post marked, numbered every 5 |
| 3 | Posts on a line | The squares become posts on a line (a short moment the first time). Numbered every 5 (0, 5, 10, 15, 20) and Ruru's own post. The arc shows one gap | Both numbers light on the line, the 5s numbered | Posts unnumbered, a tall middle post (5 or 10) |
| 2 | Landmarks | Only 0, 10, 20 and Ruru's own post numbered | Both numbers light on a faint line | Only the ends and a small middle mark |
| 1 | Numbers, with a peek | "One more than 12 = ?" with 4 moth cards. A lantern button, **Peek**, brings back level 3's line for that go | "9 or 14?" only, with Peek | Only the ends numbered |
| 0 | Numbers only | "One more than 12 = ?" | "9 or 14?" | Only the ends numbered |

From level 3 down, the written words ("one more than 12") sit beside the picture, so the symbols are learnt while the
picture is still there (concreteness fading). "Where does it go?" never goes to numbers only: the empty line is the task.

### How a child's help level moves (between challenges)

The same rules as Tūī's Ten Tree:

- A new child starts at **level 5** (or level 2 if they already know it, section 3).
- After each day's first challenge (the counted one): **8 or more of 10 right at the first tap** is a *good* challenge;
  **two good challenges in a row** take the child down one level. **4 or fewer right** is a *hard* challenge: up one level
  straight away. Anything else: stay. So going from 5 to 0 takes at least ten school days.
- **A new step (section 3) puts help back up two levels** (to at most 5), and **the first time the long trail (step 4)
  or "where does it go?" (step 6) appears, help goes up to at least 3**: a new picture needs its landmarks, then they fade
  again.
- The server saves the level in `ruru_progress`. Play-again goes later that day use the same level and never move it.

### Help inside one go (a wrong tap)

- First wrong tap: the post wobbles back and the trail goes **up one level** for this go (at level 1 the Peek opens by
  itself; on "where does it go?", the middle mark appears).
- Second wrong tap: up to **level 5** for this go, and Bella counts on from Ruru's post with the child ("twelve...
  thirteen") or, for "which is more", flies along the trail past both numbers.
- Third wrong tap: on one more and one less only Ruru's two neighbour posts stay bright; on "which is more" the owlets
  hoot in turn. The answer is never shown or said.
- On "where does it go?" a tap is never wrong twice: after the first try the true place lights, Ruru flies there from the
  child's tap and Bella says "7 goes here, a little closer to 10" (the feedback from section 2, point 7). The go is
  recorded from the first tap.
- After three goes in a row with a wrong first tap, level 5 stays for the rest of the round (Weka's rule).

### The colours, the voice and the teacher

- **The colours mark days, not skill** (the shared 30 days, Tūī's choice): a gold day can still show the track for a
  child who needs it.
- **The voice fades with the level:** level 5 counts on with the child; levels 4 to 1 read the question; level 0 says only
  "One more?" and the child reads the numbers. The speaker button reads the full question again at any level. Bella
  says the te reo number after a right answer at levels 5 to 3. The game's own mute: `ruru-voice`.
- **Teacher settings** (drawer): trail help **Fades / Always / Off** (`ruru_help`, Fades by default, like Penguin Pairs,
  Tūī and Weka). Always keeps level 4; Off means level 0 and no Peek, but a wrong tap still brings the trail back for that
  go. The student line shows the step and help level ("Step 5 More on the long trail, help level 2"), the hardest facts,
  and how far off their last "where does it go?" taps were.

### Screens

- Wide screens (Chromebooks, iPads): the whole trail in one line, 0 to 10 or 0 to 20 (21 posts at about 60 px apart on
  1366 px).
- Narrow phones in portrait: one more, one less and which is more show an 11-post window of the trail that slides with
  Ruru (the line must stay straight, so no two rows). "Where does it go?" asks the child to turn the phone sideways, or on
  0 to 20 uses the full width with the 2-post tolerance.

## 5. Rules (`shared/ruru/`)

- `round.ts`: `stepFor(records, reached)`, `levelAfter(level, lastResults, stepChanged)` (copied from Tūī),
  `makeRound(seed, records, step)` (10 goes: kind, fact and trail for each, weak first, 7 new and 3 old, comparing pairs
  far before near), `showGo(go, level, wrongTaps)` (track or line, which posts numbered, arc, middle mark, peek, choices),
  `closeEnough(n, tap, trailEnd)`.
- `play.ts` (replay the taps; a "where" tap is a position), `progress.ts` (`trailAfter`, copied from Tūī's `treeAfter`),
  `server.ts` (`handleRuru`: load, start, finish; saves `reached`, `level`, `good_in_row`, `played`).
- **Tests (at most 8):** Hop's 4 rule tests (round, replay, 30 days, finish), plus help down after two good and up after a
  hard one, up two on a new step, a wrong tap raising the go's level, and the close-enough mark at the edges (6 and 8
  right for 7 on 0 to 10, 5 wrong).

## 6. Look and voice

Clay, like Kiwi's Beanstalk (style B), at night: a deep blue sky and a big moon, but the trail itself is light (pale
posts, cream lantern squares) with dark numbers, so the numbers read clearly on a Chromebook. Numbers are always drawn in
code. Ruru is the Beanstalk Ruru (same words in the painting script, purple scarf); Beanstalk's two painted Ruru pictures
are reused as the first stand-ins. Bella reads everything (`public/voice/ruru/`, about 350 lines: the numbers 0 to 20,
the question and sentence lines, te reo numbers). Pictures: `docs/RURU-ART-PLAN.md` (21 to paint; Ruru's wait and cheer, Kiwi, Wētā and Tuatara are reused).

## 7. Guided first go, friends and achievements

- **Guided first go:** the very first question is always "one more than 3" on the lantern track. The hand points at
  Ruru on 3, then at square 4, and goes after the first right tap.
- **Friends** after each Golden Moon, night creatures who come out on the trail: Kiwi, Kākāpō, Pekapeka (the long-tailed
  bat), Wētā and Tuatara. Kiwi, Wētā and Tuatara are already painted for Hop and Beanstalk and are reused.
- **Achievements:** one per Golden Moon, per friend. No hub points.

## 8. Stages

0. This plan, the art plan and `scripts/ruru-art.py`.
1. **Shared maths branch:** the new families, the close-enough rule, the three ladder skills, one test. Live on its own,
   first.
2. Rules and tests (`shared/ruru/`).
3. Play screen with clay stand-ins, preview (`npm run ruru:single`).
4. Server: migration `ruru` (take the next free number after main's latest), function `supabase/functions/ruru/`,
   pgTAP test.
5. Hub (group `foundational`), teacher settings, guided first go, the Golden Moon moment, Bella's voice.
6. Go live (on for every class by default). Paintings go in whenever James has painted them.

## 9. Settled

- **Stop at 20** (James, 5 Nov 2026): the game covers the 0 to 10 and 0 to 20 trails only. A trail to 100 can be a later
  game; Hop already has the hundreds board.

## Sources

- Siegler, R. S. and Ramani, G. B. (2008), "Playing linear numerical board games promotes low-income children's
  numerical development", Developmental Science 11(5); (2009) "Playing linear number board games, but not circular ones,
  improves low-income preschoolers' numerical understanding", Journal of Educational Psychology 101(3).
- Laski, E. V. and Siegler, R. S. (2014), "Learning from number board games: You learn what you encode", Developmental
  Psychology 50(3): https://www.cmu.edu/dietrich/psychology/cs/research-teaching/docs/2013LaskiSieglerNumberBoardGames.pdf
- Siegler, R. S. and Opfer, J. E. (2003), "The development of numerical estimation", Psychological Science 14(3);
  Siegler, R. S. and Booth, J. L. (2004), "Development of numerical estimation in young children", Child Development 75(2).
- Opfer, J. E. and Siegler, R. S. (2007), "Representational change and children's numerical estimation", Cognitive
  Psychology 55(3).
- Booth, J. L. and Siegler, R. S. (2008), "Numerical magnitude representations influence arithmetic learning", Child
  Development 79(4).
- Peeters, D., Degrande, T., Ebersbach, M., Verschaffel, L. and Luwel, K. (2016), "Children's use of number line
  estimation strategies", European Journal of Psychology of Education 31.
- Moyer, R. S. and Landauer, T. K. (1967), "Time required for judgements of numerical inequality", Nature 215;
  Sekuler, R. and Mierkiewicz, D. (1977), "Children's judgments of numerical inequality", Child Development 48.
- Schneider, M. and others (2017), "Associations of non-symbolic and symbolic numerical magnitude processing with
  mathematical competence: a meta-analysis", Developmental Science 20(3).
- Donaldson, M. and Balfour, G. (1968), "Less is more: a study of language comprehension in children", British Journal of
  Psychology 59(4).
- Oak National Academy, "Explain where 6, 7, 8 and 9 lie on a number line":
  https://www.thenational.academy/teachers/programmes/maths-primary-ks1/units/composition-of-numbers-6-to-10/lessons/explain-where-6-7-8-and-9-lie-on-a-number-line
- NCETM, Mastering Number overview: https://axis.ncetm.org.uk/media/qytg0juv/mastering-number-reception-overview.pdf
- Clements, D. H. and Sarama, J., Learning and Teaching Early Math: The Learning Trajectories Approach (Routledge).
- Wood, D., Bruner, J. and Ross, G. (1976), "The role of tutoring in problem solving"; van de Pol, J., Volman, M. and
  Beishuizen, J. (2010), "Scaffolding in teacher–student interaction: a decade of research", Educational Psychology
  Review 22; Kalyuga, S. (2007), "Expertise reversal effect", Educational Psychology Review 19.
- Fyfe, E. R., McNeil, N. M., Son, J. Y. and Goldstone, R. L. (2014), "Concreteness fading in mathematics and science
  instruction: a systematic review", Educational Psychology Review 26.
- NZ Ministry of Education, Mathematics and Statistics curriculum, Phase 1 (Years 0 to 3), 2025:
  https://newzealandcurriculum.tahurangi.education.govt.nz/
