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

**Recommended: a Clan Quest season is 10 weeks (70 days), one school term**, running back to back from a start date.

- Why 10, not Dragon Maths' 5: the village alone takes a steady pupil 6 to 8 weeks. In 5 weeks only daily players would finish it.
- **One date for the whole school**, set the same way as Dragon Maths ([DRAGON-SCHOOL-SEASON.md](DRAGON-SCHOOL-SEASON.md)): a school admin sets "First day of season 1" and can switch on a holiday pause. Until the Admin page exists, it sits in the Clan Quest teacher drawer. A teacher with no admin sees it read-only. Built with the same pattern (`clans_school_season()`, `admin_set_clans_season(date)`, `admin_set_clans_holiday(on)`).
- **The shape of a season:**

  | Weeks | What happens |
  |---|---|
  | 1 to 8 | Mines, building, raids, as now. A progress bar on the home screen: "Village 23 / 39". |
  | 7 and 8 | Warnings: news lines ("Giant footprints were found by the river"), a home-screen countdown "The Storm Giant arrives in 12 days". |
  | 9 | "Get ready week": the monster is seen in the hills. Classmate raids stop (so nobody's walls are knocked down right before the fight). A one-off **Monster supplies** shop opens (section 5.6). |
  | 10 | **Monster week.** The monster attacks every clan's village. One try each day (section 5.4). |
  | Day 70 | Season ends. The Hall is written. A new season starts the next day. |

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
- **Saved-up builds (Recommended):** builds you didn't use pile up, up to 4 (like Dragon Maths' saved-up turns). A pupil who plays 3 days a week can then still finish. Without it, 39 builds take 20 play days however much gold you have.
- **Raids can knock a level off** (never Walls or Strongroom). A clan at 39 / 39 that gets raided drops to 38 and must rebuild. **Recommended: once complete, the village is "complete for the season"** for the goal: the badge and Hall place are kept even if a raid knocks a level off later. The level still has to be rebuilt to get its effect back.
- Price check: the bases (150 gold × level) were tuned for 4 to 5 weeks of daily play, which fits a 10 week season with room to spare. Re-run the simulator with a "3 days a week" bot once saved-up builds exist, aiming for a 3-days-a-week clan to finish in week 7 or 8.

## 5. Goal 2: the monster

### 5.1 Who it is

**Recommended: "Grimmor the Storm Giant"**, a huge mountain giant who comes down from the hills, throwing boulders and stamping. Not a dragon, because Dragon Maths has one and the Emerald Dragon is already the depth-20 mine boss. Gentle wording, like the rest of the game: buildings are "flattened", members are "knocked out", and the giant "stomps off back to the mountains" when beaten. Picture made in ComfyUI on James's gaming PC (one big giant, one "village under attack" scene), same style as the rest ([CLANS-ART-PLAN.md](CLANS-ART-PLAN.md)). Other options: a frost troll, a stone golem, a sea serpent.

A different monster each season could come later (giant, then golem, then serpent), picked from the season number, with the same numbers.

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

