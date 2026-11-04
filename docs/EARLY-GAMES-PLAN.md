# More early-skills games (ages 5 to 7): research and shortlist

Written 4 Nov 2026 from James's ask: "now I have Beanstalk and Hop, focusing on key early skills, brainstorm, research and
plan a few more games that address similar early skills." **Nothing is built yet.** This file picks the gaps, gives a
shortlist, and suggests an order. James picks the first one; that game then gets its own `docs/<GAME>-PLAN.md`, built the
way `docs/BEANSTALK-PLAN.md` and `docs/HOP-PLAN.md` were.

## 1. What we already have

| Game | Skill | Maths keys / ladder |
| --- | --- | --- |
| Quick looks (Training) | Subitising: seeing 1 to 10 without counting | its own stages, `docs/SUBITISING-PLAN.md` |
| Kiwi's Beanstalk | Bonds to 10, then 100 and 1000 | `bond10`, then `bond100`/`bond1000` → `facts-10`, `bonds-100`, `bonds-1000` |
| Hop's Glow-worm Pond | Skip counting in 10s, 5s, 2s | `skip10/5/2` → `skip-10/5/2` |
| Bond Match | Bonds (any total) as a memory game | bond keys |

Ladder skills that are **already built in `shared/maths` but no early game practises yet**: `dbl-half-10`,
`dbl-half-20` (doubles and halves), `ten-and` (10 + 4, teen numbers), and `facts-20` (bonds to 20 and adding and taking
away within 20).

## 2. What the research says children of 5 to 7 need

Three sources agree closely on the early number "big ideas":

- **NZ Mathematics and Statistics curriculum (2025, Phase 1, Years 0 to 3).** Year 1 and 2 number work: counting forwards
  and backwards and knowing the last number counted is "how many"; subitising; one more and one less; comparing and
  ordering numbers; putting together and splitting numbers to 10 (then 20); "ten and" facts and teen numbers as ten and
  some more; doubles and halves; skip counting; numbers on a number line; tens and ones to 100. The hub's tags
  (`MS.Y1.NUM.OP.P1`, `P2`, `P6`) already follow it.
- **NCETM Mastering Number (England, Reception to Year 2).** Four strands, practised a few minutes every day: subitising,
  counting, **composition** (every number is made of smaller parts: 7 is 5 and 2, 4 and 3), and comparison. Then in
  Years 1 and 2: the linear number system (number lines), the structure of numbers to 20 using 5 and 10, doubles and
  near doubles, odds and evens, and adding by **making ten** (8 + 5 = 8 + 2 + 3).
- **Clements and Sarama, Learning Trajectories (US research).** Counting, subitising, comparing and ordering,
  composing and decomposing numbers, then adding and subtracting, then place value. Related work by **Siegler and
  Ramani** found that short, linear number board games (spaces in a straight line, numbered in order) noticeably improve
  young children's sense of how big numbers are, in only a few sessions.

The pattern across all three: **part-whole thinking (composition) is the foundation**, and short daily practice works
best. Beanstalk and Hop already fit "short and daily".

## 3. The gaps

| Big idea | Covered by | Gap? |
| --- | --- | --- |
| Subitising | Quick looks | no |
| Bonds to 10 | Beanstalk | no |
| Skip counting | Hop | no |
| **Part-whole within 10** (7 is 4 and 3) | nothing | **yes, the biggest** |
| **Doubles and halves** | maths built, no game | yes |
| **Teen numbers as ten and some more** | maths built, no game | yes |
| **Making ten to add within 20** | maths built (`facts-20`), no early game | yes |
| **One more, one less, comparing** | nothing | yes |
| **Number line to 20, then 100** | nothing | yes |

## 4. Shortlist

