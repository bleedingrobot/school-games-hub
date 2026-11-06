**Review of the fundamental maths games: research, evaluation and planned recommendations**

**Goal:** Find out how well each fundamental maths game teaches its maths idea, and find the basic skills no game covers yet. Then produce a report with recommendations that are fully planned and ready to build. Don't change any game code in this session.

**1. Scope**
- List every game in the "Easy maths games" group, plus any other game whose main job is teaching number basics: counting, subitising, bonds, skip counting, teen numbers, place value, addition/subtraction strategies and early multiplication.
- Before starting, show me the list as a card so I can confirm or adjust it.

**2. Research the maths (cite sources)**
- For each maths idea the games cover, find out:
  - what understanding looks like
  - the usual learning order
  - common misconceptions
  - which representations work best (ten-frames, number lines, part-whole, concrete → pictorial → abstract)
- Line this up with the NZ Curriculum (Maths & Statistics, 2025 refresh), the Number Framework stages and the Learning Progression Frameworks.

**3. Research educational game design (cite sources)**
Cover at least:
- intrinsic integration (the maths is the game mechanic, not a quiz bolted on)
- cognitive load and clarity
- scaffolding and worked examples, and how to fade them
- feedback quality (what was wrong and why, not just right/wrong)
- spaced and varied practice
- mastery and adapting difficulty
- motivation (autonomy, competence, belonging) without rewards crowding out the maths
- design for ages 5–8 (pre-readers, read-aloud, touch targets)

**4. Evaluate each game**
Play each game in the browser and read its code. Score each criterion 1–4, with evidence (screenshots, file:line):
1. **Maths fidelity:** does it teach the idea correctly, and does winning need the maths?
2. **Clarity:** can a 5–7-year-old tell what to do without an adult?
3. **Support and structure:** the hints, models and help available when stuck
4. **Fading:** does support step back as the child succeeds, and come back if they struggle?
5. **Progression:** does difficulty build in the research order, and does it adapt?
6. **Feedback:** after a mistake, does it say what went wrong and why?
7. **Progress recording:** what gets saved per child (check the live database), and could a teacher see who is stuck on what?
8. **Engagement:** is it fun because of the maths, or despite it?

**5. Find the gaps: fundamental skills with no game yet**
- Using the maths research, map every fundamental skill for roughly ages 5–10 against the games that already cover it, including the non-"easy" maths games. Build it as a coverage matrix: skill × game, marked as covered, partly covered or not covered.
- Look beyond number, for example:
  - number: counting on/back, comparing and ordering, doubles and halves, equal sharing, early fractions, place value to 1000 and decimals, estimation, mental strategies (bridging ten, compensation), times-table fluency, division as the inverse of multiplication
  - algebra: patterns, equals as balance, missing numbers
  - measurement: length, mass, time and clocks, money
  - geometry: shapes, position and direction, symmetry
  - statistics: sorting, simple graphs, chance
- For each uncovered or weak skill, rate:
  - how important it is (how much later learning depends on it)
  - how well it suits a game
- Then sketch one to three game concepts for each of the top gaps. Each sketch covers:
  - the core mechanic (the maths must be the mechanic)
  - the target age or curriculum level
  - how support would fade
  - what progress it would record
  - roughly how big a build it is

**6. Report**
Save to `docs/reviews/fundamental-maths-review.md` and publish as an artifact. Include:
- a one-page summary
- a scores table (game × criterion)
- a research summary
- a section per game: strengths, gaps, scores with evidence
- patterns across games, e.g. shared components for fading or progress tracking
- the coverage matrix and the ranked list of new game ideas

**7. Fully planned recommendations**
Save each recommendation as its own file in `docs/plans/maths-review/`. Each one has:
- the problem
- the research behind it
- the change
- the files affected
- any database or migration needs
- test steps
- effort (S/M/L) and impact
- a ready-to-paste session prompt to build it

Write the top new game ideas from step 5 up as plans in the same format, in `docs/plans/maths-review/new-games/`.

Also include one overall priority order covering both fixes to existing games and new games (quick wins first, then the bigger changes).

**8. Easy-to-read artifact, ready to kick off**
Publish the report as a separate easy-to-read artifact for a busy teacher, not a copy of the markdown:
- a short plain-language summary at the top, with a simple colour-coded score grid (game × criterion)
- one card per game: what works, what's missing, top fix
- the coverage matrix as a visual grid, and the new game ideas as cards
- the priority list as cards in order, each with effort, impact, a one-line "why", and a **Copy prompt** button holding that recommendation's ready-to-paste session prompt, so any one can be kicked off straight away
- a status per recommendation (to do / started / done) that I can tick, saved so it stays put
- works on a phone

**How to work:** Use Sonnet helpers for the research, the per-game evaluations and the coverage mapping. Keep the scoring scale, the gap ranking and the cross-game judgements in the main session. Ask questions as cards.
