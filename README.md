# School Games Hub

A chess and checkers website for Year 4–6 students. Students will sign in with their school Google account, build an avatar, and play against computer bots or each other.

**Live site:** https://bleedingrobot.github.io/school-games-hub/

**Where it's up to:** Stage 3 of 8 (sign-in and profiles) is being finished. Students sign in with their Douglas Park Google account, pick a safe player name and build an avatar. The games and real scores aren't built yet; those pages say "Coming soon". The full plan is in [docs/PLAN.md](docs/PLAN.md).

## How sign-in stays school-only

Only `@douglaspark.school.nz` accounts can get in, and that's checked three times, all on the server:

1. Google's sign-in screen (the Google project is "Internal" to the school).
2. Supabase refuses to create an account for any other email (a sign-up hook, plus a database backstop).
3. Every read of the database re-checks the school email, and students can only change their own name and avatar.

Profiles store a random ID, a word-list name (like "Speedy Otter 27") and avatar codes. No emails or real names. Supabase's own sign-in records do keep each student's Google email and name; only the server can see those.

**Making someone a teacher:** the first teacher is made by hand. Sign in to the website once, then in Supabase go to **SQL Editor** and run
`select public.make_first_teacher('your.email@douglaspark.school.nz');`
After that, teachers can make other staff teachers from inside the app (teacher screens arrive in Stage 7).

## The pretend data

Results and points don't exist yet, so the dashboard shows **made-up sample data** for stats, recent games and achievements. Anything made up has a yellow **SAMPLE DATA** badge next to it. The name and avatar are real.

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
| `npm run test:db` | Tests the database rules (needs the local Supabase copy, see below) |

Run `npm run check` before pushing. If it says everything passed, the publish will work too.

### Testing the database rules on your computer

This needs **Docker Desktop** installed and running. Then:

```bash
npx supabase start     # first time downloads a lot; later it's quick
npm run test:db
npx supabase stop      # when you're done
```

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
  auth/           sign-in and keeping pages private
  avatar/         avatar parts and drawing
  data/           talking to the database
shared/           game rules shared with the server (from Stage 4)
supabase/         database setup (migrations), its tests, local settings
docs/             the plan and the original brief
.github/workflows the automatic test-and-publish steps
```

**Adding a game later:** make a new folder in `src/games/` (copy `chess/` as a starting point) and add one line to `src/games/registry.ts`. It then gets its own card on the dashboard and its own page.

## After the school holidays

The free Supabase plan **pauses a project after a week with nobody using it**. If the site says sign-in isn't working after a break: log in at supabase.com, open the project and click **Restore project**. It takes a few minutes and nothing is lost.

## Privacy and safety so far

- No tracking, analytics, ads or outside fonts. Everything the site loads comes from this repo.
- The browser saves the sign-in session and whether sound is on (sound starts off). Signing out clears the session.
- Names come from word lists, avatars from a fixed set of parts. There's no free typing and no photo uploads.
- The code is public, so **no passwords or secret keys ever go in it**. Only Supabase's public "publishable" key goes in the website (in `src/config.ts`). It's safe to share because the database rules do the protecting.
