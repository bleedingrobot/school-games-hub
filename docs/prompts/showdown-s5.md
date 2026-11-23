# Prompt: Class Showdown Stage 5 (rewards, the boss roster, on for every class)

Paste everything below the line into project chat.

---

Build Stage 5 of **Class Showdown** (game id `showdown`, School Games Hub, GitHub bleedingrobot/school-games-hub): **rewards, achievements, the boss roster with all 4 bosses painted, "Again?", and switch it on for every class.** Merging and deploying are pre-approved. Use Sonnet/Haiku helpers in parallel for routine pieces; plan and check on the main thread. Make the best call yourself and keep going (James, 23 Nov 2026); keep replies short and plain.

Read first: `docs/SHOWDOWN-PLAN.md` (Decisions, sections 6 to 8, and the Stage 1 to 4 results), `docs/game-guide/README.md` (points and rewards, achievements, art, going live), `docs/SHOWDOWN-ART-PLAN.md`, and the code in `shared/showdown/` (`server.ts`, `awards.ts`) and `src/games/showdown/`.

What to build:
1. **Rewards:** hub points like any maths game for every right answer (follow how other games award them), plus a **Showdown chest** at the end of every round (gold or gems to the pupil's own favourite game, as the plan's Decisions table says; no daily cap). The controller's results screen shows the chest opening with a flashy reveal.
2. **Achievements:** a small set from the plan (first round, first boss beaten, shield hero, healer, streaks, all 4 bosses), in the hub's achievements system.
3. **Boss roster:** the River Titan, Storm Kraken, Clockwork Colossus and Comet Wyrm, each with 3 phases. Beating a boss unlocks the next for the class; the teacher screen shows the roster (beaten, best time). Use the painted pictures in `src/games/showdown/art/paint/` (painted on James's PC; if a thread finds them missing, collect them from `C:\Users\Giant\Games Hub\showdown-art-out\` through Remote Control and folder access, never ask James to move files). Swap `BossStandIn.tsx` for the paintings with the same flinch, phase and beaten animations; add the home card picture and take `showdown` out of `NOT_PAINTED_YET` in `src/games/art.test.ts`.
4. **"Again?":** one teacher button after the recap: same mode, same teams, the next boss.
5. **Best comeback** bounty in solo (left out in Stage 4).
6. **On for every class:** a migration sets `showdown_enabled = true` for every class and the school defaults (Stage 4 had it on for James's class only, `20261123001000_showdown_riley_only.sql`).

**James wants flashy, immersive graphics and animations** on every screen, as in Stages 3 and 4.

Tests: the game's budget of 12 is used up. Raise it in `scripts/test-budget.test.ts` only as far as needed (at most 2 more: rewards paid once per round; the roster unlocks the next boss), with a one-line reason. Screen checks at phone, iPad and laptop sizes. Done when it is live for every class. Then update the plan's Status line, project memory, and write the Stage 6 prompt (Gold Rush, arena 2) in `docs/prompts/showdown-s6.md` and on the Games Hub Prompts board.
