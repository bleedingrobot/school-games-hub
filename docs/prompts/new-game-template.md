# Prompt: start a new game

Fill in the three lines in square brackets, then paste everything below the line into project chat.

---

Start a new game for James's **School Games Hub**. Reply to James in short, plain words.

**The game:** [name], short id [e.g. `toonflap`]
**The idea:** [what pupils do, where the maths comes in, who they play with; junior (ages 5 to 8) or older pupils]
**Already decided by James:** [anything fixed, or "nothing yet"]

1. Read `CLAUDE.md` and `docs/game-guide/README.md` and follow its checklist. Where this prompt and the guide disagree, the guide wins.
2. Work on your own branch (in a cloud project thread, the `claude/…` branch you were given). Never commit to `main`.
3. `git fetch`, then `node scripts/migration-numbers.mjs`; write the next free number in your plan.
4. Write `docs/[ID]-PLAN.md` with a Status line at the top, from `docs/game-guide/templates/plan.md`, answering `1-design.md` and `2-steps-and-progress.md`, and LEARNING-DESIGN.md's check if there is maths. Put any choice that changes James's goal on a question card with your recommendation, and keep working on that recommendation.
5. Build in stages, each ending with a "Stage X results" section in the plan. Build with drawn stand-in art and write the art plan and `docs/[id]-art/config.json` for James to paint later. Don't stop for James between stages.
6. Tests: follow `docs/TESTING.md` "How many". Locally run your tests, `npm run typecheck`, `npm run test:changed` and `npm run build`; the PR's checks run every test.
7. Open a PR, merge it when the checks are green, and carry it through to live as in `docs/game-guide/8-going-live.md` (pre-approved). Ask James on a card only before deleting anything or a destructive database change.
8. At start, when blocked, at a pause and at the finish, update the Games Hub Prompts board (with a copy-ready prompt for the next part) and project memory. After each merge, update the plan's Status line.
9. If anything in the guide turned out wrong, fix it in the same PR.
