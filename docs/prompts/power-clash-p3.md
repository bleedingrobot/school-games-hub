# Power Clash, Stage P.3: polish (animations, sounds, messages, How to play)

You are continuing work on **Tic-Tac-Toe: Power Clash** in the School Games Hub (~/projects/school-games-hub, GitHub bleedingrobot/school-games-hub). James is a primary-school teacher; the players are 8–10 year olds on Chromebooks. Reply to James in plain, simple words (no jargon, paths or hashes unless he asks).

## Where things stand
- Plan, approved by James 17 Oct 2026: `docs/POWER-CLASH-PLAN.md` (section 9 = his decisions). Brief: `docs/prompts/power-clash.md` (section 7 = animation and sound ideas).
- **P.1 done** (eb5bc7d): pure rules engine in `shared/power-clash/` (engine.ts, match.ts, types.ts, 36 tests). The engine returns `events` for every move (place, double-trouble, body-swap, freeze, wipe, skip, thaw, win, draw): animate from those.
- **P.2 done** (d4f437d): playable pass-and-play screens in `src/games/power-clash/` (PowerClashPlay.tsx, text.ts, power-clash.css, 4 tests) at the hidden route `/#/power-clash` (wired in src/App.tsx, NOT on the dashboard, not in registry.ts). James played it from a private preview link and said it looks good.
- Work on branch `power-clash`. Use a git worktree: `git worktree add ../school-games-hub-power-clash power-clash` (it may already exist; run `npm ci` in a fresh one). Other sessions use the main checkout and the Gem Keep, monsters and space-maths worktrees, so don't touch those. Never use bare `git stash`.
- Nothing is live. Don't merge to main or deploy anything.

## Do now (P.3, website only: no database or function changes)
1. **Animations** (CSS and SVG, no new dependencies): symbol pops in with a glow; Double Trouble lightning then the second symbol slams in; Body Swap portal/slide between the two squares; Freeze Ray ice beam and frost; Board Wipe explosion and the symbol flying off; winning line glow and a short celebration; draw pulse. Add screen shake and a few particles, kept short.
2. **The screen must never decide the outcome.** Animate from the engine's `events` after the engine has already produced the new state. Lock input while an animation plays (no double taps, no moves mid-animation), but never block longer than about a second.
3. **Reduced motion and sound switches.** Follow `prefers-reduced-motion` (no shake or particles, short fades only). Sound uses the hub's mute button (`useSound`, off by default) and `src/games/sounds.ts`: add a few new synthesised sounds there (zap, freeze, boom, swap, win). Check how the other games add theirs.
4. **Funny short messages** like "THAT WAS YOUR PLAN?!", "TIME CRIME!", "ABSOLUTE DISASTER.", "YOU HAD ONE JOB." shown briefly after powers and wins. Keep them school-friendly, kind and short, a few variants each, never long text over the board.
5. **How to play** panel (open with a button and the `?` key, close with Escape, focus returns to the button), written for 8-year-olds: the goal, one power per turn, each power once, what each of the four powers does with a tiny example, and who wins if both get a line. Copy the pattern of `src/games/card101/Guide.tsx`.
6. **Keep it accessible**: visible focus, nothing relying on colour alone, status text in an aria-live area so screen readers hear what a power did, Chromebook fit at 1366x640.
7. Tests: add component tests for the new behaviour (input locked during an animation, How to play opens/closes, reduced motion). Keep all existing tests passing (`npx vitest run`; the Gem Keep `levels.test.ts` and chess "medium beats easy" tests are known flaky and not yours).
8. Check in a real browser at Chromebook (1366x640), tablet touch and phone, keyboard-only, with an axe scan if you can (axe-core lives in ~/projects/maths-alignment-tool/node_modules/axe-core). Playwright: see the 101/space browser scripts' pattern (executablePath to ~/.cache/ms-playwright/chromium-1243, force-click `button--play`). Run `npm run power-clash:preview` to build the stand-alone preview, and republish the private artifact https://claude.ai/artifact/5odQT7RHRaZxuhKPuYVx3p (same file path in the session scratchpad, new hashed asset names) so James can try it from his phone.

## Then
Update `docs/POWER-CLASH-PLAN.md` (a "Stage P.3 results" section) and the Power Clash line in `docs/PLAN.md`, commit, push `power-clash`, tell James what changed in simple words, and **stop for his review**. Next stage after that is P.4 (bots, simulation, saving bot games and taking-part points; this one needs a migration and a `save-bot-game` change, so it needs James out of auto mode to go live).
