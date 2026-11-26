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
