# 1. Design: settle these in the plan before building

Write a short answer to each in `docs/<GAME>-PLAN.md` (template: [templates/plan.md](templates/plan.md)), with your recommendation. They shape the database, server function and screens, so they are cheap now and costly later. Write "not for this game, because …" where one doesn't fit. A choice that changes James's goal goes on a question card; keep building on your recommendation meanwhile.

## The pieces every game has

| Piece | Where | Copy from |
|---|---|---|
| Rules as pure functions (same seed + inputs = same result), shared by browser and server | `shared/<id>/` (config with every tuning number in one file) | `shared/toonflap/`, `shared/weka/` |
| Screens, own CSS with a prefix | `src/games/<id>/` | `src/games/toonflap/`, `src/games/weka/` |
| Talking to the server | `src/games/<id>/backend.ts` or `src/data/<id>.ts` | `src/games/weka/backend.ts` |
| Server function | `supabase/functions/<id>/` `handler.ts` (logic, tested), `entry.ts` (database), `index.ts` (generated) | `toonflap`, `weka` |
| Database | own tables prefixed with the id, new migrations only | [templates/migration.sql](templates/migration.sql) |
| Teacher part | `teacher` on the game definition; settings through `teacher_set_<id>()` | `src/games/toonflap/teacher.ts`, `src/games/weka/teacher.ts` |
| Code switch (`teacherSwitch: true` in the GameDefinition for the teacher's) | `src/games/<id>/switch.ts` | `src/games/weka/switch.ts` |
| Preview without sign-in | `preview/<id>/` | `preview/toonflap/` |
| Simulator (balance games) | `scripts/<id>-sim.mjs` | `scripts/toonflap-sim.mjs` |
| How to play (numbers read from config) | `src/games/<id>/HowToPlay.tsx` | `src/games/toonflap/HowToPlay.tsx` |
| Read-aloud (Bella) | `voiceLines.ts`, `public/voice/<id>/` | [6-art-voice-cards.md](6-art-voice-cards.md) |
| Painted art and home card | `docs/<id>-art/config.json`, `src/games/<id>/art/`, `src/assets/home/` | [6-art-voice-cards.md](6-art-voice-cards.md) |

## The questions

**1. The big goal.** What a pupil works towards over weeks (Dragon Maths: beat the dragon; Clan Quest: a full village, then the giant). Say what "done" looks like, how long it takes at 3 to 4 days a week (check with the simulator), and what there is after. Short-run games can have a smaller goal: a best time, every level, a gold on each.

**2. Season game?** Only if power or progress piles up, so late joiners would fall hopelessly behind. If yes:
- Use the school's season (35 days back to back from one admin date, holiday pause: `docs/DRAGON-SCHOOL-SEASON.md`). Reading it needs a shared function: ask James how.
- Say what resets and what is kept, in your `season_fn` hook and `keep_achievements` ([5-server-and-saving.md](5-server-and-saving.md)).
- A countdown in the last days, a celebration, winners kept in a Hall.
- A pupil who joins mid-season can still get somewhere.

**3. How much play a day?** Pick one, with reasons:
- **A daily allowance** (Dragon Maths' fights, Clan Quest's 2 builds) when more play means more power, or the game is a little each day across a season.
- **One new level a day** (Toon Flap: `opensTomorrow` in `shared/toonflap/collection.ts`; Diamond Drop) when the levels are the reward: replaying old levels stays unlimited.
- **No limit** when it is practice (Bond Match, Marble Rush). Points already stop at 40 a day. Cap rewards instead if it could be farmed (Bond Match: 10 games a day earn points).
- With a limit: the server counts and refuses, never the browser. Days roll over at NZ midnight (`nzDate`). Say kindly when it's used up ("All done for today. See you tomorrow!").
- **Unlimited turns today** (teacher's Today page): normal turns are used first, then the server stops refusing; extra turns give game rewards but no hub points (`EXTRA_TURN_POINTS`). Read it with `isUnlimitedFor(days, '<id>')` or `unlimited_today(player, '<id>')`, show "Unlimited today", and add the game to `UNLIMITED_GAMES` in `shared/unlimited.ts` and to `teacher_set_unlimited_today()`.
- "Left today" chips on the home card come from `my_moves_left()`, a shared function, not a hook: plan it as its own small PR.

**4. Progress bars.** In the game: a bar or road to the big goal and a level bar (`LevelBar` in `src/components/Progress.tsx`). The home page's points level and next achievements come free from points and achievements. A season strip on the home page is not a hook: its own small PR. Never show a pupil's maths results to classmates or rank by maths.

**5. Achievements.** A table in the plan: name, what it's for in pupil words, measure and number, roughly how many pupils get it, kept through New Season or not. One most pupils get on day one, a few for steady play, one for the big goal. Build through `hub_games` ([5-server-and-saving.md](5-server-and-saving.md)).

**6. Home card art.** A one-line scene and prompt for James to paint (style: [6-art-voice-cards.md](6-art-voice-cards.md)).

**7. A built-in guide for new players.** A 9-year-old (or a 5-year-old, for a junior game) must get through the first go with no adult. Copy Star Trader's Bolt (`docs/TRADER-HINTS-PLAN.md`) for older games and Weka's guided first go (`useGuidedFirstGo`, `PointingHand` from `src/kit`) for junior games.
- Walk through as a new pupil first and write a table: moment, what the game does, why a child gets stuck, the fix.
- A guided first go (2 to 3 minutes) with the real buttons, one lit-up thing at a time, ending in a success that can't fail. It follows the pupil and can be skipped. Who gets it comes from the server's saved game, so it follows them to any device.
- A next-step line that is always there: one sentence, one action, real names and numbers, from a pure function, with "Show me". A greyed-out button says why.
- First-time tips (`FirstTimeTip`), help at real choices (show the working, never choose), help that fades, and "Replay the guide".
- Never block, never decide, never help with the maths answer itself. Respect reduced motion.

**8. Learning design (any game with maths).** Answer the check in [LEARNING-DESIGN.md](../LEARNING-DESIGN.md) section 6. In short:
- **The maths is the move:** you can't win without it (2 free wrong taps at most, no give-away choices, only the first tap counts).
- **Model and help ladder:** ten-frame, number line, bundles … (LEARNING-DESIGN section 3), picture to number. Use the kit's pictures.
- **Help follows this child's results, not the calendar:** it arrives by itself after a mistake, a demo the first time a new kind appears (`useKindDemo`), fades with success and comes back after struggle (`shared/kit/help.ts`).
- **Pacing:** keep the hold after a right answer short (Tūī's 3.4 s added 45 s of waiting a round); look-togethers are slow and counted aloud; the answer clock starts when the voice ends (`speak(…, onEnd)`); juniors use `JUNIOR_QUICK_MS`.
- **Progression:** steps in research order, move up on steady success, review old facts, a ladder long enough for a term, and the "what's next" game at the top.
- **Mistakes:** a wrong-answer table (misconception, its choice, its "why" line, what the picture does) and the show-why flow (`ShowWhy`, `shared/kit/mistakes.ts`).
- **Evidence:** what's saved per go ([5-server-and-saving.md](5-server-and-saving.md), "What to save per go") and the teacher's stuck signal ([2-steps-and-progress.md](2-steps-and-progress.md)).
- After building, score it against `docs/reviews/maths-review/research-design.md`: a 3 on every line before going live.
- Maths as a side part (older games): it nudges, never decides, and a wrong answer still shows the right one with a reason.

**Also decide:**
- **Lesson fit:** one sitting fits 10 to 15 minutes and saves as it goes. Say what a pupil does in the first 5 minutes.
- **Who plays with whom:** solo, classmates or clans; odd numbers and absences. Own class only.
- **What the teacher needs:** few settings, the class report, `hardest` and `alerts` for Today, what can be reset, and the Progress tab column ([2-steps-and-progress.md](2-steps-and-progress.md)).
- **Rewards and coins:** where they come from and go; the simulator checks nothing piles up unused.