All five keep the frame children already know from Beanstalk and Hop: a NZ creature, a short daily challenge (about 10
goes), 10 big magic things that turn bronze, silver then gold over 30 counted days, a prize at the end, help that fades
(full on bronze, faint on silver, none on gold), no penalty for a wrong tap, reading aloud, the server making and marking
every round (the guide's way A), a per-class teacher switch, and the `easy-maths` group. So each one reuses
`shared/beanstalk`'s `progress.ts` pattern and Hop's round/play/replay pattern.

### A. Pipi's Hidden Shells: part-whole within 10 (recommended first)

- **Skill:** composition. "There are 7 pipi. 4 are showing. How many are hiding under the shell?" This is the step
  underneath bonds to 10, and the one strand of Mastering Number we have nothing for.
- **Play:** on the beach, a known number of pipi (shown with a big number and dots) go into a row. A wave or a gull
  flips a shell over some of them. The child taps the number of pipi hiding. A right answer lifts the shell and the pipi
  wave. Wholes move up as they get them right: 3 to 5 first, then 6 to 10. Gold days add "how many altogether?" with
  both parts hidden one after the other.
- **Fading help:** bronze shows the pipi in a five-frame or ten-frame (links to Quick looks), silver shows them in a
  loose row, gold shows only the numbers.
- **Maths fit:** new family `part` in `earlyFacts.ts`, keys like `part7:4` (7, 4 showing, answer 3), wholes 3 to 10.
  New ladder skills `parts-5` and `parts-10` placed before `facts-10`, `inWarmUp: false` like the skip skills. **Needs a
  small shared-maths branch first** (the guide's rule), the same route Hop took (PR #163).
- **Prize:** the Golden Pearl. **Friend:** a tuatara, a kororā (little penguin) and so on.

### B. Kororā's Mirror Pool: doubles and halves

- **Skill:** doubles to 10 + 10 and halves of even numbers to 20, the base for near doubles (6 + 7) and the ×2 table.
- **Play:** a little penguin looks into a still rock pool. Fish (or shells) are on one side; the pool shows their
  mirror. The child taps the total: "double 4". Halves: share the fish fairly between two penguin chicks, tap how many
  each gets. Gold days mix in "odd or even?" (can it be shared fairly?).
- **Fading help:** bronze shows both the fish and their reflection, silver shows a faint reflection, gold shows none.
- **Maths fit:** **no shared-maths change.** Uses the existing `dbl:` and `half:` keys and the built ladder skills
  `dbl-half-10` then `dbl-half-20`. Quickest of the five to build.

### C. Tūī's Ten Tree: teen numbers as ten and some more

- **Skill:** place value of teen numbers. 14 is 10 and 4. "Ten and" facts. This is what lets children add within 20
  without counting on their fingers.
- **Play:** a tūī collects berries. A full branch always holds exactly 10 (a ten-frame), loose berries sit beside it.
  The child taps the number (10 and 4 → 14), or on silver and gold days goes the other way: "16 is 10 and ?". On gold
  days, two full branches appear for 20.
- **Fading help:** bronze shows every berry, silver shows the full branch as one bar labelled 10, gold shows only "10 + 4".
- **Maths fit:** **no shared-maths change.** Uses the existing `tenand:` keys (all four ways they are asked already
  exist) and the ladder skill `ten-and`. Later it can grow into tens and ones to 100 (that part would need new maths).

### D. Weka's Stepping Stones: making ten to add within 20

- **Skill:** add by bridging through 10: 8 + 5 = 8 + 2 + 3. Then the matching take-aways (13 − 5).
- **Play:** a weka crosses a stream on stones. Stone 10 is a big flat rock in the middle. To get from 8 to 13, the weka
  jumps to the big rock first (+2), then on (+3). The child taps the answer, and on bronze days taps the two jumps first.
- **Fading help:** bronze shows the stones and both jumps, silver shows the big rock only, gold shows only the sum.
- **Maths fit:** uses the existing `add:a+b` keys with totals over 10 and the ladder skill `facts-20`. **Probably no
  shared-maths change** (check in its plan that `makeFocusPack` can be asked for only the bridging facts). Best after B
  and C, since it uses both.

### E. Ruru's Number Trail: number line, one more and one less, comparing

- **Skill:** the linear number system: where 13 sits between 0 and 20, one more and one less, which is bigger. This is
  the game the Siegler and Ramani research supports most directly.
- **Play:** a ruru (morepork) flies a moonlit track of numbered posts, a straight line from 0 to 10, then 20, then 100.
  Questions: "Fly to the post one more than 12", "Which is bigger, 15 or 51?", and on gold days "Land the ruru where 7
  goes" on a line with only the ends marked (an estimate, close enough counts).
- **Fading help:** bronze shows every post number, silver shows every 5th, gold shows only 0 and the end.
- **Maths fit:** **needs new shared maths** (families like `more1:12`, `less1:12`, `cmp:15-51`, `line20:13`) and new
  ladder skills before `facts-10`. The estimate questions need a "close enough" mark on the server, which the hub hasn't
  done before, so this is the biggest build.

### Not shortlisted

- **Counting a set of objects (cardinality) on its own.** Children of 5 do it best with real objects, and tap-to-count on
  a screen is slow and easy to guess. Pipi's Hidden Shells and Ruru's Number Trail cover the counting ideas that matter
  most (how many, one more, one less).
- **Tens and ones to 100.** Year 2 to 3. Tūī's Ten Tree can grow into it later.

## 5. Suggested order

1. **Pipi's Hidden Shells (A).** Fills the biggest gap and sits underneath Beanstalk. Small shared-maths branch first.
2. **Kororā's Mirror Pool (B).** No new maths, quick to build.
3. **Tūī's Ten Tree (C).** No new maths.
4. **Weka's Stepping Stones (D).** Uses what B and C taught.
5. **Ruru's Number Trail (E).** Most new maths and the new "close enough" marking.

If speed matters more than the gap, swap 1 and 2: Kororā's Mirror Pool could be built with no shared-maths step at all.

## 6. Things to settle for every one of these

- **One shared early-years engine?** Beanstalk and Hop each have their own copy of the 30-day progress code. With 3 or
  more of these games, it is worth moving that into one shared folder (its own small branch, like a shared-maths change).
  Suggest doing it when the third early game starts.
- **The Easy maths shelf** already has 10 games, and these would make 15. A "Little ones" shelf or a junior filter on the home
  page may help. Needs James's call.
- **Art:** each game gets `scripts/<game>-art.py` and a picture list. Threads build with stand-ins drawn in code; James
  paints on the gaming PC (ComfyUI) in the evening.
- **Tests:** at most 8 per game (`docs/TESTING.md`), copying Hop's 4 rule tests.

## 7. How each of these is built (shared by all five plans)

Each game has its own plan: `docs/PIPI-PLAN.md`, `docs/KORORA-PLAN.md`, `docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`,
`docs/RURU-PLAN.md` (written 4 Nov 2026). They all follow how Kiwi's Beanstalk and Hop were built, so these parts are the
same for every one and aren't repeated in each plan:

- **Who and how long.** Ages 5 to 7. One challenge of about 10 goes, 3 to 5 minutes. Play again the same day for fun.
- **The 30 counted days.** 10 magic things turn bronze (days 1 to 10), silver (11 to 20), gold (21 to 30), at most one
  per NZ day (`nzDate`, server clock). Day 30 wins the prize; then a new NZ friend and the 30 days start again. Copy
  `progress.ts` from `shared/hop/` (or the shared engine, if it exists by then: section 6).
- **Help fades** with the colour: full on bronze, faint on silver, none on gold. A teacher can turn the help off.
- **The child's level comes from their own records,** the way Hop picks its step (`stepFor`): a 5-year-old on auto is
  usually on `facts-10`, so `makeFocusPack` would never serve these. The server keeps the furthest level `reached`, so a
  child never drops back.
- **Way A.** The server makes each round from a seed and saves its questions at `start`; `finish` replays the taps and
  records each question once with `recordMathsAnswers` (right if the first tap was right). Wrong taps wobble back, no
  penalty, the answer isn't shown.
- **Voice** with the game's own mute (`<id>-voice`), reading the question but never the answer. Sounds follow the hub.
- **Guided first go** on the very first challenge (from the saved game): a pointing hand that follows the child, never
  says the answer, and goes after the first right one. No How to play page; the teacher's "?" explains it.
- **No hub points.** One achievement per prize, per friend (like Beanstalk's six Golden Eggs). Not a season game.
- **Server:** tables `<id>_progress` and `<id>_rounds` (RLS on, no grants), function `supabase/functions/<id>/` with
  `load`, `start`, `finish` (plus `choose` if there's a character pick), a code switch `<ID>_ON`, a per-class switch
  `<id>_enabled` **on by default** (James), a help setting, `hub_games` row, teacher class and student lines, group
  `easy-maths`. About 3 requests a child a lesson.
- **Stages:** 0 plan, (shared maths branch if needed, live first), 1 rules + tests, 2 play screen with stand-in art and a
  preview, 3 server, 4 hub, teacher settings, guided first go, prize moment, 5 go live. At most 8 tests.
- **Art:** threads draw stand-ins in code; `scripts/<id>-art.py` lists the pictures; James paints on the gaming PC
  (ComfyUI) in the evening and picks in `docs/<id>-art/picks.json`. Numbers are always drawn in code, never painted.
- **The look is open.** Each plan lists a few looks to choose from; it is not assumed to be Beanstalk's clay.

## Sources

- NZ Ministry of Education, Mathematics and Statistics curriculum, Phase 1 (Years 0 to 3), 2025:
  https://newzealandcurriculum.tahurangi.education.govt.nz/
- NCETM, Mastering Number overview (Reception): https://axis.ncetm.org.uk/media/qytg0juv/mastering-number-reception-overview.pdf
- NCETM, Exploring the composition of number: https://www.ncetm.org.uk/features/exploring-the-composition-of-number/
- Clements, D. H. and Sarama, J., Learning and Teaching Early Math: The Learning Trajectories Approach (Routledge).
- Siegler, R. S. and Ramani, G. B. (2008), "Playing linear numerical board games promotes low-income children's numerical
  development", Developmental Science.
