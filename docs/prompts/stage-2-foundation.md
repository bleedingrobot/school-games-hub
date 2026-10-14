We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students, who'll sign in with their school Google accounts. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). Stage 1 (planning) is done.

**Before doing anything, read these two files:**
- `docs/BRIEF.md` is my full original brief. It sets how I want you to work (section 12) and what "done" means (section 13).
- `docs/PLAN.md` is the agreed architecture and the decisions we've made. Where the two disagree, PLAN.md wins.

Short version of the setup: GitHub Pages for the website (React + TypeScript + Vite, hash routes). Supabase free plan for sign-in, the database, live multiplayer and server-side move checking. Stockfish runs in the browser for the chess bot. We'll write our own checkers rules, with tests.

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Your task: Stage 2 — Foundation

1. **Set up the app:** Vite + React + TypeScript, with a lockfile, `npm run dev`, `npm run build`, `npm test` (Vitest) and a type check. Use the folder layout from PLAN.md:
   - `src/`
   - `src/games/` with one folder per game, plus a simple game registry so new games plug in later
   - `shared/`
   - `supabase/` (empty for now)
2. **Set up routing:** hash-based, so it works on GitHub Pages. Pages for:
   - Dashboard
   - Chess
   - Checkers
   - Lobby
   - Leaderboard
   - Profile / avatar
   - a sign-in screen placeholder

   Pages that aren't built yet should show a friendly "coming soon" message.
3. **Build the look and feel.** It should feel like a bright, friendly, modern gaming hub for 8–11 year olds, not a school portal.
   - Big buttons, attractive game cards, readable text and accessible contrast.
   - Keyboard-friendly, with playful but restrained animation that respects reduced-motion settings.
   - Works on Chromebooks, tablets and laptops.
   - No external tracking or analytics. Keep fonts and assets self-hosted or system fonts.
4. **Build the dashboard:**
   - the student's avatar and display name
   - a big Play button
   - Chess and Checkers cards, with a bot difficulty choice (Very Easy / Easy / Medium)
   - a lobby link
   - recent games, stats, achievements progress and a leaderboard link

   Use **clearly labelled development-only sample data**: a visible "Sample data" badge in the UI, and the data kept in one obviously named file that's easy to delete later. Include a simple placeholder avatar. The real avatar maker comes in Stage 3. Include the mute button from PLAN.md, with sound off by default.
5. **Set up deployment:** a GitHub Actions workflow that runs the tests and the build, then publishes to GitHub Pages whenever I push to `main`. Give me the exact click-by-click steps to turn on Pages in the repo settings (Settings → Pages → Source: GitHub Actions), and tell me what I should see when it works.
6. **Write a README** for someone with limited development experience: what the project is, how to run it locally, how to run the tests, and how publishing works.
7. **Check your work** before reporting: run the type check, tests and production build, and fix anything that fails. Then start the dev server and screenshot the dashboard at Chromebook width (1366×768) and tablet width (768×1024), so you can check the design yourself. Tell me plainly what you tested and what isn't tested yet.
8. **Update** `docs/PLAN.md` (mark Stage 2 done) and the README. Then commit with clear messages and push.

**Don't do these yet:** no Supabase, no sign-in, no game logic. Those come in Stages 3–5. Don't ask me for the school's Google domain until Stage 3 actually needs it, and never invent or hard-code a placeholder domain.

When you're done, give me a short plain-English summary covering:
- what was built
- the live website link
- anything I need to click or check
- what Stage 3 will need from me
