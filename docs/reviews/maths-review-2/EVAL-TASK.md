# Second review: per-game evaluation task (for helpers)

Audience: James, a Year 4 to 6 teacher at Douglas Park School (NZ). Pupils of these games are about 5 to 8 years old. Plain, simple English.

This is a rerun of the 7 Nov 2026 Foundational maths games review, using the same method so results can be compared. **It must be blind.**

## Do not read (until James's report is finished)

- `docs/reviews/fundamental-maths-review.md`
- `docs/reviews/maths-review/games/*`, `DECISIONS.md`, `coverage.md`, `data-*.json`, `page/*`
- `docs/plans/maths-review/R*.md`
- anything in git history, PRs or memory that states an earlier score

If a code comment or plan doc mentions an old score, ignore it. Score only what the game does today.

## Do not change

Do not change any game code. Do not commit. Do not touch git branches. The only file you write is your own evaluation file.

## Steps

1. Read the rubric: `docs/reviews/maths-review/research-design.md` from the line "# The checklist (25 items) and rubric" to the end of "Caveats to remember when scoring".
2. Read the game's plan doc(s) and ALL of its code: `src/games/<folder>/`, `shared/<folder>/`, `src/data/<folder>.ts` if any, its server function in `supabase/functions/`, its migrations (grep `supabase/migrations` for the game's table names), and any shared kit parts it uses (`shared/kit/`, `src/kit/` or similar).
3. Play it. Start the preview yourself in the background on your own port:
   `npx vite --config vite.<preview>-preview.config.ts --port <PORT> --strictPort` (run_in_background). Load the browser tools with ToolSearch (`select:mcp__Claude_Browser__tabs_create,mcp__Claude_Browser__navigate,mcp__Claude_Browser__read_page,mcp__Claude_Browser__get_page_text,mcp__Claude_Browser__computer,mcp__Claude_Browser__find,mcp__Claude_Browser__tabs_close,mcp__Claude_Browser__javascript_tool`). Open YOUR OWN tab with tabs_create and always pass that tabId, because other helpers share the browser. Go to http://localhost:<PORT>/.
   Play as a new 5 to 7 year old would:
   - the first go, with no adult
   - some right answers
   - wrong on purpose: one wrong tap, then two, then three goes in a row wrong
   - the **random tapper**: tap every choice in turn. Can a round be finished with no maths? What does it cost?
   - keep going until difficulty moves on, if the preview allows
   Mostly use read_page and get_page_text; take a screenshot only where it shows something important (art that hides the maths, overlapping things, tiny buttons). Close your tab and stop the server when done. If the browser can't be used, say so clearly and score from the code, and mark each score "code only".
4. Write the evaluation to `docs/reviews/maths-review-2/games/<folder>.md` with:
   - **How it works:** one paragraph on the core loop and what the child does.
   - **The maths:** exactly what question types and levels exist, in what order, and how the next level is chosen (file:line).
   - **Scores:** each of the 8 criteria 1 to 4, using the rubric exactly, with 2 to 5 lines of evidence (file:line and what you saw when playing). Be honest and critical; a 4 must be truly excellent. Say whether each line of evidence was seen in play or read in code.
   - **The 25-item checklist:** a table with yes, partly or no for each item, a few words each.
   - **Problems found:** bugs, confusing moments, ways to win by guessing or tapping everything, with exact steps to see each one. Rank them by how much they hurt learning.
   - **Saved per child on the server:** tables, columns or JSON fields, whether the wrong choice and help level are saved, what a teacher can see today (pupil page, hardest, Today alerts, class grid), and 2 to 3 read-only SQL queries James could run on the live database for this game (levels reached, error rates, stuck pupils). Do not run them.
   - **Strengths** and **gaps** (bullets).
   - **Candidate improvements:** 3 to 8, each with the problem, the change, files affected, rough effort S/M/L, expected impact on learning.
5. Only after writing the scores, read `docs/LEARNING-DESIGN.md`. Do not change your scores because of its comments about other games. Add a final section **Learning-design rules:** a table of its ten rules with met, partly or not met for this game, with the evidence. Also say which parts of the shared game kit (`docs/plans/GAME-KIT-PLAN.md`) this game uses and which it could use but doesn't. Check against the code, not the plan.
6. Reply with a short summary: the 8 scores, the top 3 gaps, the file path. Do not paste the evaluation back.
