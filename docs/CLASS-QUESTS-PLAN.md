# Weekly class quests

**Status:** stage 1 live 18 Nov 2026 (PR #551, migration `20261118000100_class_quests.sql`): Star Trader, Dragon Maths and Clan Quest "all your turns" quests, with the class teacher playing along. Stage 2 (two quests for every complex and easy maths game, 27 new) built 18 Nov 2026 on branch `claude/quest-stage2`, migration `20261118003100_class_quests_more.sql`. Tallies are only kept for players whose class has a quest running that counts them.

James (18 Nov 2026): a teacher sets a weekly class quest; pupils must play a game properly on 5 days out of 7. A quest tracker
bar on the home page when the class has one. Teachers track every pupil. Achievements for 1, 5, 10, 15 and 20 quests done.
More quest kinds will follow, so a quest kind is one entry in one list.

## James's answers (question card, 18 Nov 2026)

| Question | Answer |
|---|---|
| How a quest week runs | **One-off week.** The teacher starts a quest; it runs 7 days (the day it starts is day 1), then ends. The teacher starts the next one. |
| Days needed | **Always 5** out of the 7. |
| Rewards | **Achievements** at 1, 5, 10, 15, 20 quests done (all kinds together) **+ painted "Questing Hero" trophy**: bronze at 5, silver at 10, gold at 20. |
| What pupils see of classmates | **Own bar + class count** ("9 heroes finished"), no names. |
| The teacher | **Can play along and finish it too** (James, same day): their days count, the bar shows on their home page, they get the achievements and trophy, and they have their own row (marked teacher) in the class table. |

## The first three quests

A **quest day** is a New Zealand day on which the pupil used up all of that game's daily turns (whatever the teacher set as turns a day).

| Kind | Game | A day counts when | Bar words |
|---|---|---|---|
| `trader` | Star Trader | jumps left reaches 0 | "Use all your jumps" |
| `lord` | Dragon Maths | forest fights left reaches 0 | "Use all your forest fights" |
| `clans` | Clan Quest | mine fights left reaches 0 | "Use all your mine fights" |

The list lives in `shared/quests/kinds.ts` (name, game, words, art, the "left today" number from the home page's moves).
A new kind later = a list entry + a watcher on that game's table + a painting.

## How it counts (all on the server)

- **`quest_days`** (player, kind, NZ date). Written only by small watchers (triggers) on each game's own table
  (`trader_games`, `lord_heroes`, `clans`) when the turns-left number drops to 0 in a save. The games' own code is not
  changed, and a watcher error never loses a save (same pattern as the trophy watchers, `20261112001700`). Days are kept
  whether or not a quest is running, so a day earlier on the day a quest starts still counts.
  - Turns left drops to 0 = old value above 0 (or a new game day) and new value 0. Opening the game next morning before the
    day rolls over can't count.
  - Teacher's "unlimited turns today": the count still reaches 0 on the normal last turn, so the day counts once.
- **`class_quests`**: id, class, kind, `starts_on`, `ends_on` (= starts_on + 6), started by, stopped at. One running quest per
  class. Started and stopped only through `teacher_start_class_quest` / `teacher_stop_class_quest` (teacher of that class).
- **`quest_wins`** (quest, player): written by the `quest_days` watcher the moment a pupil in that class has 5 quest days inside
  the quest's dates. Then: `game_progress_changed(player, 'quests')` (achievements), and the trophy step if it is 5, 10 or 20.
- **Hub hooks** (`hub_games` row `quests`, no switch, `keep_achievements` true): measure `quests_done`; achievements
  First Quest (1), Quest Seeker (5), Quest Knight (10), Quest Champion (15), Quest Legend (20). Trophy `quest-hero`,
  repeat `steps` (step 1 = bronze at 5, 2 = silver at 10, 3 = gold at 20).
- Quest wins stay through a New Season (they are a record of weeks played, not points).
- No points (James chose achievements + trophy).

## Pupil home page: the quest bar

Shown under the welcome strip while the class has a quest running, and for 2 days after it ends ("Quest over").
`my_class_quest()` answers: the quest (kind, dates), my 7 days (done / missed / today / still to come), whether I've won,
how many classmates have won (a number only), and my quests done in total.

- The quest's **painting fills the bar**, title in a slim strip on top ("Weekly quest · Star Trader: Every Jump").
- **Seven day-stones** across the painting. A done day is lit (gold flame for Dragon, star burst for Trader, torch for Clans);
  today's stone pulses; missed days are dark; days to come are faint. `3 of 5 days · 4 days left`.
- Today line: "6 jumps left today" (from the moves the home page already reads) and a **Play** button to the game.
  When today is done: "Today done! ✓".
- Small chip: "🏅 9 heroes finished" (class count, no names).
- **Quest won:** the stones flare one by one, a gold banner "Quest complete!" sweeps in with confetti, and the trophy rises if
  this win reached a new metal. Shown once per quest (remembered in the browser; nothing depends on it).
- A day ticks over to lit the next time the home page opens after the last turn.

## Teacher: new "Quests" tab

- **Start a quest:** three painted cards (one per kind). Greyed out with a note if that game is switched off for the class.
  Pick one → "Start this week's quest" → runs today plus 6 days.
- **Running quest:** title, dates, "11 of 26 finished", and a table: pupil, seven dots (done / missed / today / to come),
  days out of 5, ✓ finished, quests done in total. Sorted so pupils who still need days are easy to spot.
- **Stop quest** (asks first). Stopped quests give no new wins; wins already made stay.
- **Past quests:** date, kind, finished count; tap for that week's table.

## Art (painted in ComfyUI on this PC, `docs/quests-art/config.json`)

| Painting | Use |
|---|---|
| `quest-trader` (wide scene) | Star Trader quest bar + teacher card: a little trading starship leaping between glowing jump lanes |
| `quest-lord` (wide scene) | Dragon Maths quest: a young hero facing a forest beast in a misty enchanted forest |
| `quest-clans` (wide scene) | Clan Quest quest: clan warriors with torches at a glowing mine entrance in the hills |
| `questing-hero` bronze, silver, gold (icon) | The Questing Hero trophy: a hero's compass-shield with a banner |

## Animation

- Bar: slow drift on the painting, day-stones light with a spark burst and glow ring; today's stone pulses.
- Quest complete: stones flare in a wave, banner sweep, confetti, trophy rise. Respects reduced motion.
- Teacher table: none beyond the dots.

## Stages

1. **Everything above** in one PR: migration, watchers, rules, home bar, teacher tab, art, achievements and trophy.
2. Later: more quest kinds (James will send ideas), maybe quests needing other things than "all turns".

## Stage 2: two quests for every complex and easy maths game (planned 18 Nov 2026)

James (18 Nov 2026): plan 2 quests for each complex maths game and each easy maths game. They must **not be too hard**:
they reward **playing more**, never winning, stars, medals or right answers.

### Sizing from real play

Last 3 weeks of pupils' goes (live database, 18 Nov 2026): on a day a pupil plays a game they usually do **1 to 4 goes**
(Toon Flap 4, most others 2), and most pupils play a game on only **1 or 2 days in 3 weeks**. So the targets are small:

- **Daily quests** ("days"): a small amount on **5 of 7 days**, the same rule as the first quests. The daily amount is at or
  below what a pupil already does on a day they play. Building the habit is the hard part, not the day.
- **Weekly quests** ("total"): a modest total over the 7 days, on **any days**: about two or three normal days of play.
  Catch-up friendly: a pupil who missed Monday can still finish.

Every number below is a first guess from that data, kept in one config list so it can be tuned after a week of real quests.

### Complex maths games

| Game | Quest | Kind | To finish |
|---|---|---|---|
| Star Trader | **Every Jump** (live) | days | Use all your jumps, 5 of 7 days |
| Star Trader | **Star Explorer** | total | Land at **6 different planets** this week |
| Dragon Maths | **Forest Hunter** (live) | days | Use all your forest fights, 5 of 7 days |
| Dragon Maths | **Arena Regular** | days | Fight **1 arena fight** (any result), 5 of 7 days |
| Clan Quest | **Mine Raider** (live) | days | Use all your mine fights, 5 of 7 days |
| Clan Quest | **Village Raider** | total | Raid classmates' villages **6 times** this week (losing costs nothing) |
| Kingdom Keeper | **Royal Routine** | days | Rule **1 year** of your reign, 5 of 7 days |
| Kingdom Keeper | **Crown Week** | total | Finish **2 reigns** this week (any rating) |
| Maths Monsters | **Monster Trainer** | days | Have **3 battles**, 5 of 7 days (12 allowed a day) |
| Maths Monsters | **Monster Catcher** | total | **Catch 3 monsters** this week |

### Easy maths games

| Game | Quest | Kind | To finish |
|---|---|---|---|
| Archery Challenge | **Daily Archer** | days | Finish **1 bot fight** (win or lose), 5 of 7 days |
| Archery Challenge | **Quiver Filler** | total | Finish **6 maths sets** this week |
| Bond Match | **Match Habit** | days | Finish **2 matches**, 5 of 7 days |
| Bond Match | **Match Marathon** | total | Finish **10 matches** this week |
| Royal Decree | **Daily Decrees** | days | Decide **10 cards**, 5 of 7 days |
| Royal Decree | **Meet the Village** | total | Meet **6 different villagers** this week |
| Diamond Drop | **Daily Dig** | days | Play **1 level** (replays count), 5 of 7 days |
| Diamond Drop | **Claw Champion** | total | Play **10 levels** this week (replays count) |
| Gem Keep | **Keeper's Watch** | days | Play **1 level** (any result), 5 of 7 days |
| Gem Keep | **Wave Breaker** | total | Play **6 levels** this week |
| Sky Isles | **Island Keeper** | days | Use all **6 turns**, 5 of 7 days |
| Sky Isles | **Sky Racer** | total | Start **6 races** this week (any result) |
| Marble Rush | **Daily Roll** | days | Roll **2 runs**, 5 of 7 days |
| Marble Rush | **Marble Marathon** | total | Roll **12 runs** this week |
| Mine Runner | **Daily Dive** | days | Fly **2 runs**, 5 of 7 days |
| Mine Runner | **Deep Diver** | total | Fly **10 runs** this week |
| Wormholes & Black Holes | **Launch Day** | days | Finish **1 space game** (bots or classmates), 5 of 7 days |
| Wormholes & Black Holes | **Wormhole Rider** | total | Ride **10 wormholes** this week |
| Toon Flap | **Daily Flight** | days | Finish **3 runs**, 5 of 7 days |
| Toon Flap | **Frequent Flyer** | total | Finish **15 runs** this week |

That is 30 quests: the 3 live ones plus 27 new. Every quest finished counts towards the same quests-done achievements
(1, 5, 10, 15, 20) and the Questing Hero trophy.

### How it counts (changes from stage 1)

- `quest_kinds` gains the quest's game, its **rule** (`days` or `total`), the daily amount or the weekly target, and the
  **measure** it counts. One list in `shared/quests/kinds.ts` matches it.
- New table **`quest_tallies`** (player, measure, NZ day, count), written only by small watchers on each game's own table
  (same pattern as stage 1: the games' code is not changed, a watcher error never loses a save). For example a new row in
  `marble_runs` adds 1 to `marble_runs` for today; `kingdom_reigns.year` going up adds 1 to `kingdom_years`.
- "Different" quests (Star Explorer's planets, Meet the Village's villagers) also keep which ones were counted
  (`quest_marks`: player, measure, key, day), so the same planet twice counts once.
- **days** quests: a day is done when that day's tally reaches the daily amount; 5 of 7 wins. **total** quests: the week's
  tallies (or different keys) reach the target. The stage 1 "all your turns" quests keep working as they are.
- The win is written the moment the tally crosses the line, as now.

### Screens

- **Quest bar:** days quests look as now. Total quests keep the seven day-stones (lit on days the pupil played) and the meter
  becomes the count, "7 of 12 runs", with a spark on the meter each time it grows.
- **Teacher's Quests tab:** the cards are grouped **Complex maths** and **Easy maths**, then by game (two cards each). The
  table's "Days" column becomes "7/12" for a total quest. Still one quest at a time per class.
- A quest whose game is switched off for the class still shows the warning.

### Art (ComfyUI on this PC)

One wide painting per new quest, **27 paintings** (about 25 seconds each), in each game's own look, plus a day-stone spark
per game (emoji: 🏹 Archery, 💎 Diamond Drop, 🎈 Toon Flap, and so on). The three live paintings stay.

### Building it

1. Engine: `quest_kinds` columns, `quest_tallies`, `quest_marks`, the general win check, watchers for all 12 games,
   the bar and teacher tab changes, database test.
2. Art: the 27 paintings, picked and tidied.
3. After a week: look at how many pupils finished each quest and tune the numbers in the one list.

## Privacy

Stored: per pupil, which NZ days they used all of a game's turns, and which class quests they finished. Pupils see only their
own days and a class count. Teachers see their own class. Nothing about maths results.
