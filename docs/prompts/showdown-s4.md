# Prompt: Class Showdown Stage 4 (teams and solo, switched on for James's class)

Paste everything below the line into project chat.

---

Build Stage 4 of **Class Showdown** (game id `showdown`, School Games Hub, GitHub bleedingrobot/school-games-hub): **2 teams (tug of war), 4 teams (the boss chases the leader), everyone for themselves (bounties, top-10 leaderboard), the team picker and reshuffle**, then switch it on for James's class only. Merging is pre-approved. Use Sonnet/Haiku helpers in parallel for routine pieces; plan and check on the main thread. Keep replies to James short and plain.

Read first: `docs/SHOWDOWN-PLAN.md` (Decisions, sections 2, 4.1, 5, and the Stage 1 to 3 results), `docs/game-guide/README.md` steps 14, 18, 22, and the screens in `src/games/showdown/` (`Projector.tsx`, `projectorState.ts`, `Controller.tsx`).

What to build:
1. **Projector, team modes:** big team banners and bars in team colours (red, blue, gold, green), the bridge with the boss pushed by the tug of war (`tug`, `view.tug`), the boss turning to face the leading team (`boss_turns`, `view.facing`), team shields in wind-ups, the team recap. **Solo:** a live top-10 with "big move" pop-ups and the bounties (most damage, last hit, longest streak, best comeback).
2. **Team picker in the lobby:** drag a name to another team or tap a name then a team (`teams` with `pupil` + `team`), and Reshuffle.
3. **Controller:** team colour everywhere in team modes; solo shows your place only as "You're in the top 10!" (never a full ranking of classmates).
4. **The real pages:** `src/pages/TeacherShowdown.tsx` (the projector with `liveShowdownLink`, the teacher's class picker, the names switch), the GameDefinition `src/games/showdown/index.tsx` (`group: 'complex-maths'` or as fits, `teacherSwitch: true`, `teacher.switch` with an about line, colours, Icon), registry append behind `showdownOn()`, the controller at `/#/showdown` (reads `?room=`), a Teacher menu link, `teacher_set_showdown` settings (on/off, names on the projector).
5. **Switch on for James's class only:** a migration sets `showdown_enabled = false` for every class except James's (find his class with the Supabase connector; he is the teacher with GitHub login bleedingrobot / the site owner), then the code switch PR (`SHOWDOWN_ON = true`, id in `src/games/registry.test.ts`). Stage 5 turns it on for every class.

**James wants flashy, immersive graphics and animations** on every screen: team banners waving, the bridge shaking as the boss is pushed, the boss turning with a roar, leaderboard rows sliding as places change, "big move" pop-ups, and everything from Stage 3.

Tests: game budget 12, 10 used: at most 2 more (team picker moves a pupil; solo top-10 never shows a pupil their own rank beyond "top 10"). Screen checks at phone, iPad and laptop sizes. Done when a real class round works in every mode on James's class. Then update the plan's Status line, project memory, and write the Stage 5 prompt (rewards, achievements, the other 3 bosses painted, boss roster, "Again?", on for every class) in `docs/prompts/showdown-s5.md` and on the Games Hub Prompts board.
