# Clan Quest: two end of season goals (plan, 28 Oct 2026)

James: "I would like to add two overarching end of season goals, like Dragon Maths has with killing the dragon. One should be a fully upgraded village, and the other should be killing a massive monster that attacks your village and your 4 clan members in the last week of the challenge."

Nothing is built yet. This plan builds on "My Village" (live 28 Oct 2026, [CLANS-SIMPLER-PLAN.md](CLANS-SIMPLER-PLAN.md)). Recommendations are marked **Recommended**; the choices for James are in the last section.

---

## 1. What Dragon Maths does, and what we copy

Dragon Maths ([LORD-PLAN.md](LORD-PLAN.md) sections 9 and 11, [DRAGON-SCHOOL-SEASON.md](DRAGON-SCHOOL-SEASON.md)):

- **A season clock.** Seasons are 35 days back to back from one start date (now one date for the whole school, set by a school admin, with a holiday pause). A countdown shows in the last days.
- **One big goal at the end.** The dragon is a long fight in three stages, with a maths riddle before each stage that gives a *small* edge. "A fight, not a test": gear and skills decide it, maths nudges it. You can try again each day.
- **Winning is remembered.** A big news story, points (10), an achievement, a star, and the **Hall of Heroes** (who beat the dragon each season), kept for good.
- **Losing costs little.** A lost dragon fight sends you home.

**Copy:** the season clock with a countdown, a big fight with maths that nudges, try again each day, the Hall, news, achievement and points.
**Change:** Clan Quest has *two* goals, a slow one (the village, built over weeks) and a fast one (the monster, in the last week). The village should feed into the monster fight, so the two goals are one story: *build your village up so it can stand against the monster.*

## 2. What Clan Quest has today (the gap)

- **There is no season clock.** The only "season" is the teacher's **New fame season** button, which sets fame back to 0 and keeps everything else. So "the last week of the challenge" doesn't exist yet. Goal 0 is a clock.
- **The village fills in about 4 weeks for a clan that plays every day.** Simulator, 28 Oct (`npm run clans:sim -- --days 42 --seeds 8 --empire 1`): all 8 clans had every building at max (39 levels) by day 28 to 31, 4.1 weeks on average. Real pupils play less, so expect about 6 to 8 weeks for a 3 to 4 days a week clan. The **2 builds a day** rule is the real limit: 39 builds need at least 20 play days.
- **After the village is full, gold just piles up** (simulator: about 7,600 gold by day 35 and 17,900 by day 42 with nothing to spend it on). The monster week can give it a use.
- **Clans already have bosses** (mine bosses at depth 5, 10, 15 and 20, the last is the Emerald Dragon, 53 HP) and a **battle** for armies (walls, tower, forge, troops). The monster fight reuses both engines, so no new fight engine is needed.

## 3. The season clock

**James chose 5 weeks (35 days), like Dragon Maths (28 Oct 2026)**, running back to back from a start date.

- **Recommended: use Dragon Maths' school season date itself** ([DRAGON-SCHOOL-SEASON.md](DRAGON-SCHOOL-SEASON.md)): one date for the whole school, set by a school admin, with the same holiday pause. Then both games' seasons start and end on the same day, there is one date to set, and teachers see one "Season 3, 12 days left" line. Clan Quest reads it through `lord_school_season_row` (or a shared `school_season()` wrapper), so no second date or admin box is needed. (If James later wants them apart, a Clan Quest column on the same row is easy.)
- **The shape of a season:**

  | Days | What happens |
  |---|---|
  | 1 to 28 | Mines, building, raids, as now. A progress bar on the home screen: "Village 23 / 39". |
  | 22 to 28 | Warnings: news lines ("Giant footprints were found by the river"), a home-screen countdown "The Storm Giant arrives in 5 days". The **Monster supplies** shop opens (section 5.6). Classmate raids stop from here to the end of the season. |
  | 29 to 35 | **Monster week.** The giant attacks every clan's village. One try each day (section 5.4). |
  | Day 35 | Season ends. The Hall is written. A new season starts the next day. |

