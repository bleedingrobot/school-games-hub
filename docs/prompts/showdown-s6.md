# Prompt: Class Showdown Stage 6 (Gold Rush, arena 2)

Paste everything below the line into project chat.

---

Build Stage 6 of **Class Showdown** (game id `showdown`, School Games Hub, GitHub bleedingrobot/school-games-hub): **Gold Rush**, the second arena, in every mode (whole class, 2 teams, 4 teams, solo). Merging and deploying are pre-approved. Use Sonnet/Haiku helpers in parallel for routine pieces; plan and check on the main thread. Make the best call yourself and keep going (James, 23 Nov 2026); keep replies short and plain.

Read first: `docs/SHOWDOWN-PLAN.md` (Decisions, section 4.2 Gold Rush, and the Stage 1 to 5 results), `docs/game-guide/README.md`, and the code in `shared/showdown/` (engine, server, bosses) and `src/games/showdown/`. Questions leave out the ladder's untimed skills (already in `makeQuestion`).

What to build:
1. **Rules** (`shared/showdown/`, pure and tested): a map of gold seams. Each right answer digs at the seam the pupil picked on their iPad; rich seams pay more but a seam shared by several pupils splits its gold; seams run dry and new ones glitter elsewhere. Teams dig for the team's pile, solo for their own. Big events: the **cave-in** (a shield check: enough right answers in 15 seconds or the seam's diggers are dazed) and the **mother lode** (a weak spot: double gold for 15 seconds). Tune with the simulator so a round feels close (`npm run showdown:sim`).
2. **Server:** the arena choice on `open` (`arena: 'boss' | 'goldrush'`), a pupil `choose` with `seam`, the same compare-and-swap saves, rewards and "Again?" as Boss Bounty (the roster is for bosses only).
3. **Projector:** the painted map (`art/paint/back/gold-rush.webp`, seams `art/paint/goldrush/seam-*.webp`, `cave-in.webp`), gold flying from seams to banners or names, seams glittering, running dry and cracking, a rumbling cave-in, a blazing mother lode, the recap with gold piles.
4. **Controller:** a seam picker (big tappable seams with how many diggers are there), a dig burst on every right answer, the cave-in warning.
5. **Teacher:** pick the arena in the teacher bar.

**James wants flashy, immersive graphics and animations** on every screen.

Tests: raise the showdown budget in `scripts/test-budget.test.ts` by at most 2 (Gold Rush rules; a seam shared splits its gold), with a one-line reason. Screen checks at phone, iPad and laptop sizes. Done when it is live for every class. Then update the plan's Status line, project memory, and write the Stage 7 prompt (more arenas: Sky Climb, Shrinking Island, King of the Hill, Auction House, one PR each) in `docs/prompts/showdown-s7.md` and on the Games Hub Prompts board.
