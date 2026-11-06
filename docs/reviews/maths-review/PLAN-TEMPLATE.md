# How to write a recommendation plan (for helpers)

Read first: docs/reviews/maths-review/DECISIONS.md (final word on scores, patterns, IDs, priority), the game evaluations in docs/reviews/maths-review/games/, research-maths.md, research-design.md, coverage.md, and docs/GAME_DEVELOPMENT_GUIDE.md (rules: own branch and worktree, never touch shared/maths or src/maths or src/styles.css or src/components from a game branch, migrations numbered new files only, at most 8 tests per game, go-live steps need James's OK, new things go live switched ON for every class). Verify every file path and line you cite by reading the code. Don't change any code.

Plain simple English for James (a teacher). Each plan file has these headings:
1. **The problem**: what a child or teacher experiences now, with evidence (file:line, what the evaluator saw).
2. **The research behind it**: 2–4 lines, citing the research files' sources.
3. **The change**: exactly what to build, step by step, specific enough that a new session can build it without re-deciding. Include numbers (thresholds, levels) and the child-facing words/voice lines.
4. **Files affected**: list, marking any shared file that needs its own small branch.
5. **Database / migration needs**: none, or what (new migration file, columns, functions), and how it is applied.
6. **Test steps**: the few automated tests (within the 8-per-game limit) + what to check by playing the preview.
7. **Effort and impact**: S/M/L and Low/Med/High/Very high, one line why.
8. **Session prompt (ready to paste)**: a fenced ```text block, self-contained, that starts a fresh Claude session: names the branch to create from origin/main, says to read docs/GAME_DEVELOPMENT_GUIDE.md and this plan file by path, lists the steps, the tests, and "stop and tell James before any live step; open a PR when done".

Also write a JSON array file (path given in your task) with one object per plan:
{"id":"R1","kind":"fix"|"new-game","title":"...","games":["Tūī"],"effort":"S","impact":"High","why":"one plain line","plan":"docs/plans/maths-review/....md","prompt":"<exact text of the session prompt>"}
Make sure it is valid JSON (check it with python3 -m json.tool).
