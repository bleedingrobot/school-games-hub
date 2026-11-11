# Prompt: start a new game

Fill in the three lines in square brackets, then paste everything below the line into project chat.

---

Start a new game for James's **School Games Hub**. Reply to James in short, plain words.

**The game:** [name], short id [e.g. `toonflap`]
**The idea:** [what pupils do, where the maths comes in, who they play with; junior (ages 5 to 8) or older pupils]
**Already decided by James:** [anything fixed, or "nothing yet"]

1. Read `CLAUDE.md` and `docs/GAME_DEVELOPMENT_GUIDE.md` and follow it. Where this prompt and the guide disagree, the guide wins.
2. Work on your own branch (in a cloud project thread, the `claude/…` branch you were given). Never commit to `main`.
3. `git fetch`, then `node scripts/migration-numbers.mjs`; write the next free number in your plan.
4. Write `docs/[ID]-PLAN.md` with a Status line at the top, answering the guide's sections 1a (design) and 1b (steps and the Progress tab), and LEARNING-DESIGN.md's check if there is maths. Put any choice that changes James's goal on a question card with your recommendation, and keep working on that recommendation.
5. Build in stages, each ending with a "Stage X results" section in the plan. Build with drawn stand-in art and write the art plan and `docs/[id]-art/config.json` for James to paint later. Don't stop for James between stages.
6. Tests: follow `docs/TESTING.md` "How many". Locally run your tests, `npm run typecheck`, `npm run test:changed` and `npm run build`; the PR's checks run every test.
7. Open a PR, merge it when the checks are green, and carry it through to live as in the guide's section 8 (pre-approved). Ask James on a card only before deleting anything or a destructive database change.
8. At start, when blocked, at a pause and at the finish, update the Games Hub Prompts board (with a copy-ready prompt for the next part) and project memory. After each merge, update the plan's Status line.
