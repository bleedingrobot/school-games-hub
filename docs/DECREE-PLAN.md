# Royal Decree: plan

**Status:** live from 6 Nov 2026 (James: "Go live now"), switched on for every class. Kingdom Keeper's card is off (its data is kept).

*Asked for by James on 6 Nov 2026 as the full rewrite of Kingdom Keeper ("kids don't like it, find it unfun and confusing"). Why it is being rewritten, with the live numbers: [KINGDOM-REWORK-IDEAS.md](https://github.com/bleedingrobot/school-games-hub/blob/isles-live-notes/docs/KINGDOM-REWORK-IDEAS.md). Built by following [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md). Choices marked **(chosen)** were made for James and are easy to change.*

---

## 1. The short version

- You are the young ruler of Riverstone (same town, rulers and advisers as Kingdom Keeper). **Villagers come to the throne one at a time with a request**, usually with a number in it: "I need 12 sacks of flour to bake 60 pies for the fair!" **Swipe right for yes, left for no** (or tap the two buttons).
- **Four meters:** Food, Gold, Happiness, Safety, each 0 to 10, starting at 5. Every choice nudges one to three of them, and arrows show which way before you choose. **A meter at 0 ends the reign** with a kind, funny ending ("The town ran out of food, so you went on a very long picnic to find more").
- **Each new year** everyone has eaten through winter: Food −1.
- **Every third card is a riddle:** a villager asks a maths question from the pupil's own focus. Right: +2 to the meter that villager cares about, and a star. Wrong or skipped: nothing lost, and the right answer is shown.
- **A full reign is 6 years × 4 seasons = 24 cards**, about 3–4 minutes. Most early reigns end sooner; that's the fun ("one more go").
- **Stories:** some choices start a story that comes back later in the reign (a dragon egg that hatches, a circus that returns, the inventor's flying machine).
- **Royal Album (the big goal):** every villager you've met and every ending you've seen, kept for good.

Our own game: own name, art, characters, meters and maths. It borrows only the general "swipe to decide" card mechanic.

## 2. Why this fixes Kingdom Keeper

| Kingdom Keeper's problem | Royal Decree |
|---|---|
| A wall of numbers to start | One card, one face, one sentence |
| 4 strange units and 3 conversion rules | 4 meters, all "higher is better", shown as bars |
| Feeding defaults to 0 and wipes the city | No hidden trap: every choice shows its arrows first |
| Maths as a quiz before playing | Maths cards woven into the deck, from the same villagers |
| 10 years ≈ 15 min, points only at the end | 2–4 min a reign, points for every reign |
| Same three clicks every year | ~70 different cards, stories, surprises |
| Random disasters | Only your choices move the meters (plus winter, which is shown) |

## 3. Design decisions (guide section 1a)

1. **Big goal (chosen):** fill the Royal Album: meet all 32 villagers, see all 5 endings, and live through a full reign. A pupil playing 3–4 days a week should fill most of it in 2–3 weeks.
2. **Season game? No.** Every reign is a fresh start. The album and achievements are kept; points go at New Season as always.
3. **Moves a day: no limit** (the maths is practice). Only the first **5 reigns a day** give points (chosen).
4. **Progress bars:** in a reign, a 6-year road along the top (seasons as dots). Outside, the album page ("18 of 32 villagers, 2 of 5 endings").
5. **Achievements (chosen):**

| Name | For | Measure ≥ | Who gets it | Survives New Season |
|---|---|---|---|---|
| First decree | Finish a reign | reigns 1 | nearly all, day one | yes |
| Long live the ruler | Live through a full reign | full 1 | most, week 1–2 | yes |
| Royal friend | Meet 20 villagers | met 20 | most | yes |
| Everyone's ruler | Meet all 32 | met 32 | keen players | yes |
| Storyteller | See all 5 endings | endings 5 | keen players | yes |
| Golden throne | 5 full reigns | full 5 | regulars | yes |

6. **Home card art:** a young ruler on a throne in a sunny hall, a queue of colourful villagers (baker, knight, goat, cat in a cape) waiting their turn. Course-card style.
7. **Guide for new players:** Hale the steward. The first reign starts with 3 practice cards ("Try swiping right!"), first-time tips (first riddle, first meter getting low, first story card), and a next-step line. See stage D.6.

**Lesson fit:** a reign is 2–4 minutes, so 3–4 reigns in a 15-minute slot. It saves at the end of every year, so the bell loses at most one year.
**Maths that nudges:** a right riddle is +2 to one meter, a good help but not a must. A pupil who skips every riddle can still live a full reign.
**Teacher:** on/off switch per class. The focus is set on the shared Set focus page.

## 4. Maths (guide section 4, way A)

At `start` the server reads `space_maths_context(player)`, makes 8 questions with `makeRunQuestions` (one for each riddle of a full reign), keeps them in the reign row (pupils can't read it) and sends only `publicQuestion`s. Riddles are shown with `QuestionModal`. The server marks (`answer`), claims the slot once, and records with `recordMathsAnswers`. When the year is saved, the server replays it using only the riddles it marked right. Counts for the ladder and focus results.

## 5. Server and database

**Function `decree`** (`supabase/functions/decree/`), logic in `shared/decree/server.ts` (shared with the preview).

| Action | What it does |
|---|---|
| `load` | The open reign, the album, reigns left today that give points |
| `start { look }` | Leaves any open reign, makes a new seed and 8 riddles |
| `answer { reign, slot, value, ms }` | Marks one riddle once, records it |
| `save { reign, from, moves }` | Replays the moves since card `from`, keeps the result once. At the end: points, `game_progress_changed` |

**Requests:** start + up to 8 answers + up to 7 saves = at most 16 a reign. A class of 30 doing 4 reigns a lesson, 3 lessons a week, is about 6,000 a week: fine on the free plan.

**Migration** (number checked at go-live): `decree_reigns` (id, player, look, reign jsonb, moves jsonb, questions jsonb, answered jsonb, status `playing|over|full|left`, ending, points, created/updated/finished). RLS on, no policy, no grant. Server-only functions `decree_load`, `decree_start`, `decree_answer`, `decree_save`. `app_settings.decree_enabled` (default **true**, James's rule for new games), `teacher_set_decree()`. Hooks in `hub_games` (counts, rules, players, last played; `keep_achievements` true), measures and the 6 achievements.

**Kingdom Keeper:** switched off in code when Royal Decree goes live. Its tables stay (no data is deleted).

## 6. Stages

| Stage | What | Status |
|---|---|---|
| D.1 | Rules: config, cast, types, engine, server, memory services | Done (6 Nov) |
| D.2 | The deck: ~70 cards, 32 riddle lead-ins, 5 endings (helper agent), checked by a simulator | Done (6 Nov) |
| D.3 | Art: 26 new villager portraits on the gaming PC (helper agent); rulers, 6 advisers and a few scenes copied from Kingdom Keeper | Done (6 Nov) |
| D.4 | Screens: start, the swipe card, meters, riddles, year turn, ending, album; trial backend and preview | Done (6 Nov) |
| D.5 | Server function, migration, hub hooks, teacher switch, How to play | Done (6 Nov), not live |
| D.6 | Guide for new players (Hale), checks, screenshots, preview for James | Done (6 Nov) |
| D.7 | Go live (switched on), Kingdom Keeper's card off | Done (6 Nov) |

## 7. Stage results

**D.1 to D.5 (6 Nov 2026).**
- **Deck:** 88 request cards, 32 riddle lead-ins (one per villager), 5 endings, 11 story chains (dragon egg, circus, Cog's flying machine, ghost party, treasure map, giant pumpkin…). `shared/decree/cards.ts`.
- **Balance** (`npx tsx scripts/decree-sim.ts`, 2,000 reigns each): a careful player lives a full reign nearly every time; a random tapper about 25% of the time (about 50% if they get 70% of riddles right); "always yes" runs out of gold in about 10 cards. Riddles clearly help but aren't needed.
- **Art:** 26 villagers painted on the gaming PC (Z-Image Turbo), cut out, 720 px + 240 px WebPs (about 1.5 MB). Contact sheet: `docs/decree-art/contact-sheet.png`. Three needed repaints (Pip had a pig snout, Captain Bryn looked like a man, Ox had horns).
- **Screens:** each yes/no button shows its arrows (tablets have no hover); the meters show them too while you drag. Hale gives first-reign tips and warns once when a meter is low. Fits 1366×640 and 844×390.
- **Server:** function `decree`, migration `20261106000200_decree.sql` (pgTAP 24/24 on a scratch database), `decree_enabled` default on, hub hooks and 6 achievements.
- **Tests:** 7 (2 rules, 3 server, 2 screens).
- **Fixed while testing:** after a reload, a riddle already answered on the server had no button to move on.


**D.7 go live (6 Nov 2026).** Code switch on; `decree` added to the games list (Easy maths games, using Kingdom Keeper's card picture for now) and to `FUNCTIONS`. Kingdom Keeper's code switch is off; it stays in `ALL_GAMES` so teachers still see its row and old points keep its name. The migration and the `decree` function go live when the PR merges.
