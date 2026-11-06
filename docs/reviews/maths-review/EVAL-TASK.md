# Per-game evaluation task (for helpers)

Read docs/reviews/maths-review/BRIEF.md first. Do NOT change any game code, do not commit, do not touch git branches.

1. Read the game's plan doc(s) and ALL of its code: src/games/<folder>/, shared/<folder>/, src/data/<folder>.ts if any, its server function in supabase/functions/ and its migrations (grep supabase/migrations for the game's table names).
2. Play it. Start the preview yourself in the background on your own port:
   `npx vite --config vite.<folder>-preview.config.ts --port <PORT> --strictPort` (run_in_background). Then use the built-in browser tools: open YOUR OWN tab with mcp__Claude_Browser__tabs_create and always pass that tabId (other helpers share the browser). Navigate to http://localhost:<PORT>/ . Play as a new 5–7-year-old would: first go, get some right, get some wrong on purpose, get stuck, keep going until difficulty moves on. Use read_page / get_page_text mostly; screenshots only where they show something important. Close your tab and stop the server (kill the background process) when done. If the browser cannot be used, say so clearly and evaluate from the code.
3. Write the evaluation to docs/reviews/maths-review/games/<folder>.md with:
   - One-paragraph summary of how the game works (the core loop, what the child does).
   - The maths: exactly what question types / levels exist, in what order, how the next level is chosen (file:line).
   - Score each of the 8 criteria 1–4 with 2–5 lines of evidence each (file:line, and what you saw when playing). Be honest and critical; a 4 must be truly excellent.
   - Specific problems found while playing (bugs, confusing moments, places a child could win by guessing or tapping everything).
   - What is saved per child on the server: table names, columns/JSON fields, what a teacher can currently see about this game (teacher pages / reports / Today page alerts), and 2–3 SQL queries I could run on the live database to see how real pupils are doing (levels reached, error rates, stuck pupils). Do not run them.
   - Strengths (bullets) and gaps (bullets).
   - Candidate improvements: 3–8, each with problem, change, files affected, rough effort S/M/L, expected impact.
4. Reply with a short summary: the 8 scores, the top 3 gaps, and the file path.