- **5 weeks means the village must fill faster** (section 4): today 39 builds at 2 a day need 20 play days, and a 3 to 4 days a week pupil gets only about 12 to 16 play days before monster week.

- The teacher's **New fame season** button goes; fame resets with the clock instead. (Kept in place, unused, until the clock is live.)

## 4. Goal 1: a fully upgraded village

**The goal:** every building at its top level (Training Hall 5, Smithy 6, Church 3, Barracks 5, Walls 5, Tower 5, Forge 5, Strongroom 5 = **39 levels**).

**On screen**
- A **"Village 23 / 39" bar** on the home screen and at the top of My Village, with "16 levels to go".
- The village picture already grows (3 sizes per building). At 39 / 39 it gets a **golden banner** on the keep and a "Village complete" ribbon.
- Scoreboard: a small castle icon next to clans with a complete village this season.

**When a clan finishes it**
- A celebration screen, a news line ("Clan Kowhai finished their village!"), **+50 fame**, **10 points** (inside the 40-a-day cap, like the dragon), the achievement **Master Builder**, and a place in the season's **Hall of Legends** (section 6), with the day they did it.
- It also makes the monster fight easier (section 5), which is the main reward.

**Fairness**
- **Faster building for a 5-week season (Recommended):** keep "2 builds a day" as the rule kids see, but **builds you didn't use pile up, up to 6** (like Dragon Maths' saved-up turns, so a 3-days-a-week pupil gets about 4 builds each time they play), and **cut the bases from 150 to about 100 gold**. Target, checked with the simulator: a daily clan finishes in week 3, a 3 to 4 days a week clan by the end of week 4 (just before the giant), and a 2 days a week clan gets about 30 / 39. Without this, 39 builds take 20 play days however much gold you have, and most pupils couldn't finish in 5 weeks.
- **Raids can knock a level off** (never Walls or Strongroom). A clan at 39 / 39 that gets raided drops to 38 and must rebuild. **Recommended: once complete, the village is "complete for the season"** for the goal: the badge and Hall place are kept even if a raid knocks a level off later. The level still has to be rebuilt to get its effect back.
- The simulator needs a "3 days a week" and "2 days a week" bot to check the targets above.

## 5. Goal 2: the monster

### 5.1 Who it is

**Recommended: "Grimmor the Storm Giant"**, a huge mountain giant who comes down from the hills, throwing boulders and stamping. Not a dragon, because Dragon Maths has one and the Emerald Dragon is already the depth-20 mine boss. Gentle wording, like the rest of the game: buildings are "flattened", members are "knocked out", and the giant "stomps off back to the mountains" when beaten. Picture made in ComfyUI on James's gaming PC (one big giant, one "village under attack" scene), same style as the rest ([CLANS-ART-PLAN.md](CLANS-ART-PLAN.md)). Other options: a frost troll, a stone golem, a sea serpent.

**James chose a new monster each season (28 Oct 2026).** Three monsters take turns, picked from the season number (season 1 the giant, 2 the golem, 3 the troll, then round again):

| Monster | Look | Its big move (every third round, you see it coming) |
|---|---|---|
| Grimmor the Storm Giant | A huge mountain giant | Throws a boulder at one member |
| Old Craghold the Stone Golem | A slow walking hill of rock | Slams the ground: everyone takes a little damage |
| Frostjaw the Frost Troll | A shaggy wintry brute | Icy breath: one member is frozen for a round |

All three share the same HP and strength, so the balance and the simulator only need doing once; only the name, picture, words and big move change. The art is 3 monsters, each with a portrait and a "village under attack" scene (6 pictures). More monsters can join the turn later. "The giant" below means whichever monster it is that season.

### 5.2 The fight: two parts, like the dragon's stages

