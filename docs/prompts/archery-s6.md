# Prompt: Archery Challenge Stage 6 (fights against classmates)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery`.

---

You are continuing **Archery Challenge** (short id `archery`) for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). It's Scorched Earth with archers instead of tanks, designed by James with one of his pupils. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

Stages 1–5 are built on branch `archery` (nothing live): the engine with every arrow, shield, helper and bow; bots; the fight screen; the server (migration `20261021000300_archery.sql`, function `archery`); and the whole game against bots (home, speed rounds, Armory, packing, fights), playable in the preview on a trial server. **This session builds Stage 6: fights against classmates**, through the server one shot at a time. Stage 6b (joining from the hub's main Lobby) is NOT this session.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ARCHERY-PLAN.md` all the way through: "Decisions", sections 1, 2, 7 (especially "Classmate fights"), 8, 9, 12, and **every "Stage N results" section** (3, 4 and 5 most closely), including the questions for James in each. If James has answered any of them since, the answers come first. What matters most:
   - **No aiming help of any kind** (James, 21 Oct 2026). Angle and power are plain numbers; nothing draws a line, path or landing guess.
   - **The server owns coins and gear.** A classmate fight takes each pupil's packed quiver out of their bag when it starts and gives back what they didn't use when it ends. **No gear limit** between classmates (James): whoever did more maths brings better gear.
   - **Every shot is checked and played by the server's own engine.** The browser never decides what a shot did.
   - **Graphics must stay top-notch and smooth on Chromebooks**; reuse the existing fight screen and its picture.
3. Read the code you'll build on: `shared/archery/` (especially `fight.ts`, `judge.ts`, `shop.ts`), `supabase/functions/archery/handler.ts` and `handler.test.ts`, `supabase/migrations/20261021000300_archery.sql`, `supabase/tests/database/archery.test.sql`, `src/data/archery.ts`, `src/games/archery/trialBackend.ts`, `ArcheryGame.tsx`, `FightScreen.tsx`, `FightSetup.tsx`, and `preview/archery/main.tsx`.
4. Read how Power Clash plays classmates through the server (the pattern to copy): `supabase/functions/power-clash/` (handler, entry, tests), its migrations (`20261017001500_power_clash_points.sql`, `…1600_power_clash_games.sql`, `…1700_power_clash_scoring.sql`), `src/power-clash/usePowerGame.ts`, `src/multiplayer/useGameChecks.ts` (polling as a backup to realtime), and the stand-in preview `preview/power-clash/` (`standIn.ts`, `fakeMultiplayer.ts`) where two tabs play each other.
5. Work only in this worktree, on branch `archery`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push with `git push origin archery`). Don't commit `dist-preview-archery/`.
6. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`), then run `node scripts/migration-numbers.mjs` for the next free migration number (it was `20261022000100` on 22 Oct 2026; check again). Write it in the plan.

## What to build (plan section 7, "Classmate fights")

### 1. Finding a classmate (inside the game, not the hub Lobby)
- A **"Challenge a classmate"** list: classmates who have the game open right now, from a new `archery_online(…)` database function. **Same school and same class only.** Display names (and avatars if you like) only, never maths results or coins. Copy how other games keep "who's here" fresh without many requests (a small heartbeat, e.g. once every 20–30 s while the game is open, cheap enough for a class of 28: put the request count in the plan).
- Tap a name to send a challenge (pick the world first). The classmate sees it pop up and can **Accept** or **Say no**. A challenge runs out after about a minute. Each side then **packs their quiver** (the same Pack screen) and the fight starts when both have packed. Both packs are taken out of their bags then (the same rules as `archery_fight_start`: only gear they own; a request sent twice counts once).
- A pupil can only be in one classmate fight at a time; starting one gives up any open bot fight the usual way.

### 2. Turns through the server
- The fight row holds the seed, world, both players, both packs, the shot list and whose turn it is. Actions in the `archery` function: `shot` (only on your turn; the server plays it with `takeShot` and saves the new shot list), `times-up` (the turn timer ran out: the turn is used up), `leave` (give up: the other player wins; unused gear goes back to both).
- **Turn timer 45 s.** Three time-outs in a row by the same player ends the fight: unused gear back to both, **nobody** gets points.
- Both screens get the new state through **realtime on the fight row**, with `useGameChecks`-style polling as a backup. The screen plays each new shot with the existing picture (`playShot` with `keepPath`), so both pupils see the same arrows, blasts, goo and shards.
- The **Apple** and every arrow, shield and bow work the same as against bots (it's the same engine). The Glass Arrow's "hit back or pop" works between classmates too.
- A **tidy-up** ends fights nobody has touched for a while (copy the pattern other games use; say which in the plan) and gives the gear back.
- The game's teacher switch must be on for **both** players' classes; if it's switched off mid-fight, say so kindly and end it fairly.

### 3. Points (plan section 8)
- **Finish a fight against a classmate: 3 points, or 4 if you win**, through `add_game_points`, once per fight per player. A fight ended by time-outs gives nobody points. Update `archery_point_rules()` with the new line (a new migration; never edit the applied-looking Stage 4 one if James has applied it by then: check the plan first).

### 4. The database (a new migration, the next free number)
- Extend or add tables as needed (RLS on; pupils read only their own fights through a function or a realtime-safe policy; copy Power Clash's approach and say why). Add the fight table to the realtime publication the way Power Clash does.
- Server-only functions for: challenge, accept/decline, pack, shot, times-up, leave, end, tidy-up, online list. Coins never change in a classmate fight; gear does (taken at start, given back at the end).
- `supabase/tests/database/archery_classmates.test.sql` on a throw-away copy (`scripts/scratch-db.sh` then `scripts/scratch-test.sh`, then drop it): pupils can't read other people's fights or packs, can't play out of turn, can't challenge another class or school, a request sent twice counts once, gear comes back right, three time-outs end it with no points. Re-run `archery.test.sql`, `game_hooks.test.sql` and `mine_hub.test.sql` on the same copy.

### 5. The screens
- In `ArcheryGame`: a **Challenge a classmate** button (on the home screen and the Pick screen), the online list, the challenge pop-up (focus moves to it; it can be answered by keyboard), waiting screens ("Waiting for Mia to pack…"), and the fight.
- The fight screen against a classmate: the other archer is the classmate (their display name on the card; a different look from the bots, drawn in the same style), a **turn timer** you can see (with a warning at 10 s, and none of it flashing for less motion), and messages like "Mia is aiming…". When it's not your turn, the controls are off. Leave asks "Are you sure? Mia will win."
- Every button uses the hub's shared buttons; every new screen moves focus to its heading; 44 px targets; contrast 4.5 : 1. Extend `Accessibility.test.tsx` to the new files.

### 6. The preview
- A **stand-in** so James can try it on his own: two browser tabs (or two panes) play each other through a pretend server in the browser, the way `preview/power-clash/standIn.ts` does. It must never call the real server. Keep the existing bot game and preview tools working. Publish to the **same** test-page Artifact so James's link keeps working: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3 (read it first, then publish with `url`). Check it in headless Chromium at 1366 × 640, 844 × 390 and 390 × 844, with zero network requests.

**Not in this stage:** joining from the hub's main Lobby (Stage 6b, its own branch, only after James OKs the shared changes); the teacher panel and achievements (Stage 7); the target challenge (Stage 8); anything live.

## Before you say it's done
- Run `npx vitest run shared/archery src/games/archery src/data/archery.test.ts supabase/functions/archery` while you work. Then `npm run typecheck`, `npm run test:all` and `npm run build`. Rebuild only this function's bundle (`npm run build:functions -- archery`). Say plainly if anything fails, with the output (a busy-computer timeout that passes alone is fine to explain).
- Handler tests for every new action: out of turn, a shot that breaks the rules, sent twice, time-outs, leave, both players' gear back, points once, the switch off, another class.
- Write **"Stage 6 results"** at the bottom of `docs/ARCHERY-PLAN.md`: what you built, the numbers you chose and why, requests per lesson for classmate fights, the tests, what's untested, questions for James, and the go-live list.
- Commit, `git push origin archery`, and **stop for James**. Nothing goes live: no migration applied, no function deployed, no merge to `main`, no switching on.

When you stop, tell James in plain words what's ready, give him the test page link and how to try two players on one device, and say what he needs to decide.
