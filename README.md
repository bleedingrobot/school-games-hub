# School Games Hub

A chess and checkers website for Year 4–6 students. Students will sign in with their school Google account, build an avatar, and play against computer bots or each other.

**Live site:** https://bleedingrobot.github.io/school-games-hub/

**Where it's up to:** Stage 2 of 8 is done. The site has its look, the dashboard and all its pages, but the games, sign-in and real scores aren't built yet. Pages that aren't ready say "Coming soon". The full plan is in [docs/PLAN.md](docs/PLAN.md).

## The pretend data

Until sign-in and the database exist, the dashboard shows **made-up sample data** so you can see what it will look like. Anything made up has a yellow **SAMPLE DATA** badge next to it.

All of it lives in one file: [src/dev/sampleData.ts](src/dev/sampleData.ts). It gets deleted once real data takes over.

## Running it on your computer

You need **Node.js** version 22 or newer. Check by typing `node -v` in a terminal. If it's missing, get the "LTS" version from nodejs.org.

In VS Code, open the project folder, then open a terminal (**Terminal → New Terminal**) and type:

```bash
npm install
```

You only need this the first time, or after the project's packages change. Then:

```bash
npm run dev
```

It prints a link like `http://localhost:5173/`. Ctrl-click it to open the site. Changes you save show up straight away. Press **Ctrl+C** in the terminal to stop it.

## Checking it works

| Command | What it does |
|---|---|
| `npm test` | Runs the automatic tests |
| `npm run typecheck` | Checks the code for type mistakes |
| `npm run build` | Builds the finished website into the `dist` folder |
| `npm run check` | Does all three, in that order |

Run `npm run check` before pushing. If it says everything passed, the publish will work too.

## How publishing works

Every time you push to the `main` branch on GitHub, GitHub automatically:

1. runs the type check, tests and build,
2. and, if they all pass, puts the new version on the live site.

It takes about 1–2 minutes. To watch it, open the repo on GitHub and click the **Actions** tab. A green tick means it's live. A red cross means something failed: nothing was published, and the old version stays up. Click the red run to see what went wrong.

### One-time setup (already done, here for reference)

On GitHub, open the repo, then go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. There's nothing else to set.

## Where things are

```
src/              the website
  pages/          one file per page (Dashboard, Lobby, Leaderboard...)
  components/     building blocks used on many pages (buttons, cards, avatar)
  games/          one folder per game, plus registry.ts which lists them
  dev/            development-only sample data, to be deleted later
  styles.css      colours, sizes and layout
shared/           game rules shared with the server (from Stage 4)
supabase/         database setup and server checks (from Stage 3)
docs/             the plan and the original brief
.github/workflows the automatic test-and-publish steps
```

**Adding a game later:** make a new folder in `src/games/` (copy `chess/` as a starting point) and add one line to `src/games/registry.ts`. It then gets its own card on the dashboard and its own page.

## Privacy and safety so far

- No tracking, analytics, ads or outside fonts. Everything the site loads comes from this repo.
- The only thing saved in the browser is whether sound is on, on that device. Sound starts off.
- The code is public, so **no passwords or secret keys ever go in it**. When the database arrives, only Supabase's public "anon" key goes in the website. That key is safe to share because the database rules do the protecting.
