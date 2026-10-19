# Gem Keep: Phase 0 recon

Stage 11 of School Games Hub. Written 16 October 2026 from the brief in
[../prompts/gem-keep.md](../prompts/gem-keep.md), after reading `main` at 9279038 (Stages 1–10 live,
599 unit tests passing). Branch: `stage-11`.

Where the brief and the repo disagree, the repo wins. Every change to the brief is listed in
section 3. **Status: reviewed by James on 16 October 2026 (answers in section 4). Phases 1 to 5 done; Gem Keep is live with saving and points since 17 Oct 2026. Phase 6 (polish and classroom test) not done yet. Details in [PROGRESS.md](PROGRESS.md).** (checked 20 Oct 2026)

## 1. What the brief got right

- React 19 + TypeScript + Vite 8, GitHub Pages, hash routes (`/#/...`). Routes `/lobby`,
  `/leaderboard`, `/points`, `/profile`, `/sign-in`, `/teacher` all exist ([src/App.tsx](../../src/App.tsx)).
- Supabase: `profiles`, `mp_games`, `bot_games`, `app_settings`; RPCs `leaderboard`, `my_progress`,
  `progress_rules`, `teacher_students`, `teacher_student_detail`, `teacher_new_season`,
  `teacher_set_multiplayer`; edge functions `multiplayer` and `save-bot-game`.
- Games are lazy-loaded chunks. Font stack is `ui-rounded, 'SF Pro Rounded', 'Nunito', …`.

Since the brief was written the hub also has **Wormholes & Black Holes** (Stage 9) and **101**
(Stage 10), with their own tables (`space_games`, `card_games`, `card_game_seats`) and functions
(`space-game`, `card-game`). Both are the best models for Gem Keep, because neither is chess-like.

## 2. Exactly where Gem Keep plugs in