**Part 1: The siege (your village fights).** About 30 seconds, shown as 3 short rounds with the existing battle screen.
- The giant attacks the village. **Walls** cut the damage, the **Tower** and your **troops** (footmen, axemen, knights) hit it, and the **Forge** makes the troops hit harder.
- Each round has one maths question in the Battle Cry style: "The tower fires 4 volleys of 35. How much damage?" Right = +25% damage that round, as now.
- **What the siege does:** it knocks HP off the giant before your clan meets it. A complete village with a full army knocks off about **40%**. An empty village knocks off almost nothing. The giant also flattens buildings in the siege *for show only*: they pop back up after the fight (no real loss, see 5.4).

**Part 2: The clan fight (your 4 members fight).** The normal mine fight, against one huge boss, with Battle Cry every round, spells, guard and scrolls.
- The giant has big HP (about 8 to 10 times the Emerald Dragon), **hits two members at once** with a stomp, and every third round **throws a boulder** that you can see coming ("Grimmor lifts a boulder!") so Guard matters.
- The **Training Hall, Smithy and Church** help here: better-trained members, better gear, and free wake-ups.
- **Barracks** help in part 1 (more troops). **Strongroom** is the only building that doesn't help in the fight (its job is raids).

So every building matters, and a full village is the best way to beat the giant. That ties goal 1 to goal 2.

### 5.3 How hard (targets for the simulator)

| Clan | Win chance per try |
|---|---|
| Members level 18 to 20, village complete, full army, good gear | about **65%** |
| Members about level 15, village about 25 / 39 | about **30%** |
| Members about level 10, village about 10 / 39 | about **5%** (a stretch, with the "tired giant" rule below) |
| Every Battle Cry answered right versus none | about +15 points, a nudge, not a test |

Tuned with `npm run clans:sim` and a new `--monster` option. The giant's numbers live in `CONFIG.monster` like everything else.

### 5.4 Tries and losing

