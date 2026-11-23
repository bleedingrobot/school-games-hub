# Prompt: Class Showdown Stage 3 (Boss Bounty, whole class: the painted screens)

Paste everything below the line into project chat.

---

Build Stage 3 of **Class Showdown** (game id `showdown`) for School Games Hub (GitHub bleedingrobot/school-games-hub): **Boss Bounty, whole class**, the real projector screen and iPad controller, merged and live but still behind the code switch (`src/games/showdown/switch.ts`, off until Stage 4). Merging is pre-approved. Use Sonnet/Haiku helpers in parallel for routine pieces (CSS, art placeholders, voice lines, tests); plan and check on the main thread. Keep replies to James short and plain.

**Read first**
- `docs/SHOWDOWN-PLAN.md`: Decisions, sections 1, 3, 7 and "Stage 1 results" and "Stage 2 results".
- `docs/game-guide/README.md`, then 3-files-and-clashes.md ("Full window"), 6-art-voice-cards.md, 7-testing.md.
- What you build on: `shared/showdown/server.ts` (`RoomView`, `PlayerView`, `FeedEvent`), `src/games/showdown/link.ts` (`ShowdownLink`, `pretendLink`) and `liveLink.ts`, `TestScreens.tsx` (the bare test screens to replace), the preview (`vite.showdown-preview.config.ts`, `?pretend=30`).

**What to build**
1. **Projector** `src/pages/TeacherShowdown.tsx` (route `/teacher/showdown` or the game's own page for teachers): full window, a slim teacher bar that folds away (class, mode, length, Start, Enrage, Pause, Mute, End), the lobby ("Join now!" with names flying in), 3-2-1 countdown, the battle, the final 30 seconds and the recap. Reloads straight back into a running round (`view`). Never shows a question or a wrong answer.
2. **Controller** at `/#/showdown` (`src/games/showdown/`): full window; join (also from the pop-up's `?room=`), role picker (Striker, Guard, Healer with portraits), one question at a time with `QuestionModal` (show-why after a wrong answer, 2-second wait), the filling 4-second ring, daze stars, golden question, personal results at the end. Re-joins on its own after a dropped connection. iPads stay silent.
3. **The first boss painted with all 3 phases**: the River Titan (Riverstone). Drawn stand-ins first, then `docs/SHOWDOWN-ART-PLAN.md` and `docs/showdown-art/config.json` (every picture in plan section 7, prompts in the style line, the home card). James paints with ComfyUI on the gaming PC; if it is reachable, paint the River Titan's 3 phases, its backdrop and the fx and fetch the files yourself (never ask James to drag files).
4. **Sound and announcer** (projector only): boss roar and hits, shield clang, heal chime, countdown drums, crowd cheer, victory fanfare; announcer lines in `voiceLines.ts` with the voice-lines test ("Shield up!", "Weak spot!", "Thirty seconds!"...; no pupils' names spoken). Bella clips via scripts/voice-clips.py when the PC is reachable.
5. **How to play** (20 seconds, first round) on the projector and each iPad.

**James wants flashy, immersive graphics and animations** (23 Nov 2026). Every feed event gets its moment: painted boss with 3 phases, the boss breathing and flinching, hit numbers bursting off the boss (bigger for bigger `times`), screen shake on big hits, a shield dome that fills during a wind-up and cracks or clangs, daze stars, heal sparkles on a revive, a weak-spot glow, a phase-change transform with a roar, a golden flash, a drumroll and glowing bars in the final 30 seconds, confetti, award cards flipping in one by one with a fanfare, names flying in on join, and a burst plus a team-coloured flash on every iPad hit. Respect `prefers-reduced-motion` (fades instead of shakes).

**Tests** (game budget 12, 8 used): up to 4 screen tests: the controller joins, answers and shows the right answer after a wrong one; the projector draws a hit, a wind-up and the recap from feed events; reloading the projector picks up a running round. Screen checks at phone, iPad and laptop sizes (full window, nothing scrolls sideways).

**Done when** James can play it on the test page with pretend pupils and it looks and sounds the part. Then typecheck, `test:changed`, build, PR, merge, check the publish run, update the plan's Status line and project memory, and write the copy-ready Stage 4 prompt (teams and solo, switched on for James's class) in `docs/prompts/showdown-s4.md` and on the Games Hub Prompts board.