| Need | Existing pattern | Gem Keep does |
|---|---|---|
| Register a game | [src/games/registry.ts](../../src/games/registry.ts): one line in `GAMES`. Each game is a `GameDefinition` ([src/games/types.ts](../../src/games/types.ts)): id, name, tagline, card colours, icon, lazy `Play` | `src/games/gem-keep/index.tsx` exports `gemKeep` with `ranked: false`. Added to `GAMES` only in Phase 5 |
| Route | Every `GAMES` entry gets `/#/<id>`, which renders [GamePage](../../src/pages/GamePage.tsx) → `<game.Play level=…/>` in `Suspense` | Phases 1–4: a **hidden** route `/#/gem-keep` added straight to `App.tsx` (not in `GAMES`, so no dashboard card). Phase 5 swaps it for the registry entry |
| Lazy chunk | `lazy(() => import('./SpacePlay'))` in the game's `index.tsx` | Same: `GemKeepPlay` lazy-loaded |
| Game card | The "Pick a game" grid is on the **Dashboard**, not the Lobby. The Lobby is only for playing classmates | Card goes on the Dashboard. No Lobby entry (single player) |
| Sign-in | `RequireAuth` wraps every game route; `useAuth()` from [src/auth/AuthContext.tsx](../../src/auth/AuthContext.tsx) | Nothing new |
| Sound | [src/games/sounds.ts](../../src/games/sounds.ts): `playSound(name)` makes tiny tones in the browser (no files). The mute setting is `useSound()` from [src/sound.tsx](../../src/sound.tsx), **off by default** | Add a few gem/forge/correct sounds to `GameSound` in Phase 6. The "sound toggle" already exists (the hub's mute button) |
| Styles | Plain CSS. Hub tokens on `:root` in [src/styles.css](../../src/styles.css) (`--brand`, `--play`, `--ink`, `--radius`…); each game has its own CSS file (`space.css`, `card101.css`) | `gem-keep.css`. No dark mode exists in the hub, so none here either |
| Reduced motion | Only `@media (prefers-reduced-motion: reduce)` in CSS | The engine reads the same media query and drops particles/screen shake |
| Pure logic shared with the server | `shared/<game>/` (no React, no DOM). Vitest already runs `shared/**/*.test.ts`. Server functions import from it | `shared/maths/` and `shared/gem-keep/` (see 3.1) |
| Saving a game | Browser → edge function (service key) → `record_*` SQL function (security definer). **Students never write to any table directly** | `save-gem-keep-run` function → `record_gem_keep_run()` |
| Edge function build | Write `supabase/functions/<name>/handler.ts` + `entry.ts`; `npm run build:functions` bundles to `index.ts` (generated). Add the name to `FUNCTIONS` in [scripts/build-functions.mjs](../../scripts/build-functions.mjs). Shared helpers: `_shared/http.ts` (CORS, body cap), `_shared/limits.ts` (rate limit), `_shared/stamp.ts` (HMAC) | Same |
| Points | All scoring happens in **database triggers** ([migration 0400](../../supabase/migrations/20261015000400_progress.sql)). `scored_games` has one row per player per game, with a foreign key per game kind (`bot_game`, `mp_game`, `space_game`, `card_game`). Bot games share a 40-points-per-NZ-day cap. Achievements are 10 points each | A new `gem_keep_run` column on `scored_games`, a scoring trigger, and Gem Keep achievements (Phase 5) |
| "How points work" page | `progress_rules()` returns the numbers; [HowPoints.tsx](../../src/pages/HowPoints.tsx) shows them | Add Gem Keep's numbers |
| Teacher settings | One-row `app_settings` table; each switch is a column plus a `teacher_set_*` RPC (e.g. `space_reactions_enabled` + `teacher_set_space_reactions`) and a panel in [Teacher.tsx](../../src/pages/Teacher.tsx) | New `gem_keep_*` columns on `app_settings` (see 3.4) |
| Teacher student view | `teacher_student_detail(student)` RPC + `PersonPanel` in Teacher.tsx | Add the 12 × 12 heat map and levels reached |
| New season | `teacher_new_season('NEW SEASON')`, redefined by each stage to clear its own tables (latest in [migration 0900](../../supabase/migrations/20261016000900_101_classmates.sql)) | Redefine again to clear Gem Keep tables (see 3.6) |
| Deleting a student | `teacher_delete_student` deletes the profile; everything else cascades | New tables reference `profiles (id) on delete cascade` |
| Tests | Vitest 5 + jsdom + Testing Library (`npm test`); pgTAP database tests in `supabase/tests/database/` (`npm run test:db`). `security.test.sql` lists every function and table **by hand** and must be updated | Same, plus engine tests that don't need a canvas (jsdom has none) |
| Deploy | `.github/workflows/deploy.yml` runs typecheck, tests and build on every push to `main`. Migrations and functions are applied to the live project by hand (`supabase db query --linked -f …`, `functions deploy --no-verify-jwt --use-api`), only with James's yes | Same. Known flaky test: chess bot "medium beats easy" sometimes fails CI; rerun the failed job |
| Phone preview | `vite.101-preview.config.ts` builds a stand-alone page that can be shown to James as a private claude.ai page | Same for Gem Keep (offered after Phase 1) |
| Docs | Brief in `docs/prompts/`, plan + results in `docs/`, a line in the Stages list in [PLAN.md](../PLAN.md) | Brief copied to `docs/prompts/gem-keep.md`; this file; Stage 11 line in PLAN.md |

Nothing in the hub uses `<canvas>` yet. Gem Keep will be the first.

## 3. Changes to the brief

### 3.1 Folders

The brief suggests `src/games/gem-keep/` and `src/lib/mathsEngine/`. The repo puts pure,
framework-free code that the server may also run in `shared/`, and keeps `src/` for React. So:

```
shared/maths/              the maths engine (brief's mathsEngine): no React, no DOM, no game
  skillPacks/timesTables.ts
  leitner.ts  selector.ts  facts.ts  *.test.ts
shared/gem-keep/           the simulation: pure, fixed timestep, seeded randomness, no canvas
  engine.ts  entities.ts  systems/  levels/  config.ts  *.test.ts
src/games/gem-keep/        the website side
  index.tsx  GemKeepPlay.tsx  render/ (canvas drawing)  ui/ (React screens)  strings.ts  gem-keep.css
```

Why the simulation goes in `shared/` too: if it's deterministic (seeded, fixed step), the server
can replay a run later to check it, exactly as it does for the space game and 101. v1 won't
replay (see 3.3), but keeping the door open costs nothing. `config.ts` stays the one file of
tuning numbers. `strings.ts` stays the one file of student-facing text.

### 3.2 Hidden route for Phases 1–4

`/#/gem-keep` is added directly to `App.tsx`, behind sign-in, but not to `GAMES`, so it never
shows on the Dashboard, Leaderboard, Profile or teacher tables until Phase 5.

### 3.3 Cheating checks: plausibility, not replay (v1)

The brief's plan (sanity-check score, answer speed and wave count) stays. A full replay of a
10-minute tower defence run on the server would use too much of a free-tier function's CPU time.
The run payload will include the seed and the player's actions anyway, so replay can be added
later if points ever get farmed. Points stay small and capped (below), so a faked run gains little.

### 3.4 Teacher settings are school-wide

**The hub has no classes.** `app_settings` is one row for the whole school, and the teacher list
is everyone. So "which tables are on" can only be one school-wide setting in v1. The brief's
`gem_keep_settings` becomes columns on `app_settings` (the existing pattern):
`gem_keep_tables int[]`, `gem_keep_division`, `gem_keep_missing_factor`, `gem_keep_mode`
('calm' | 'challenge'), `gem_keep_key_pass`, `gem_keep_multiple_choice`, each changed through
one `teacher_set_gem_keep(settings jsonb)` RPC.

Since this is school-wide, a better default than "teacher picks the tables" is to let the
**campaign** decide (level 1 = ×2, ×5, ×10 and so on) and use the teacher's list only to switch
tables **off**. Per-student settings could come later if James wants them.

### 3.5 Row-level security

The brief says "students read and write only their own rows". The hub's rule is stricter:
students never write to tables at all. So: `gem_keep_progress` and `fact_stats` have **no**
write rights for students; the save function writes them. Students read their own rows through
a `my_gem_keep()` RPC; teachers read through `teacher_*` RPCs (which check the teacher role on
the server), not through table policies.

### 3.6 Points and leaderboard

- Gem Keep is `ranked: false` (no ratings or badges), like the space game and 101.
- **Leaderboard:** today's leaderboard only lists ranked games (chess, checkers), by weekly points
  or rating. A Gem Keep board ("most stars") is a new kind of board, so `leaderboard()` needs a
  new branch. It will show names, avatars and stars only, never accuracy.
- **Points:** proposed in Phase 5. Starting idea: points per level won and per star, inside the
  existing 40-a-day bot cap, and achievements like "Pass your first Level Key".
- Dashboard "won/lost" tables and Profile achievement columns already handle unranked games.
  Gem Keep shows stars instead.

### 3.7 Game card

[GameCard](../../src/components/GameCard.tsx) always shows a bot-level picker and a "Play … vs bot"
button. Gem Keep has no bots, so the card needs a small change: an optional field on
`GameDefinition` (e.g. `noBots: true`) that hides the picker and says "Play Gem Keep". This is a
shared component, so I'm flagging it here; chess, checkers, space and 101 cards won't change.

### 3.8 Data and privacy

`fact_stats` is a new kind of data for the hub: **learning data** (which facts a student knows).
[PRIVACY-SUMMARY.md](../PRIVACY-SUMMARY.md) needs a line about it in Phase 5. Gem Keep has no free
text, as the brief says.

### 3.9 Year levels

The hub was built for Years 4–6. The brief's default is Years 3–6. Nothing in the code depends
on this; Year 3 just means the first levels must be very gentle.

## 4. Decisions (James, 16 October 2026)

1. **A new season wipes Gem Keep campaign progress and times-table mastery (`fact_stats`) too.**
   Deleting a student always wipes everything.
2. **The campaign decides the tables** (level 1 = ×2, ×5, ×10 and so on). The teacher setting can
   only switch tables off, for the whole school (3.4).
3. **Game card:** yes, add an option to hide the bot picker for Gem Keep (3.7).
4. **No phone preview link** after Phase 1; I test it myself and report.
5. **The first levels must be super easy and fun.** Building a few towers should win level 1 with
   3 stars; difficulty only climbs after that.
6. Everything in the brief's section 7 stays at its default (Years 3–6, Chromebooks and iPads,
   Calm mode, 8/10 pass mark, division off, single player, working title "Gem Keep").

## 5. Phase 1 next

Playable prototype at `/#/gem-keep`, no maths yet: one level, 3 enemy types, towers, 4 gem
colours (with shapes), combining, mana from kills, Keep health, win/lose, pause and 2×.
Engine tests for damage, effects and targeting. Tested in a browser at Chromebook and iPad sizes.
