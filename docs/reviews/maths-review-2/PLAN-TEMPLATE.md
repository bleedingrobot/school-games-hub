# How to write a fix plan for the second review (for helpers)

Reader: James, a teacher. Plain, simple English. Short sentences.

## Read first
- `docs/reviews/maths-review-2/DECISIONS.md` (final scores, patterns, spot-checks).
- The game's evaluation in `docs/reviews/maths-review-2/games/<game>.md` (problems found and candidate improvements).
- `docs/LEARNING-DESIGN.md` (the ten rules; every plan must follow them and say which rule it serves).
- `docs/GAME_DEVELOPMENT_GUIDE.md` (own branch and worktree; never touch `shared/maths`, `src/maths`, `src/styles.css` or `src/components` from a game branch; new migrations are new numbered files after the latest in `supabase/migrations/`; at most 8 tests per game; go-live steps need James's OK; new things go live switched ON for every class).
- The game kit: `shared/kit/` and `src/kit/` (and `src/kit/README.md` if present). Use a kit part where it fits. Kit rules: a kit part is never changed from a game branch (own small branch and PR); no game words inside the kit; changing `shared/kit` needs `npm run build:functions` in the same PR.

Verify every file path and line you cite by reading the code. Do not change any code. Do not commit.

## Each plan file

Path: `docs/plans/maths-review-2/<ID>-<short-name>.md`. Start with:

```
# <ID>: <Game>: <title>

**Game:** <game or games>
**What's wrong:** <one or two plain lines>
**What done looks like:** <one or two plain lines a teacher could check by playing>
**Size:** S, M or L (S = under half a day of a session, M = about a session, L = several sessions)
**Impact on learning:** Very high, High, Med or Low
**Waits for:** <card IDs, or "nothing">
```

Then these headings:
1. **The problem**: what a child or teacher sees now, with evidence (file:line, and what the evaluator saw in play).
2. **The rule behind it**: which LEARNING-DESIGN rule(s) this serves, 2 to 4 lines.
3. **The change**: exactly what to build, step by step, so a new session can build it without deciding again. Include numbers (thresholds, levels) and the child-facing words and voice lines. Say which kit part is used.
4. **Files affected**: list, marking any shared or kit file that needs its own small branch.
5. **Database / migration needs**: none, or what (new migration file, columns, functions) and how it is applied.
6. **Test steps**: the few automated tests (inside the 8-per-game limit) and what to check by playing the preview.
7. **Size and impact**: one line why.
8. **Session prompt (ready to paste)**: a fenced ```text block, self-contained, that starts a fresh Claude session. It names the branch to create from origin/main, says to read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and this plan by path, lists the steps and the tests, and ends "Stop and tell James before any live step. Open a PR when done." Do NOT add anything about updating a review page; the page adds that itself.

A plan with parts that must run one after another (for example one part per game) has one ```text block per part, each under a line `### Part N: <label>`.

## JSON file
Also write the JSON file named in your task: an array with one object per plan:

```
{"id":"S1","kind":"fix"|"kit"|"review","title":"...","games":["Robin"],"effort":"S","impact":"Very high",
 "wrong":"one plain line","done":"one plain line","why":"one plain line on why it matters for learning",
 "plan":"docs/plans/maths-review-2/S1-....md","waits":[]}
```

Check it with `python3 -m json.tool`.