- **Recommended: one try each school day of monster week (5 tries)**, and **the giant gets tired**: each failed try leaves it 10% weaker for that clan the next day (up to 40% weaker on day 5). So a clan that keeps going will very likely win by the end of the week, and a strong clan can win on Monday. That's the catch-up the Dragon Maths pace notes asked for.
- **Losing costs nothing real.** Members are knocked out until tomorrow (free wake-up), and the village is not damaged. "Grimmor stomps off for the night. He'll be back tomorrow."
- A pupil who doesn't play in monster week just misses it. A pupil who was away can still try every day they're in.
- **A clan that wins** gets a **trophy on its village** (the giant's club, kept for good), +100 fame, **10 points**, the achievement **Giant Slayer**, a news story, and a place in the Hall. After winning, the clan can still fight the giant again for fun (fame only), so the class can keep playing in week 10.

### 5.5 Mines and raids in monster week

- **Mines stay open** (to level up and earn gold for supplies), at the usual fights a day.
- **Classmate raids are off in the last 2 weeks (days 22 to 35)** (James, 28 Oct 2026), so a raid can't flatten someone's walls on the eve of the fight, and everyone faces the same giant. Raids on computer kingdoms stay.

### 5.6 Monster supplies (a use for spare gold)

From day 22 the market sells three one-off supplies, each limited (so a rich clan can't buy a guaranteed win):
- **Fire arrows** (the tower hits harder in the siege), up to 3;
- **Healing potions** (heal a member mid-fight), up to 4;
- **Giant net** (the giant misses its first boulder), 1.

Each has a maths moment ("3 fire arrows at 250 gold each, plus 10% tax?"). Prices are high (about 1,000 to 2,000 gold) so the gold that piles up after a full village has a job. Optional: it can be left out of the first build.

## 6. Remembering winners: the Hall of Legends

One row per clan per season: did they complete the village (and the day), did they beat the giant (and the day, and how many tries). Kept for good, like Dragon Maths' Hall of Heroes. Shown:
- in the game, as **Hall of Legends** under Scoreboard: this season's builders and giant slayers, then past seasons;
- on the teacher page: who in the class finished each goal.

Names are hub names; hidden profiles aren't shown. Never maths scores.

## 7. What starts again at a new season

This is James's call (question 2). The options:

1. **Recommended: the village starts again; the clan keeps its members.** Every building goes back to level 0 and the troops go home. Members keep their levels, gear and training. The purse keeps up to 500 gold (the rest is "spent on the giant's feast"). Kept for good: trophies, achievements, the Hall. *Why:* both goals can be won again each season, and a new or slow clan isn't hopelessly behind a clan with a full village. *Bad:* pupils lose their buildings, so it must be clear from day 22 ("Your village is rebuilt fresh next season; your trophy stays forever").
2. **Keep everything.** The village goal can only be won once ever; after that, only the giant matters (and a new, stronger giant each season). Kind to pupils, but from season 2 or 3 the goal is already done for most.
3. **Halfway:** every building drops 2 levels. A middle path, but harder to explain.

Members' levels: the simulator has a daily clan at level 20 by week 3 to 4, and the rules sheet says about 7 weeks for a mixed clan. So after two or three seasons most clans' members are maxed. Resetting members too is possible (like Dragon Maths heroes), but they are what pupils care about most, so not recommended.

## 8. What the build changes (for later)

**Two PRs, each live once James says so.**

**PR 1: the season clock and goal 1 (the village)**
- Engine (`shared/clans/`): `seasonOf(start, today)` with day, week and phase ("build", "warning", "ready", "monster"); `villageComplete(levels)`; saved-up builds (`buildsSaved`, up to 4); the new-season reset (`newSeasonSave`, pure and tested).
- Server: one migration that reads Dragon Maths' school season date and pause, `clans_school_season()`, `clan_hall` (clan, season, village_done_on, giant_done_on, giant_tries), and the season roll-over in the nightly job. The `clans` function sends the season with the clan and records the village goal.
- Screens: the village bar, golden banner, celebration, countdown line, Hall of Legends, the season line in the teacher drawer (read-only; the date is set in Dragon Maths). How to play updated.
- Fame, points (`CONFIG.rewards`), the Master Builder achievement.

**PR 2: goal 2 (the giant)**
- Engine: `CONFIG.monster`, the siege (reusing `battle()` with fixed giant numbers), the giant as a boss in `fight.ts` (two-target stomp, boulder every third round), the tired rule, monster supplies.
- Server: the `clans` function hands out one giant fight a day in monster week, replays it like a mine fight and records the win. Raids off from day 22.
- Screens: the siege, the giant fight, the trophy, news lines, warnings from day 22.
- Art: the giant and the siege scene.
- Simulator: `--monster` to check the table in 5.3.

**Shared files.** Both PRs touch `shared/clans/config.ts`, `empire.ts` and `MyVillage.tsx`, which the My Village work also changes. Check with that thread (and the migration number, GAME_DEVELOPMENT_GUIDE) before starting.

**Going live.** If Clan Quest shares Dragon Maths' date, its first season starts at the next Dragon Maths season start after PR 1 is live, so nothing resets mid-season. Until then the bar and Hall can be live with no clock (the village goal works without a season; the giant waits for one).

## 9. Questions for James

1. ~~Season length?~~ **Answered 28 Oct 2026: 5 weeks, like Dragon Maths.** Follow-up: share Dragon Maths' school date (Recommended)?
2. At a new season: **the village starts again, members kept (Recommended)**, or keep everything, or every building drops 2 levels?
3. ~~Giant tries?~~ **Answered 28 Oct 2026: one a day in monster week, and the monster gets tired.**
4. ~~Classmate raids?~~ **Answered 28 Oct 2026: off in the last 2 weeks** (days 22 to 35 of a 5-week season).
5. ~~Which monster?~~ **Answered 28 Oct 2026: a new monster each season** (giant, golem, troll in turn; section 5.1).
6. When to start: **at the next Dragon Maths season start after the build, with the village bar live now (Recommended)**, or a test season straight away?