- **Recommended: one try each school day of monster week (5 tries)**, and **the giant gets tired**: each failed try leaves it 10% weaker for that clan the next day (up to 40% weaker on day 5). So a clan that keeps going will very likely win by Friday, and a strong clan can win on Monday. That's the catch-up the Dragon Maths pace notes asked for.
- **Losing costs nothing real.** Members are knocked out until tomorrow (free wake-up), and the village is not damaged. "Grimmor stomps off for the night. He'll be back tomorrow."
- A pupil who doesn't play in monster week just misses it. A pupil who was away can still try every day they're in.
- **A clan that wins** gets a **trophy on its village** (the giant's club, kept for good), +100 fame, **10 points**, the achievement **Giant Slayer**, a news story, and a place in the Hall. After winning, the clan can still fight the giant again for fun (fame only), so the class can keep playing in week 10.

### 5.5 Mines and raids in monster week

- **Mines stay open** (to level up and earn gold for supplies), at the usual fights a day.
- **Classmate raids are off in weeks 9 and 10** (Recommended), so a raid can't flatten someone's walls on the eve of the fight, and everyone faces the same giant. Raids on computer kingdoms stay.

### 5.6 Monster supplies (a use for spare gold)

In weeks 9 and 10 the market sells three one-off supplies, each limited (so a rich clan can't buy a guaranteed win):
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

1. **Recommended: the village starts again; the clan keeps its members.** Every building goes back to level 0 and the troops go home. Members keep their levels, gear and training. The purse keeps up to 500 gold (the rest is "spent on the giant's feast"). Kept for good: trophies, achievements, the Hall. *Why:* both goals can be won again each term, and a new or slow clan isn't hopelessly behind a clan with a full village. *Bad:* pupils lose their buildings, so it must be clear from week 7 ("Your village is rebuilt fresh next term; your trophy stays forever").
2. **Keep everything.** The village goal can only be won once ever; after that, only the giant matters (and a new, stronger giant each season). Kind to pupils, but in term 2 the goal is already done for most.
3. **Halfway:** every building drops 2 levels. A middle path, but harder to explain.

Members' levels: the simulator has a daily clan at level 20 by week 3 to 4, and the rules sheet says about 7 weeks for a mixed clan. So by term 2 most clans' members are maxed. Resetting members too is possible (like Dragon Maths heroes), but they are what pupils care about most, so not recommended.

## 8. What the build changes (for later)

**Two PRs, each live once James says so.**

**PR 1: the season clock and goal 1 (the village)**
- Engine (`shared/clans/`): `seasonOf(start, today)` with day, week and phase ("build", "warning", "ready", "monster"); `villageComplete(levels)`; saved-up builds (`buildsSaved`, up to 4); the new-season reset (`newSeasonSave`, pure and tested).
- Server: one migration with the school season date and holiday pause on the school's default `app_settings` row (copying Dragon Maths), `clans_school_season()`, the admin functions, `clan_hall` (clan, season, village_done_on, giant_done_on, giant_tries), and the season roll-over in the nightly job. The `clans` function sends the season with the clan and records the village goal.
- Screens: the village bar, golden banner, celebration, countdown line, Hall of Legends, the teacher drawer's season box. How to play updated.
- Fame, points (`CONFIG.rewards`), the Master Builder achievement.

**PR 2: goal 2 (the giant)**
- Engine: `CONFIG.monster`, the siege (reusing `battle()` with fixed giant numbers), the giant as a boss in `fight.ts` (two-target stomp, boulder every third round), the tired rule, monster supplies.
- Server: the `clans` function hands out one giant fight a day in monster week, replays it like a mine fight and records the win. Raids off in weeks 9 and 10.
- Screens: the siege, the giant fight, the trophy, news lines, warnings in weeks 7 to 9.
- Art: the giant and the siege scene.
- Simulator: `--monster` to check the table in 5.3.

**Shared files.** Both PRs touch `shared/clans/config.ts`, `empire.ts` and `MyVillage.tsx`, which the My Village work also changes. Check with that thread (and the migration number, GAME_DEVELOPMENT_GUIDE) before starting.

**Going live.** The first season's start date: **Recommended: the first day of term 1 2027**, so the first giant comes in the last week of term 1. Nothing resets mid-term this year. Until then the bar and Hall can be live with no clock (the village goal works without a season; the giant waits for one).

## 9. Questions for James

1. Season length: **10 weeks, one term (Recommended)**, or 5 weeks like Dragon Maths, or the teacher picks the end date?
2. At a new season: **the village starts again, members kept (Recommended)**, or keep everything, or every building drops 2 levels?
3. Giant tries: **one a day in monster week, and the giant gets tired (Recommended)**, or one try only, or as many as you like?
4. Classmate raids in the last 2 weeks: **off (Recommended)** or on as usual?
5. The monster: **Grimmor the Storm Giant (Recommended)**, or a stone golem, a frost troll or a sea serpent?
6. When to start: **the first season starts on the first day of term 1 2027, with the village bar live now (Recommended)**, or a short test season this term?
