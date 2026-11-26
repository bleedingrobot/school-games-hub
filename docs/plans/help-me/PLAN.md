# Help me on every ladder question: plan (26 Nov 2026 NZ)

For Claude. James asked for a review of the whole maths ladder and a plan for a Help me on every question type: teach a
strategy (mental tricks such as ×9 = ×10 − one lot, ×5 = half of ×10, near doubles, bridging through 10, compensation;
near facts they already know; worked steps with the question's own numbers), never the answer. **Rule (James): if a pupil
opens Help me, nothing gets ticked off.** Plan only. Build nothing until James has picked and said go.

- Picks page: picker.html in this folder, published as an Artifact (link in project memory, `help-me-plan`). Browse by
  year (#year-1 … #year-8, #all), Start here (#start) has the rules and the review. Read picks with ArtifactData `list`,
  collection `picks`: doc id = skill id (ladder id) or rule id (`rule-*`), fields `choice` (yes/no/maybe), `comment`.
- The help text for each of the 136 skills (title, steps, picture) is the `SKILLS` array inside picker.html. It is the
  source for the build: copy it, don't rewrite it.

## Pictures in the question (James, 26 Nov 2026)

`PICS` in picker.html: per skill, the picture the question shows now and a picture idea. Separate picks: doc id
`pic-<skill id>` (choice only). 12 ladder skills show a figure today (shared/maths/figure.ts kinds); junior-game skills
are drawn by their games; 47 more have a picture idea (fraction bars, ten-frames, number lines through zero, compass
rose, clocks, thermometers). New picture kinds go in figure.ts + QuestionModal like the existing ones.

## Review (what's there now)

- 136 skills, Year 1-8, ~200 question types. 110 on the auto ladder; 26 `inAuto: false` skills are asked and marked by
  junior games (Pipi, Hop, Penguin Pairs, Tūī, Pigeon, Parrot, Lizard, Swamp Hen, Robin).
- Free Help me today (shared/maths/hint.ts `helpKind`, QuestionModal): angles, symbols, remainder, axes, fractions, hours
  (8 skills). They don't stop an answer counting.
- `hintFor` + `onHint` Hint button in some games (greys out two choices / "between 50 and 60"); the game decides the reward.
- All server-marked answers go through supabase/functions/_shared/recordAnswers.ts `recordMathsAnswers` (one place to
  drop helped answers). Client-recorded games use FactAnswer too.

## Proposed rules (each is a pick on the page)

rule-no-tick (helped answers never count), rule-no-wrong (nor count against), rule-comes-back (asked again soon, no help),
rule-every-q, rule-known-fact (tables/doubles/bonds help quotes a fact the pupil has secure), rule-old-boxes (the 6
existing boxes follow the rule), rule-hint (Help me replaces Hint), rule-points (half points), rule-teacher (Progress
tab shows help use), rule-junior (junior games build their own, read aloud).

## Status

- James said yes to everything (26 Nov 2026, 8 pm NZ) and chose "build all stages now".
- H1 (the rule) built: migration 20261126200655_maths_help_me.sql. The question box calls `maths_help_opened(kind)` when Help
  me is first opened on a question (src/maths/questionLog.ts help sink, set by src/data/questionLog.ts) and waits for it
  before sending the answer. `record_fact_answers` leaves the next saved answer (within 10 minutes) out of the records and
  writes it to `maths_help_uses`. Closing the box unanswered, or a server-marked answer coming back, calls
  `maths_help_cancel()`. Works for every game, since every game saves through `record_fact_answers`. Not done in H1: half
  points (each game's server gives its own points) and "comes back soon" (a helped fact simply stays unsecured, so the
  ladder keeps asking it).
- H1 LIVE 26 Nov 2026 (PR #915).
- H2-H7 (help cards) built: shared/maths/help/ makes a card for any ladder question from what it shows (parts, prompt,
  choices): basic.ts (early facts, tables with near facts, patterns), number.ts, fractions.ts, measure.ts, algebra.ts.
  index.ts tries them most specific first. QuestionModal shows Help me on every question with a card (title + numbered
  steps, last one ends in "?"), above the older picture boxes (angles, remainder, axes...). The pupil's secure facts
  (my_ladder, box 2+) load the first time Help me opens, so a tables card can start from "You know 7 × 7". The checkers
  Hint button is hidden when a card exists. shared/maths/help/help.test.ts checks every inAuto key has a card that
  isn't broken and doesn't end on the answer.

## Build outline (after James says go)

- H1 The rule: `helped?: true` on FactAnswer; QuestionModal sets it when Help me opens and passes it with `onSubmit`;
  every game passes it on (server games send it with the answer); `recordMathsAnswers` and the client recorders skip
  helped answers for boxes/secure/mastery, log them as practice, and schedule the fact again soon (selector). Tests.
- H2 Help engine: shared/maths/help/ — one function per question family (key prefix) returning
  `{title, steps[], picture?}` from the question's numbers, last step ends in "?". `helpKind` folds in. Known-fact lookup
  from the pupil's records for tables. One test per family: never contains the answer as the final step.
- H3 Early facts + tables. H4 place value, rounding, number. H5 fractions, decimals, percent. H6 measure, time, shape,
  chance. H7 Year 7-8. H8 junior games (one PR per game). H9 teacher Progress tab help counts.
- New ladder skills (the Year 4 build) come with their help from the start.
