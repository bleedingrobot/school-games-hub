# Clan Quest: plan

A daily-turns fantasy game for the hub, inspired by the 1997 BBS door game *The Clans* by Allen Ussher. You lead a small clan of four adventurers: send them into the mines to fight monsters, train and equip them, build an empire of land, barracks and troops, and work with the whole class to grow your village. **Maths is the tool that makes the clan stronger**: working out the shop's bill with tax, spending training points, sharing out land and troops, counting damage, cracking a quest puzzle.

Written 18 October 2026 for James, after reading the game's real source code and manuals (section 1) and the hub's other plans.
**Status: ANSWERED 18 Oct 2026 (section 13). Stage C.0 started 18 Oct 2026: first draft of the rule sheet is in [CLANS-RULES.md](CLANS-RULES.md), on the `clans` branch.** Stage C.1 (engine) first pass done 18 Oct 2026: see "Stage C.1 results" at the bottom. Dragon Maths goes first; this starts after it, since they share the engine and maths packs (section 2).

## The short version

- **The source code exists and is free.** The game was made open source in 2002 and is now looked after by the Synchronet BBS team. It's written in C and licensed **GPL-2**. It's a text game for phone-line BBS computers, with players on different BBSs travelling between "villages". It can't run on the hub (no always-on server, terminal screens, typed-in sign-in).
- **So, like Dragon Maths: the original is our rule book, not our code base.** We write our own small engine in TypeScript using the game's *shape and numbers* (four-person clan, mines, agility-first turns, training points, market, church, barracks, footmen/axemen/knights) with our own kid-friendly names, writing and pictures. No code or text copied, which also keeps the hub free of GPL. Credits at the bottom.
- **What makes it different from our other games:** you run a *team of four* (not one hero), and there's a second half of the game that isn't fighting at all: an **empire** you build with land, buildings and an army. That gives maths a natural home in lots of small, different places, not only in fights.
- **The whole class shares one village.** In the original, players voted for a ruler who set taxes and could be overthrown. That's a recipe for hurt feelings among 9-year-olds, so we turn it into a **class project**: everyone drops gold in the village chest, and the class votes between three buildings to build next. No taxes on friends, no overthrowing.
- **Saved on the server, server is the boss**, the same way as Dragon Maths and the bot games: the server hands out each fight with a seed, the browser plays it, the server replays it to check.
- **Maths is optional-feeling and short:** one "Battle Cry" question per fight round (right = bonus, wrong = nothing lost), plus the market, training hall, church, empire and quests. No timers.
- **Size:** bigger than Dragon Maths (four characters and an empire), similar to Maths Monsters. Eight stages (section 12), with a test page for James after the fights stage.

## 1. What we found (18 Oct 2026)

**History:** Allen Ussher, first released 1997, freeware 1998, source code released 2002 ([Break Into Chat wiki](https://breakintochat.com/wiki/The_Clans)). The modern copy is the Synchronet BBS project's "clans-src" ([source on gitlab.synchro.net](https://gitlab.synchro.net/main/sbbs/-/tree/master/src/doors/clans-src), [SourceForge page](https://sourceforge.net/projects/theclans/)), version 0.97b2, tidied up in 2026 to build on Linux, Windows and FreeBSD.

**Licence: GPL-2** (checked in its `LICENSE` file; SourceForge lists GPL-2 and MIT). Copying its code or its text files into the hub would mean the hub's code has to be shared under GPL-2 too. The hub has no licence yet, so that would be James's decision, not something to slip in. **So: no copied code, no copied text.** Rules and numbers aren't owned the same way, and we credit the game for them. I found **no web or JavaScript version** of it anywhere (one search round, so not 100% sure).

**What I read:** the player manual (about 1,150 lines), the game's data files (184 monsters, 28 spells, 47 items, 10 races, 11 classes) and the fight code. Key rules, from the original:

| Part | How the original works |
|---|---|
| **Your clan** | You make **4 characters**: pick a race and a class for each, reroll the stats if you don't like them, name them. The first is the "clan leader" with better stats. Up to 6 members later. Everyone's starting gold goes in one clan vault |
| **Daily limits** | A fixed number of mine fights, a few clan (player) fights, **one quest**, 4 chats, and church services once each. All reset overnight |
| **The mines** | Pick a mine level 0-20. Deeper = tougher monsters, more experience, gold and "followers". Monsters are picked by mine level and your clan's levels |
| **Fighting** | Turn-based. **You control all four characters**, one at a time each round. Order: highest agility first (hurt characters slow down, plus a little luck). Attack, cast a spell, read a scroll, run, or skip. Max 50 rounds |
| **Hit and damage** | Hit if `dexterity + 2 + two small dice` is **not** below the target's `agility + a small die`. Damage = `half your strength × (80-119%) − their armour strength`, at least 1 |
| **Experience** | You get experience **per hit** (`damage ÷ 3 + 1`), not after the fight. So spreading the hits around levels everyone up |
| **Levels** | Each level gives **10-13 training points** to spend in the Training Hall: agility 10, dexterity 10, strength 20, wisdom 10, armour 30, charisma 40, +HP 10, +magic 10. Each village Training Hall level makes them 1 cheaper |
| **Gold and followers** | Gold from a kill = `difficulty × (20-29) + 50 + (0-19)`. Followers (4-6, 7-9, 11-13 by mine level) who watched you fight become troops |
| **Knocked out / dead** | Below 0 HP knocked out; below −5 a permanent loss of max HP; below −15 dead until the church brings you back. Cost: `(level + 1) × 300` gold to wake, `× 750` to resurrect |
| **Market** | Weapons, armour, shields. **Dearer isn't always better**: each item has its own odd stats and strength requirements. Looking at an item's real stats costs **25% of its price**. Prices include the ruler's sales tax. A pawn shop sells used goods cheaper |
| **Magic** | 28 spells: heal, damage, buff/debuff, "tie up" an enemy for a turn, raise/banish undead. Cost skill points; scrolls are one-use and free |
| **The village** | The *ruler* (voted in, or just walks in if the throne is empty) sets income tax and sales tax (0-50%) and spends the village vault on the Church, Training Hall, Pawn Shop, Wizard's Shop and Smithy |
| **Your empire** | Land you **develop** (costs gold), then build on: Barracks (holds 20 footmen / 10 axemen / 5 knights), Walls, Towers, Steel Mill, Stables, Spy and Security buildings, Gymnasium, Developer's Hall, Shops. Buildings use land (5-15 each) and a daily **worker-energy budget of 100%** (Barracks 30%, Walls 7%, Towers 12%...) |
| **Troops and war** | Footmen 15 gold, axemen 30, knights 60. You set a battle plan (how many rounds, how hard, how much to loot) and attack another empire to **steal land, steal gold, destroy buildings, or oust its ruler**. Walls and towers help the defender |
| **Everything else** | Alliances (up to 5), mail and public chat, NPCs with quests, scoring (+10 monster win, −10 loss, +20 clan win, −15 clan loss, −20 running from a player), a daily news page, and **InterBBS**: your clan "travels" overnight to a village on another BBS, and a league scoreboard |

**Not suitable for children, so left out or rewritten:**

- **Free-text mail, public chat and the village noticeboard** (the hub's rule: no typing between students).
- **Taxes and overthrowing the ruler** (section 9). Raids on classmates **stay in**, with safety limits (section 8).
- **Dying for real** (permanent max-HP loss and "dead until resurrected"): becomes "knocked out, wakes up tomorrow, nothing lost forever".
- **Gory text and the Demon race:** the Demon race is renamed *Imp*. Everything else stays: all 11 classes and the other races, "raise undead" spells included, with friendly wording.
- **InterBBS travel between computers** can't exist, but it maps neatly onto *classes as villages* (question 7).

## 2. How it fits with the other maths games

| | Maths Monsters | Dragon Maths | Clan Quest |
|---|---|---|---|
| Feel | Collect a team, walk a world | One hero, menu village, daily turns | **Four-person clan, mines, build an empire, class village** |
| Maths | A question on every attack | At chosen moments | **Everywhere: money, %, areas, shares, remainders** |
| Pace | As much as you like | A few minutes a day | A few minutes a day |
| Social | Collection board | Rival heroes, arena | **Class village project, friendly duels** |

Dragon Maths and Clan Quest are both "daily turns" games from the same era, so **I'd build only one of them first.** They'd share the engine pieces (seeded fights, server replay, daily reset, news, computer rivals, maths hooks). If Dragon Maths comes first, about a third of this plan is already built. Question 8.

All three share the maths packs in `shared/maths/skillPacks/` (times tables is on `main`; the other five are on the `monsters` branch), the question box and the teacher's topic switches. **Clan Quest needs new question kinds**, which then help the other games too: percent of an amount, price with tax and change, area of a rectangle (land plots), sharing with remainders (troops per barracks), simple ratios, and negative numbers (the points table) for older students.

## 3. Your clan

- **Four members to start, up to six** (Training Hall). Each is a **race + class**; the first is the clan leader with extra stats. Gold and items are shared.
- **Races (10):** Human, Dwarf, Elf, Half-Elf, Halfling, Orc, Muya, Minotaur and **Imp** (the original Demon, renamed). Same shapes as the original: Dwarf = strong and tough, Elf/Halfling = quick, Human = balanced.
- **Classes (11), all kept:** Barbarian, Warrior, Martial Artist, Knight, Assassin, Healer, Sorcerer, Necromancer, Wizard, Pirate, Samurai. Each starts with its own spells (Healer heals, Sorcerer fires bolts...). Writing stays gentle: nobody bleeds, enemies "crumble" or "run off".
- **Six stats:** agility, dexterity, strength, wisdom, armour strength, charisma, plus HP and skill points. Original goes 0-100; we cap at **60** and level at **20**, so a clan can "finish" in a school term (section 7).
- **Making a character:** pick race, pick class, see the stats, "Roll again" up to 3 times. A name from a word list (hub rule: no typed names). Clan name from a word list as well.
- **Caps on what you see:** four members and about ten numbers each is a lot for a 9-year-old. The default screen shows just HP, attack, defence and one "star" for each member; "More details" shows the lot.

## 4. A day in the game

About **10-15 minutes**, the same each day:

1. **Pre-game screen:** today's news, the scoreboard, the village chest.
2. **The Mines:** up to **8 fights a day** (question 2). Choose a depth (0-20, with a "too easy / just right / too hard" hint). Each fight is 3-8 rounds.
3. **Market, Training Hall, Church:** spend the gold and training points you earned.
4. **Empire:** build, train troops, send a **raid** (on a computer kingdom or a classmate), 1 a day.
5. **Quest:** one a day, a short story with choices and sometimes a puzzle.
6. **Village Hall:** drop gold in the village chest; vote for the next building.

Everything resets overnight (NZ time), like the other daily games. A "Practice Mode" (teacher switch) gives extra mine fights for a little gold and no experience, as in Dragon Maths.

## 5. The mines and fights

- **Kid-sized fights:** 2-4 enemies at a time, 3-8 rounds. Original goes up to 50 rounds, which would take forever. Monsters are about **30 of our own** (original has 184, many for deep levels we don't use), each with a picture, themed by depth: meadow pests, caves, swamp, ruins, mountain, then a few bosses. Gentle wording: "Mangy dog" is fine, a skeleton "crumbles", nobody bleeds.
- **Choosing actions:** each round, for each member in agility order: **Attack** (pick target), **Spell**, **Scroll**, **Guard** (take less damage, the original's "parry"), **Run** (needs dexterity, as original). "Default action" (Enter) stays: very useful for speed on a Chromebook.
- **The Battle Cry (the main maths hook):** once per round, before the members move, a question pops up for the whole clan. **Right = +25% damage this round** (or a free heal, your choice). **Wrong = normal round, we show how to do it.** No timer, nothing lost. A round can be skipped with "No thanks" (you just don't get the bonus). The question's level follows your year level and topics. A fight can be won with no answers, so it's a bonus, not a test.
- **Experience per hit** stays, since it nicely teaches "everybody should get a turn".
- **Knocked out, never dead:** at 0 HP a member is out for the rest of the fight and the day. Wake them at the Church for gold (`(level+1) × 300` shape, rescaled). If all four are out, the fight is lost: you keep your gold and experience, lose nothing, and the clan wakes up at the Church in the morning. **No permanent loss.** (Original cost points and HP; too harsh.)
- **Bosses:** a boss every 5 mine levels. First time you beat one, it gets a news line, a badge and a prize.
- **Quests (1/day, ~10 to start):** short branching stories, each with 1-2 choices and sometimes a puzzle (pattern, logic, number riddle). Written fresh by us, using the original's idea of "charisma opens extra choices".
- **Scoring in the original** was +10 for a monster win and −10 for a loss. Negative scores are cruel and confusing; we use only positive "clan fame" and teach negative numbers separately as a quest puzzle.

## 6. Maths moments (the heart of this game)

The aim is that maths shows up in *natural* places, in many small forms, and rarely feels like "a question".

| Place | Original rule | Maths moment | Topic (Y4-6) |
|---|---|---|---|
| **Battle Cry** | n/a | One question per round | any chosen topic |
| **Market: total with tax** | Price + village sales tax | "Sword 240 gold, +10% tax: what do you pay?" Right = pay that; wrong = shows working | percentages, decimals |
| **Market: peek at an item** | Examining costs 25% | "Examining costs 25% of 480 gold: how much?" | fractions, percentages |
| **Market: choose the better buy** | Dearer isn't always better | "Axe: +7 strength, 500. Sword: +6 and +1 accuracy, 750. Which is cheaper per point?" | unit rates, comparing |
| **Change** | Your vault and prices | Count change from 1,000 | add / subtract to 1,000+ |
| **Training Hall** | Points per stat, cost drops 1 per hall level | "You have 47 points. Agility costs 7. How many can you buy? What's left over?" | division with remainders |
| **Church** | `(level+1) × 300` to wake | "3 members at level 4. What's the bill?" | multiplication, order of ops |
| **Land** | Develop a plot, then build | Area and perimeter of a rectangle ("A barracks needs 15 squares. This plot is 4 × 5...") | area, multiplication |
| **Barracks** | 20 footmen / 10 axemen / 5 knights each | "You have 85 footmen. How many barracks do you need?" | division, rounding up |
| **Worker energy** | 100% a day split between buildings | "Barracks 30%, walls 7%, towers 12%: can you afford all three today? How much is left?" | percentages, adding |
| **Troop costs** | Footmen 15, axemen 30, knights 60 | Budget: "You have 600 gold: 12 footmen and 4 axemen cost...?" | multiplication, ratios |
| **Followers and the draft** | The village conscription rate (0-20%) | "50 followers, 20% are drafted: how many join?" | percent of an amount |
| **Spies and luck** | Chance to catch a spy | "1 in 5 chance. Out of 20 tries about how many?" | fractions, simple probability |
| **Fame points** | +10 / −10 | Younger: counting on. Older: negative numbers puzzle | integers (Y6) |
| **Quests** | Scripted | Pattern and logic puzzles | patterns, reasoning |

Each moment has a **teacher switch** and a **year-level band** (Y4/Y5/Y6) that sets the numbers: easy bands use round numbers like 10%, 25%, 50%; harder bands use 15%, 35%, 12.5%. A wrong answer never blocks you: the shop just shows the working and charges the right amount, so maths is the way *you check the bill*, not a gate. Hints: one worked step, then the answer.
- **Questions are made and marked by code**, never by an AI. The server rebuilds each from its numbers to check, as Maths Monsters does.
- Private, same as the others: a student sees "practising: percentages" on their clan page; classmates never see accuracy.

## 7. Numbers that work for 9-year-olds

Same thinking as Dragon Maths, adjusted to a clan of four. To be tuned with a simulator (stage C.1):

- **Daily mine fights:** 8. **Fight length:** 3-8 rounds, under about 2 minutes.
- **Levels:** 20 (original 100), 12 training points per level (original 10-13). Experience per level rescaled so a day of fights is about 1 level at the start and a level every 2-3 days later. A full clan takes about **6-8 weeks of play** to reach level 20.
- **Gold:** original prices (a sword is ~650) are large; we divide all prices and gold by 10 so students deal with numbers like 65, not 650... except in the bands where we *want* three-digit numbers.
- **Followers → troops:** original gives 4-13 per fight; with 8 fights that's ~60-80 followers a day. Fine for division questions.
- **Empire sizes:** start with 10 plots; a barracks needs 15 squares (original numbers kept for land: 5-15 per building).
- **Balance:** a sensible clan should win about 80% of fights at "just right" depth with no maths bonus; the Battle Cry makes it ~90%. Deeper than "just right" is risky, as in the original.

## 8. The empire and "war"

The original empire is the most interesting part and the hardest to make child-safe. The plan:

- **Building (kept):** develop land → build Barracks, Walls, Towers, Steel Mill, Stables, Gymnasium and Developer's Hall with gold and the daily worker-energy budget (the maths in section 6). Drop Spy/Security buildings and Shops at first.
- **Troops (kept):** footmen, axemen and knights bought with gold; barracks cap how many you can keep.
- **Raids on computer kingdoms (new):** once a day you set a **battle plan** (how many rounds, how hard, how much loot) and send troops against one of **6 computer kingdoms** of different strength. The server decides it in one go from both armies and a seed, so no waiting. A good way to learn the plan before raiding classmates.
- **Raids on classmates (kept, James 18 Oct):** as in the original, you can raid a classmate's empire to **steal land, steal gold, or destroy buildings** (no "oust the ruler", there is no ruler). The defender's empire fights back as a saved copy, played by the computer, and they read about it in the news. Guard rails I'd add so it stays fun (questions 11-12):
  - **New-clan protection** for the first 3 days, as in the original.
  - **1 raid a day** and **a raid on the same clan at most once a day**.
  - **Loot limited** to 10% of land and gold (the original's lowest level, never 20-30%), and never the village chest or your clan's own vault of gold for the mines.
  - **After you're raided you get a 1-day shield**, so nobody is farmed.
  - **Only against clans close in army size**, so a big empire can't bully a small one.
  - **Names hidden until it happens**: the news says "A raider from the Red Banner clan took 40 gold" using the clan name, never a student name. The teacher can see the real names.
  - Teacher switch to turn classmate raids off.
- **No oust-the-ruler.** There's no ruler (section 9).
- **Walls and towers** do help defence, so building them is useful. They also decide how much a raider can destroy.

## 9. The class village

One **village per class group** (teacher sets the groups; question 6). Replaces the ruler/taxes/voting of the original:

- **The Village Chest:** every student can drop gold in. Nobody is forced to, and nobody can take anyone's gold.
- **Three buildings to choose from** each week (Church, Training Hall, Pawn Shop, Wizard's Shop, Smithy, each in levels, just like the original). The class **votes** (one vote each, from a button list, no typing). The winner is built if the chest has enough gold.
- **Benefits for everyone:** each building level helps the whole class (Training Hall = cheaper training; Church = more healing a day; Smithy = better shop items).
- **Progress bar and class goal** on the home screen ("Church level 2: 380 / 500 gold"). The chest and votes are a gentle class-wide maths moment too (progress, fractions of a goal).
- **Village news:** computer-written lines only ("The class built a Training Hall!"). No student text, no chat.
- **Scoreboard:** top 10 clans and you, by fame, like the other games. Never maths scores.

## 10. Saving, fairness and the teacher

The server decides everything that matters (gold, experience, HP, turns left, land, troops), same shape as Dragon Maths, `shared/clans/` engine:

- **New tables** (students can't write to them directly): `clans` (one per student), `clan_members`, `clan_empires`, `clan_villages`, `clan_votes`, `clan_news`, `clan_fights`.
- **New `clans` server function.** Start a mine fight: the server takes one fight off today's count, picks the monsters and a seed, and sends them. The browser plays the fight; at the end it sends the list of choices and Battle Cry answers; the server replays it with the same engine and seed, checks each answer by rebuilding the question, and only then pays out. Sending the same fight twice does nothing. Shopping, training, building and raids are single requests the server does in one go.
- **Daily reset:** a scheduled database job at midnight NZ time (like the tidy jobs we already have): resets turns, runs computer clans' day, writes the news, finishes the weekly vote.
- **Refresh-safe:** a half-finished fight is kept on the server.
- **Free-plan cost:** roughly 30 requests per student per day (one per fight, plus the menus). 100 students playing every day for a month is about 90,000 requests, on top of the other games' ~70,000 a month, against 500,000. Should still fit; I'd measure it at stage C.5.
- **Points:** inside the shared 40-a-day cap. My pick: 1 point per 3 mine wins, 3 for a boss, 2 for a friendly war, 5 when the class completes a village building. `ranked: false`.
- **Achievements (about 8):** first win, first boss, level 10, level 20, 5 buildings, first friendly war win, village building, 50 Battle Cry answers.
- **Teacher page:** game on/off; maths topics and year bands on/off (shared with the other games); mine fights per day; Practice Mode; village groups; reset a student's clan; start a new season.
- **Privacy:** no new personal data; names and clan names from word lists; maths answers stored like Gem Keep's.

## 11. Look and sound

- **Modern BBS look:** dark background, the old 16 ANSI colours, a pixel font (*VT323*, open licence) for headings and a clear font for reading. Box-drawn borders. Same look as Dragon Maths (question 3) so they feel related.
- **Pictures:** monsters and items from Kenney's 1-Bit Pack (CC0, check the licence again at the start); our own character portraits made from parts in code (race + class), like the 101 card faces.
- **Real web pages, not a terminal:** big buttons, touch, keyboard letters, screen readers, 1366 × 640 Chromebook fit. A "classic terminal" setting can come later.
- **Sound** made in code, off by default in class. Animations off for reduced motion.

## 12. Stages (when picked up)

| Stage | What | Rough size |
|---|---|---|
| **C.0** | Rule sheet: every number we take from the original, the rescaled economy, every place we change it on purpose. Licence and art checks. Kid-friendly writing for races, classes, monsters, items; rename Demon to Imp | Small |
| **C.1** | `shared/clans/` engine: clan, members, stats, fights (agility order, hit, damage, spells), market, training, church, experience. Seeded random, replay. Simulator to tune pace (section 7) | Medium |
| **C.2** | Maths: new question kinds (percent of, price with tax, area, remainders, ratio, integers) in the shared packs, and the maths moments wired into the engine | Small-medium |
| **C.3** | Screens: clan creator, mines, fight, market, training hall, church, clan page; art and writing. **Test page artifact for James**, nothing saved | Big |
| **C.4** | Empire: land, buildings, worker energy, troops, computer kingdoms, raids on classmates with guard rails, Friendly War. Quests (first 10) | Medium-big |
| **C.5** | Saving and fairness: migration, `clans` function, replay checks, daily reset job. **Class trial possible from here** | Medium |
| **C.6** | Class village: chest, votes, buildings, news, scoreboard, points, achievements, teacher page. **Go live**, needs James to say so | Medium |
| **C.7** | How to play, accessibility pass, slow-Chromebook check, docs | Small |

Each stage ends with tests passing and a results section here, and stops for James's review, like the others.

## 13. James's answers (18 Oct 2026)

| # | Question | Answer |
|---|---|---|
| 1 | Name | **Clan Quest** |
| 2 | Mine fights a day | **8** |
| 3 | Look | **Dark BBS style**, same as Dragon Maths |
| 4 | Clan size | **4 to start, up to 6** |
| 5 | Raids | **Classmate raids stay in** (steal land and gold), as the original. Computer kingdoms and a no-loss Friendly War as well |
| 6 | Village groups | **One per class group**, teacher sets the groups |
| 7 | School league (later) | **Yes, later**, no work now |
| 8 | Build order | **Dragon Maths first** |
| 9 | Classes and races | **Keep all**, only rename the Demon race (to *Imp*) |
| 10 | New season | **Keep clans, reset fame points** |

| 11 | Raid guard rails (3 days protection, 1 raid a day, 10% loot, 1-day shield after being raided, similar army sizes only) | **Yes** |
| 12 | Teacher one-click switch for classmate raids | **Yes** |

## Credits to carry over

- Game structure, rules and numbers adapted from *The Clans* by Allen Ussher (1997), open sourced under GPL-2 and now kept up by the Synchronet BBS project; no code or text copied.
- Monster and item pictures from Kenney (CC0), if used.

## Stage C.1 results (18 Oct 2026, first pass)

Built in `shared/clans/` (list in `shared/README.md`): data, spells, characters, fights, a bot and a simulator (`npm run clans:sim`). 30 new tests, all passing, typecheck clean. **No screens, saving or maths questions yet** (those are C.2 onwards). Branch `clans`.

**What works:** rolling a member (race + class + small roll, leader bonus), levels and training points, training costs that fall with the Training Hall, the Church bill, shop prices with tax, "examine" cost. Fights: agility-first turns (hurt fighters slow down), hit and damage as the original, experience per hit, gold per kill, followers on a win, 3-8 rounds, guard, run, heal / damage / buff / debuff / tie-up spells, Battle Cry (a right answer gives +25% damage; the engine just takes "earned or not", C.2 decides that). A fight is plain JSON, replays exactly from its seed, and survives being saved halfway.

**What I changed from the first draft numbers** (all in `config.ts`):
- XP to reach a level: 30 for level 2, then 10 more each level (was 60 + 25; far too slow: level 11 after 8 weeks).
- Training costs per +1: agility, dexterity, strength, wisdom 3, armour 5, charisma 6; HP and SP 2 points each (+4 HP, +3 SP). The first draft's costs left clans far behind the monsters from about level 8.
- 3-4 enemies a fight from depth 3 (2-3 before that), so fights last 3-4 rounds, not 2.
- Not in the plan: survivors recover half their missing HP and SP after each fight (`betweenFightHeal`), and everyone is healed overnight.

**What the simulator says** (bot clan, 70% of Battle Cries right, depth = average level - 1):

| | Mixed clan (fighter, healer, wizard, knight) | All fighters |
|---|---|---|
| Win rate at "just right" depth | 96% | 85% |
| Average level, day 14 / 28 / 42 | 9 / 15 / 17 | 9 / 15 / 17 |
| Reaches level 20 in 60 days | no (about 17) | no (about 18) |

- **Too easy early on:** days 1-14 are 100% wins at "just right". A real player pushes deeper, so that is partly the bot, but win rate is still 93% at +1 depth and 81% at +5 (mixed) / 62% (fighters). I'd move the "too easy / just right / too hard" hints later, once real depth choices are seen.
- **Slow at the end:** levels 16-20 are a slog (monsters there have Strength 40-50 and armour 7-9 and our stat cap is 60). Target was level 20 in 6-8 weeks; right now no clan gets there in 60 days. Probably fix by easing late XP or monster armour; not guessed yet.
- **Healers matter a lot:** the all-fighters clan runs out of gold paying the Church from about day 30. Needs a look: either cheaper wake-ups, or a free daily wake-up per clan.
- **Gold piles up in the middle** (8,000 by day 21 with nothing to buy), which is the gap the empire (C.4) and the village chest (C.6) are meant to fill.

**Not done yet in C.1:** helper spells (Call Spirit Helper, Send Spirits Away, Ghost Warrior, Divine Warrior; marked `notYet`, so Necromancer and Knight are weaker than they should be), scrolls and books, and toughening the first two bosses (they are close to ordinary monsters). Race gold is dropped: all clans start with 200.

### Tuning pass before C.2 (18 Oct 2026)

Done with the simulator (20 clans, 60 days, 70% of Battle Cries right):
- **Late game:** levels cost at most 90 experience each (`xpLevelCap`), and mines deeper than 8 give 25% more experience per hit for each level deeper (`xpBoostFrom`, `xpDepthBoost`). A mixed clan now reaches level 20 in about 7-8 weeks (14 of 20 clans by day 54); an all-fighters clan in about 5 weeks. The first 14 days are unchanged. I left monster armour alone: it only takes off 7-9 damage from hits of 20+, so it wasn't the problem. Experience was.
- **Church:** the first wake-up each day is free and the rest cost `(level + 1) × 10` (was × 30). All-fighters clans no longer run dry at the Church; they still lose about 40% of fights deep down because there's no healer, which seems right.
- **Depth hints** (`depthHint`, as depth minus the clan's average level): up to -1 "too easy" (100% wins, nobody knocked out), 0 to +1 "just right" (99-100%), +2 to +3 "tough" (about 90%, 5+ knock-outs a day), +4 and up "too hard" (under 80%, and 30-50% early on). The early game can't really be lost until you go 4+ levels deeper than your clan; the bot always picks sensible actions, so a child will lose more than it does.

## Stage C.2 results (18 Oct 2026)

Built (pure TypeScript, tests only, **no screens, nothing saved, nothing live**). Branch `clans`.

**Maths Monsters isn't merged into `main` yet** (the `monsters` branch still holds the other five packs), so I built on `main`'s times tables only. The new kinds sit in their own file, `shared/maths/practical.ts`, and don't depend on either.

**New question kinds** (`shared/maths/practical.ts`): percent of an amount, price with tax, change (from 1,000), area, perimeter, how many you can buy, what's left over, rounding up (barracks), troop costs, "how much is left" budgets (gold or worker energy), ratios (scale up in Y4-5, share out in Y6), negative scores (Y6 only), better buy, the Church bill, and a plain times-tables question so the Battle Cry can use that topic too. 15 kinds, 8 teacher topics. Easy bands use round numbers (10%, 25%, 50%; multiples of 10); Year 6 uses 12.5%, 15%, 35% and awkward amounts. Every question is rebuilt from its kind and numbers alone (`buildQuestion`), so the server can check it without trusting the browser. Each carries its worked answer; the first line is the hint.

**The Battle Cry** (`shared/clans/battleCry.ts`): the question for each round comes from the fight's seed and the round number, *not* the fight's own dice, so asking never changes how a fight plays and the server can rebuild exactly what the child saw. A right answer gives the reward the player picked (damage or heal); a wrong answer or "No thanks" is a normal round and returns the worked answer. `replayFight` replays a recorded fight (orders plus each round's answer) and gives the same result as it did live. One small change to C.1's fight: it now keeps its starting seed.

**Shop and church moments** (`shared/clans/moments.ts`): market total with tax, "examine" cost, change, better buy, Training Hall (how many, what's left), Church bill (after the free wake-up), land (area and fence), barracks, troop costs, worker energy, the draft, fame (negatives). Each takes the real numbers and returns `null` if the teacher has that topic off. Tests check the answers match what the engine really charges (every item's shop price and examine cost, the Church bill). Not yet: spy odds ("1 in 5"), quests' puzzles (C.4).

**Teacher switches** (hooks only): `PracticalSettings` = `enabledTopics`, `yearBand` (4/5/6) and `enabledTables`, with `readPracticalSettings` to clean up anything saved. No Teacher page or database changes.

**Private:** `cryRecord` makes an answer record in the same shape as the other games (`key`, `correct`, `ms`, `at`; key like `clan:y5:percent-of`). No tables or functions added.

**Checked:** 88 new tests (whole suite: 902 passing, type check clean): every kind at every band over 150 samples against a second, independent way of working out the answer; same seed gives the same question; remainders, rounding up/down, 12.5%, ties in better buys; Years 4-5 never produce negatives, decimals or answers over 1,000; 25 recorded fights replay identically; a doctored answer record is not marked right.

**Left for later:** the number pad needs a minus key for Year 6 negatives (C.3); a "which is better" question is tap-to-answer (C.3); wording needs James's eye (examples in the C.2 summary); how often the Battle Cry shows a topic is equal per topic, which may want weighting once children use it.

## Stage C.3, part 1 results (18 Oct 2026): clan creator, the Mines and the fight

C.3 is split in two (James agreed). **Part 1 (done):** clan creator, Mines, fights, Battle Cry, settings strip, pictures. **Part 2 (done, see below):** Market, Training Hall, Church and the full clan page with their maths moments. James said the C.2 question wording and levels were fine, so nothing changed there. Branch `clans`; nothing saved, no server, nothing live.

**Built** (`src/games/clans/`, `src/maths/PracticalAsk.tsx`, `preview/clans/`, `npm run clans:preview`): the dark terminal look (VT323 headings, system monospace for reading; Dragon Maths' look exists only in its own folder, so this is a fresh copy with the same colours, to be merged into one later). Creator with race, class and name pickers, "Roll again" three times, clan name from two word lists, only HP / attack / defence / best stat by default and "More details" for the rest. The Mines with depth 0-20, the hint from `depthHint`, the 8-a-day counter and bosses at depths 5, 10, 15, 20. The fight: members choose in agility order, Attack / Spell / Guard / Run, Enter for the default action, keys A S G R and 1-9, a plain gentle log ("crumbles away", "runs off", "knocked out and rests"), HP and SP bars with the numbers written on them, duplicate enemies lettered A, B. The Battle Cry before each round (right: pick damage or healing; wrong or "No thanks": the worked answer and carry on; no timer). Number pad now has an optional minus key (Year 6 negatives) and "which is better" is tap-to-answer. Settings strip (year band, topics, depth, "Skip a day") for James's test only. Portraits are made from the class figure coloured by race with a race letter; monsters are Kenney's 1-Bit Pack, coloured by mine zone.

**Licence check (18 Oct 2026):** Kenney's 1-Bit Pack is still CC0 on kenney.nl and in the pack's own licence file (copied to `src/games/clans/KENNEY-LICENSE.txt`).

**Checked:** 14 new tests (creator, three rolls, a fight won with no maths, right and wrong Battle Cry, "No thanks", a keyboard-only fight, minus key, tap answers, skip a day). Whole suite 916 passing, type check clean. Looked at the real page at 1366 x 640: it fits with the settings strip closed (it closes itself in a fight).

**Choices to know about:** the "choosing order" on screen uses agility and health without the engine's small dice roll, so the real turn order in the round can differ slightly. The question box is a new `PracticalAsk` that reuses the number pad and look, because the old box closes itself after 2 seconds and the worked answer needs to stay. VT323 loads from Google Fonts in the test page only; the real site should host it itself. No sound yet. A phone-size screen is laid out but not tried.

**Left for part 2:** Market, Training Hall, Church and the clan page's gear and "practising" line with their maths moments, the shop pictures, then the "Stage C.3 results" wrap-up.

## Stage C.3 results (18 Oct 2026): the clan screens, both parts

C.3 is built: the whole clan loop you can play in the browser, with maths in the shop, the Training Hall and the Church. Nothing is saved, no server, nothing live; branch `clans`.

**Part 2 built** (`src/games/clans/`: `Market.tsx`, `Training.tsx`, `Church.tsx`, `Moment.tsx`, `places.ts`):
- **Market:** pick a member, a shelf (weapons / armour / shields from `inShop`) and an item. Buying asks "what do you pay?" (`marketTotal`) before paying; right, wrong or "Show me how" all pay the true `shopPrice` (the worked answer shows after a wrong one). "Look closely" costs `examineCost` with its own question, then shows the real bonuses, what the member needs and whether they can use it yet. Once a member has looked at two items, "Which is the better buy?" (`betterBuy`, tap to answer) appears. After buying, "Check my change" (`marketChange`) is offered. Buying swaps the member's old gear for that slot. Not enough gold: the button is greyed and a kind line says how much is needed.
- **Training Hall:** pick a member, see the cost of each stat, Health and Skill points at the current Training Hall level, then two questions (how many can you buy, what is left: `trainingBuy`), then "Buy 1" or "Buy N (all you can)". Points left are always shown.
- **Church:** knocked-out members with their cost (the first wake-up each day is free), a wake button for each, and "Wake everyone" (dearest first so the free one saves most), which shows the bill after the free wake-up (`churchBill`). A wrong answer still charges the right amount. Not enough gold: says so kindly; waking one at a time still works.
- **Clan page:** each member's three gear slots, a "points to spend" and a "knocked out" tag, gold, followers, average level, "Practising: ..." (topic names only, never accuracy), buttons to the Mines, Market, Training Hall and Church; "More details" is as before.
- **Test strip:** "Give 500 gold", "Give 12 training points to everyone" and (not asked for, added so the Church can be tried without losing fights) "Knock out two members", all labelled "(test only)".
- **Pictures:** each item has a Kenney picture coloured by kind (weapons yellow, armour cyan, shields orange); a heading picture for the Market, Training Hall and Church.

**Engine:** no rules or numbers changed. Added `hpCost` and `spCost` to `shared/clans/character.ts` (the same sums `trainHp`/`trainSp` already did, now readable so the screen can show the price). Every moment still needs `question.answer` to equal what is charged; tests check it through the screens.

**Licence check (18 Oct 2026):** kenney.nl still says "Creative Commons CC0" for the 1-Bit Pack.

**Checked:** 31 clan screen tests (17 new: wrong and right answers in the shop still charge the right price, change, looking closely, better buy, not enough gold, a keyboard-only purchase, training with a wrong answer, the free then paid wake-up, wake everyone, not enough gold at the Church, test buttons, clan page). Type check clean. Whole suite: 935 passing; one unrelated server-side test (save-bot-game) failed once under load and passed on its own re-run. Looked at the real page at 1366 x 640: the Market, Church and Training Hall list fit with the test strip closed; the Training Hall question box is about 45px taller than the screen (number pad), so it scrolls a little.

**Choices to know about:**
- The shop list shows the price *before* tax ("20 gold, plus 10% village tax"); the price with tax appears after the "what do you pay?" question (or straight away if the teacher has percentages off), so the question isn't already answered on screen.
- "Which is the better buy" only appears for items a member has looked at closely, because the comparison uses the real bonuses (which "Look closely" reveals). It compares price per point of bonus the member can actually use.
- The shop's "what do you pay?" and "change" questions now name the real item ("The Dagger costs 20 gold..."), changed after James asked (18 Oct 2026). Only the wording changed; the numbers and answers are the same. Other questions keep the C.2 wording.
- "Look closely" and the better-buy answers don't affect anything but gold; "Check my change" pays nothing (you aren't really handing over a 1,000 note).
- The test strip is open on the clan page and closed on the other screens, so the places fit on a small screen.

**Left for later:** C.4 (empire: land, barracks, troops), sound, a phone-size check of the new screens, hosting VT323 ourselves, the Smithy / Training Hall / Church levels (they stay at 0 until the class village builds them), and the teacher page that replaces the test strip.

## Stage C.4, part A results (18 Oct 2026): the empire engine

The empire rules and numbers are written into [CLANS-RULES.md](CLANS-RULES.md) section 12 (that is the table to read). Built as plain, seeded, replayable code with **no screens, nothing saved, nothing live**; branch `clans`. 4B (the screens) waits for James's OK.

**Built** (`shared/clans/empire.ts`, with a bot in `empireBot.ts`, the simulator extended, new tests in `empire.test.ts`): land (develop, claim more), seven buildings with daily worker energy, troops and barracks room, the draft, the six computer kingdoms, the battle plan and one-shot battle, raids on kingdoms, Friendly War, and the **rule only** for classmate raids (`raidRefusal`, `raidClassmate`, `raidNews`). `moments.ts` gains `lootShare`, and `draftJoin` now words its question about followers (`BuildOptions.about`, wording only).

**Choices I made that James may want to change:**
- **The empire has its own vault** (as the original and plan section 8 say: raiders never touch the clan purse). It means moving gold across ("Put in / Take out"). One shared purse would be simpler but then a raid could empty the money for the Church.
- **Each troop kind has its own room in a barracks** (20 / 10 / 5), so the "how many barracks?" question has one clear answer per kind.
- **Rounds, how hard and loot all matter.** Fewer rounds is a stalemate if you can't break them in time; Bold finishes sooner but more troops are hurt; asking for more loot makes the defenders fight harder. A Friendly War is the place to try a plan.
- **A new clan can't raid classmates for its first 3 days either** (the plan only said it can't be raided).
- **Gymnasium** raises the draft limit. My first idea (one more training point a day for everyone) made the mines far too easy (all-fighters win rate 85% to 99%), so it was dropped.
- **Kingdom raids are limited to 1 a day** (the first try, 2 a day, paid too much).

**What the simulator says** (20 bot clans, 56 days; the bot saves what is over 600 gold for the vault, builds in a fixed order, fills the barracks, tries a Friendly War then raids the toughest kingdom it expects to beat):

| | Mixed clan | All fighters |
|---|---|---|
| Barracks built / all 24 buildings, by day | 7 by day 14, all by day 21 | 7 by day 14, 23 by day 21 |
| Army strength day 14 / 21 / 42 | 106 / 450 / 468 | 101 / 270 / 434 |
| Raids won (after a Friendly War win first) | all | all |
| Raid gold a day late on | about 250 | about 250 |
| Strength lost in a raid | about 10 (about 150 gold) | about 10 |
| Mines win rate with the empire / without | 96% / 98% | 81% / 85% |

- **Affordable (after James asked for a bigger empire: up to 12 barracks, 24 extra plots to claim):** a mixed clan has 12 barracks, 29 buildings and about 650 strength by about day 35. An all-fighters clan gets there around day 60-70, because it earns less gold.
- **Not running out of gold:** the bot keeps 600 in the clan purse. A mixed clan's purse stays healthy early and dips low (under 100) now and then after day 28; an all-fighters clan's purse is low on many days after day 21, **as it already was without an empire** (the Church costs them). So the empire doesn't cause that, but it doesn't fix it either.
- **The mines are unchanged:** win rates with and without an empire are within 4 points (a test checks it stays under 6) and levels reached by day 30 within 0.6.
- **Kingdoms are beatable at the right level:** an army of about 15 / 45 / 100 / 175 / 275 / 440 strength wins 80% against the six kingdoms (a test checks that twice a kingdom's strength always wins and half never does). Mills lower that by about 10%. The Bold/Careful choice makes little difference to who wins when there are enough rounds; it changes how many troops are hurt.
- **Raids are a small bonus, not the main income.** Mines earn about 400-500 a day in the middle game; raids add about 250 for about 150 gold of hurt troops.
- **After about 5 weeks a mixed clan has built everything and the vault just fills** (about 9,000 by day 56). That is the same gap as before: the village chest (C.6) is meant to take it, or we can add more land claims / more barracks later.

**Checked:** 61 new tests: every rule above (land prices, energy, building limits, barracks room, troop prices, the draft, every classmate-raid guard rail, gold and land only moving between clans, replaying a raid exactly, news lines that never name a student), plus the maths hooks (the land, barracks, troop bill, draft, energy and loot questions each give exactly what the engine does) and the simulator checks. `shared/` and the type check are clean (see the summary for the numbers).

**Left for 4B:** all screens (Empire home, Land, Barracks and troops, Raid and Friendly War, test buttons), the test page, Quests (later), and everything that needs saving (C.5).

**James's answers (18 Oct 2026):** separate empire vault: yes; new clans can't raid for 3 days either: yes; Gymnasium raises the draft limit: yes; bigger empire (more barracks and land) so it takes longer to fill: yes. The tables above were from the first, smaller empire; the sizes are now 12 barracks and 24 claims.

## Stage C.4, part B, first half (18 Oct 2026): the Empire home and Land screens

Split in two at James's choice. **First half (done):** Empire home, Land and buildings, test buttons. **Second half (next):** Barracks and troops (buy, the draft setting and "draft my followers"), Raid, Friendly War, and a "win / lose a raid" test button. Quests stay for a later small stage. Branch `clans`; nothing saved, no server, nothing live. James had no rule changes.

**Built** (`src/games/clans/Empire.tsx`, `Land.tsx`, `places.ts`, `session.ts`): a new clan now starts with an empire (`makeClan`), and "Skip a day" also runs `empireNewDay` (worker energy back to 100%).
- **Empire home:** vault and clan purse, "Put in / Take out" with a number box (the engine's kind sentence if there isn't enough), wild land, plots, buildings, today's worker energy, troops with room and prices, army strength, the draft (read-only for now). Button on the clan page.
- **Land and buildings:** pick sides 2-6 (big buttons), area question then fence question (`landPlot`), then the price worked out on screen (it comes from the two answers; shows the Developer's Hall discount if there is one), then "Develop it". "Claim more land" appears when the wild land is gone (50, then 25 more each time). Build: pick a plot, pick a building (all seven listed with size, energy, gold and what it does; ones that can't be built are greyed with the engine's `say`), then the energy question (`energyLeft`, counting energy already used today) and "Build it". A wrong answer still builds and charges the right amount.
- **Test buttons:** Give 100 followers, Put 1,000 gold in the vault, Build a barracks and fill it (all labelled "test only").

**Checked:** 14 new tests (empire home, vault moves both ways with the kind messages, test buttons, keyboard reach, develop with a right and a wrong answer, empty vault, claiming land and not enough gold, building with a wrong answer, energy already used, not enough energy, plot too small, a new day). Type check clean; all `src/games/clans` and `shared/clans` tests pass (159). Looked at the real page at 1366 x 640: the Empire home and the Land question fit with the test strip closed.

**Choices to know about:** the energy question uses what was used so far today as one lump, so it asks one building at a time (not "all three at once"). The draft shows but can't be changed until the second half. The test page link changed: the old Artifact had been deleted, so a new one was made.

### Stage C.4, part B, second half (18 Oct 2026): Barracks and troops, Raid, Friendly War

James had no changes to the first half. **Built** (`Barracks.tsx`, `Raid.tsx`, more in `places.ts`, `raidNo` on the session so each raid gets its own seed):
- **Barracks and troops:** room per kind (have / room / holds), "How many barracks do my troops need?" (`barracksNeeded` on the kind that needs the most, via `barracksFor`). Buy troops: a number box per kind, the engine's `say` shown at once if there is no room or not enough gold (the button is then off), then the cost question (`troopBill`), then "Buy them for N gold". The whole mix is bought together or not at all. The draft: 0 to the top in fives (Gymnasiums raise it), and "Draft my followers" with the `draftJoin` question; the result says plainly that all followers are used up and the rest went home (and when the barracks had no room). The Empire home has buttons to both new screens (its draft line still shows the setting; the controls live in Barracks and troops).
- **Raid and Friendly War:** six kingdoms shown as "an easy one" ... "very tough" with the blurb and treasury, a battle plan (rounds 1-5, Careful / Steady / Bold, loot 5 / 10 / 15 / 20%), the loot question (`lootShare`; the answer equals the gold a win really takes), then a plain, gentle result ("The defenders give way!", "Your army falls back", "A stalemate"), the gold won, the troops that did not come home and the round-by-round strength bars. A Friendly War says clearly nothing is won or lost, changes nothing, and does not use up the one raid a day. When the raid is used the button is off with the engine's sentence.
- **Test buttons:** Win the next raid (a huge army), Lose the next raid (one footman), Allow another raid today.

**Checked:** 18 new tests in `Raid.test.tsx`: buy troops (right and wrong answer both charge the right amount), no room, no barracks, not enough gold, barracks-needed question, the draft with room and with none, keyboard only for the draft and for a Friendly War, raid won (loot answer equals what lands in the vault, also after a wrong answer), raid lost, stalemate, Friendly War changes nothing, one raid a day then the test button, no troops, kingdoms shown kindly. Looked at the real page at 1366 x 640: both new screens and a result fit with the test strip closed.

**Left for later:** Quests (a small stage of their own), classmate raids (the rule exists, no screen), and C.5 (saving, the server and the daily reset). **Whole of C.4 part B:** Empire home, Land and buildings, Barracks and troops, Raid and Friendly War; nothing saved, no server, nothing live, nothing merged to `main`.

## Stage C.4, part C (18 Oct 2026): Quests

James had nothing to change in the Barracks, Raid and Friendly War screens. Branch `clans`; nothing saved, no server, nothing live, nothing merged to `main`.

**Built:**
- **Engine** (`shared/clans/quests.ts`, numbers in `CONFIG.quests`): ten quests as plain data (title, years, story paragraphs, one to three choices, what each gives), the charisma rule, one quest a day (`clan.questDay`, the day number of the last one), a seeded order (`todaysQuest`: the suitable quests in an order fixed by the clan's seed, one a day, cycling with no repeats), and `finishQuest`, which checks the rules and puts the prize on the clan.
- **Prizes** are small, medium or big, mapped to numbers in config: gold 15 / 30 / 50, followers 3 / 7 / 12, training points for every member 1 / 2 / 3. A fight in the Mines earns about 50 gold and 4-13 followers, so a quest is worth about one fight. A found item (Cloth Tunic, Lion's Shield) goes to a member who has the slot free and meets its needs; if nobody can use it, the clan gets half its price in gold. No item over 70 gold. Tests check the caps.
- **The ten quests:** The Wandering Goat (pure story + charm), The Stepping Stones (pattern puzzle), The Three Guards (logic puzzle), The Riddling Troll (number riddle + charm), The Frozen Cave (below-zero puzzle, Year 6 only), The Village Fair (story + charm), The Wishing Well (found item), The Pattern Door (pattern puzzle), The Sleepy Giant (story + a very charming choice, found item), The Pie Cart Puzzle (number riddle).
- **Charisma:** the best charisma in the clan has to reach 8 for a charm choice and 11 for a very charming one. A locked choice is shown greyed with the reason and what would open it. The best charisma in a new clan is 5 to 9 (usually 7), so about a third of clans can use a charm choice straight away and the rest need one to three points of charisma at 6 training points each; the very charming choice needs more.
- **Puzzles** are made by code from a kind and numbers (`makePuzzle`, `buildPuzzle`, `isValidPuzzle`), with Year 4/5/6 bands, so a server can rebuild and mark them. Four kinds: patterns (count on, growing jumps, doubling), order puzzles (three or four animals in a row; clues chain together), number riddles (work backwards), and temperatures below zero. They reuse the question box and the "show the working" step. A wrong answer, or "Show me how", gives the smaller prize and the story carries on.
- **Below-zero puzzle** is only in Year 6 and only while the teacher has "Negative numbers" on; it is never a score.
- **Screen** (`Quest.tsx`): a "Quest" button on the clan page (it says "Quest (done for today)" once used), the story one paragraph at a time ("Read on"), big choice buttons with letters A, B, C (tap or press the letter), the puzzle through `Moment`, then a plain result with the prize in words.
- **Test strip:** "Allow another quest today (test only)" and a "Try quest number" list.

**Checked:** 25 engine tests (every quest's shape, rewards under the caps, every kind of puzzle valid and rebuildable over thousands of seeds, the right answers, the cycle, Year 6 only below zero, one a day, charm locks, found items) and 11 screen tests (every quest by every route through the real screens, right and wrong puzzle answers, the one-a-day and new-day reset, charm greyed and then open, keyboard only, the Year 6 puzzle with a minus sign). Looked at the real page at 1366 x 640: the story, the choices and the puzzle fit with the test strip closed.

**Choices to know about:**
- The quest day is the session's day number, so "Skip a day" gives a new quest. When saving comes (C.5) the daily reset has to set the day properly.
- Puzzles are not tied to a teacher switch except the below-zero one; patterns, logic and riddles are always on. A teacher switch for "story puzzles" can be added if wanted.
- Picking a quest by number shows it whatever the year, so James can see all ten; the daily pick follows the year.

**Left for later:** C.5 (saving, the server and the daily reset), classmate-raid screens, more quests (the engine takes more as plain data).

## Stage C.5, part A: design (18 Oct 2026)

C.5 is split in two, as James agreed (he had no changes to the Quests). **Part A (this one):** keeping a clan between visits and doing every action except fights on the server. **Part B (next, after James has read this):** starting a mine fight, the server replaying it from its seed before it pays out, a half-finished fight kept on the server, the midnight reset job (turns, computer clans' day, news) and what is needed for a first class trial. Nothing in part A is applied, deployed or merged.

**How it works, in one paragraph.** The `clans` server function takes one action at a time ("buy this", "wake her", "do the quest with this answer"), loads the saved clan, runs the *same* `shared/clans` rules the screens use (`shared/clans/actions.ts` and `play.ts`), and saves the result. The browser is never believed about gold, levels, days, seeds or prizes: it only says what the child pressed. The database keeps what it is told and refuses numbers that make no sense.

**Tables** (written like Gem Keep's: row security on, no rights for students, only the server function can reach them):

| Table | One row per | Holds |
|---|---|---|
| `clan_seeds` | student | The number the clan is built from, **chosen by the server**. |
| `clans` | student | Name, seed, version, day number, the first day, clan purse (gold), followers, village levels, Church wake-ups today, the day of the last quest, fights left, fight and raid counters, the "looked closely" list. |
| `clan_members` | student and slot (0-5) | The whole member (stats, gear, spells, HP, points, knocked out) as the rules keep it. |
| `clan_empires` | student | Vault, land, plots and buildings, troops, the draft, worker energy and today's raids. |
| `clan_requests` | request | The answer to each request, for two days, so one sent twice only counts once. |

Left for C.6 (nothing is needed from them yet): votes, news, the village chest, scores, points and achievements. Classmate raids also wait for C.6, because they need the news lines, the teacher switch and a list of who can be raided; the rule itself (`raidRefusal`) already exists and is tested.

**Which columns the server owns.** All of them. Students have no right to read or write any table or call any function (a database test tries each one). The server function checks the sign-in, and the database functions check again that the player is a school account.

**Keeping the browser honest.**
- **Seeds are the server's.** The first time a student opens Clan Quest the database picks their clan seed. The creator's rolls, the order of quests, every puzzle's numbers and every raid come from it. A browser cannot shop around for good rolls: it can only choose a race, class and name from the lists and press "Roll again" up to three times per member, and the server rebuilds every member from those choices (any stats, seeds or gold sent with them are ignored).
- **Maths never blocks, so the shop, Church and Training Hall carry no answers.** They take the true price whatever the child answered. A quest puzzle changes the prize, so the quest request carries the typed answer and the server rebuilds the puzzle from the seed, the day, the quest and the choice to mark it.
- **Everything the rules refuse is refused:** not enough gold or points, no room in the barracks, a building that does not fit, an unknown item or kingdom, one quest a day, one raid a day, the charm rule, the draft steps, and so on. A refused request changes nothing and the browser is shown the clan as it should be, with the engine's kind sentence.
- **Each raid and Friendly War gets its seed from the server** (the clan's seed and a counter the server keeps), so the result is the one the engine gives for that seed and nobody can re-roll a raid.

**Doing the same request twice must not pay twice.** Every request carries an id made by the browser. The id and the answer are kept for two days, and a repeat gets the first answer back (even when the rules would now say no). If two requests race, the second save is refused by a version number and the server loads again and redoes it. The browser retries a dropped connection with the *same* id, which is what makes retrying safe.

**Days.** A clan's day is counted in New Zealand calendar days from its first day. The first time the server sees a clan on a new day it gives it the night's rest (everyone healed, free Church wake-up back, empire energy and raids reset, fights back) and moves it to today's number, so quests and raids come back each day. That is done when the clan is next touched, so a clan away for a week gets one night's rest and today's number. The scheduled midnight job (part B) will still be needed for the things nobody touches: computer clans' day and the news.

**If a teacher resets a clan.** `teacher_reset_clan(student)` deletes the clan, members, empire, remembered requests and the seed, so the student makes a new clan with new rolls. A new season keeps clans (James, 18 Oct 2026, question 10); fame resets in C.6 once fame exists.

**Cost.** One request per action, plus one to open the clan. A day is about 1 to open, 5-8 in the shop, 3-5 training, 1-2 at the Church, 5-8 for the empire, 1-2 raids and 1 quest: roughly 25-30 a day, as planned. Part B adds about 10 for fights. The function allows at most 40 a minute per student.

**What the browser does.** The screens still work out each change themselves (so the test page works with no server at all). With a server, `ClanQuest` loads the clan when it opens, sends each change as an action and replaces its copy with whatever the server answers. If the server says no, the screen shows its sentence; if it cannot be reached the change is undone and the child is told. While the server only has part A, the Mines button is switched off with a kind note, and the test strip is hidden.

## Stage C.5, part A results (18 Oct 2026): saving and the server

Built, tested and **not applied, not deployed, not merged**. Branch `clans`.

**Built**
- `shared/clans/actions.ts`: `parseAction` (reads an action sent by a browser; anything odd is refused), `applyAction` (does it on a copy and either gives the new clan and a result or a refusal), `catchUp` (the night's rest for a new day), plus `clock.ts` (New Zealand day numbers).
- `shared/clans/play.ts`: the shop, Training Hall, Church, troop and raid rules that used to sit in the browser's `places.ts`. `places.ts` now calls them, so the browser and the server run one copy. `create.ts` (the creator's rules, rebuilt from choices) and `words.ts` (the name lists) moved into `shared/clans` for the same reason.
- `supabase/migrations/20261018001800_clans.sql`: the tables above, `clan_offer_seed`, `load_clan`, `save_clan`, `teacher_reset_clan`.
- `supabase/functions/clans/`: the server function (`handler.ts`, `entry.ts`, built `index.ts`), 40 requests a minute per student, up to four tries when requests race.
- Browser: `remote.ts` (the thin layer: `ClanServer`, `makeClanServer` with retry under the same id, `sessionFrom`), `src/data/clans.ts` (binds it to the live function; nothing uses it yet), every screen passes the action with its change, `Moment` passes the typed answer, `ClanQuest` takes an optional `server`.

**Actions the server does** (all but fights): create, load, buy, look closely, train, wake one, wake everyone, put in and take out of the vault, develop, claim land, build, buy troops, set and use the draft, raid a kingdom, Friendly War, quest.

**Checked**
- 59 rule tests (`actions.test.ts`): every action refused when it should be, paid exactly once, the same raid seed gives the same result as the engine, a quest marked by rebuilding the puzzle, the night's rest, a creator that ignores made-up stats, and 2,000 random requests that never make gold, followers, vault, land, troops or points negative.
- 24 server function tests (`handler.test.ts`): sign-in needed, junk refused, a request sent twice (and two at once) pays once, a race is redone on the newer clan, a refusal saves nothing, a database that is down, the 40-a-minute limit, and that the deployed `index.ts` matches the code.
- 47 database checks (`clans.test.sql`): students cannot read, write or call anything, a first save must use the given seed, the version check, a repeat is spotted, bad numbers are refused, the day and seed cannot go backwards, two students stay apart, old requests are forgotten, the teacher reset. Run in a transaction that was rolled back, so the shared local database was left as it was. A full clan (after a raid, a quest, buildings and troops) was also saved and loaded through the real database functions and came back identical.
- 13 browser tests (`Server.test.tsx`, `remote.test.ts`): the real screens against a server-in-a-box that runs the real rules.
- Whole suite: 1,161 tests; type check clean. In the one full run, 3 slow tests (two Mines fight screens and one Gem Keep level test) timed out at 5 seconds while the machine was busy; all three pass on their own.

**Choices to know about**
- **Server seeds.** The seed is the server's, not the browser's. The test page still uses its own.
- **Maths answers are not stored yet.** The shop, Church and Training Hall never needed an answer to be right. Storing each answer the way Gem Keep does (for the teacher's "practising" view and the hardest facts) is not in part A; it belongs with the Teacher page in C.6.
- **Teacher settings are the defaults for now** (Year 5, the usual topics). The server sends its settings with the clan and the screens use them, so the browser and the server agree. The Teacher page replaces this in C.6.
- **No fights yet** (part B), so the Mines button is switched off when there is a server. Fights left, fight number and the day are already kept.
- **Classmate raids** are not an action yet (C.6).
- **Lazy days.** A new day is applied when the clan is next opened, not at midnight. Nothing is lost either way; part B adds the midnight job for the computer clans and news.

**Left:** to apply the migration and deploy the function (James says so, for each); part B; the Teacher page; storing maths answers; classmate raids; the class trial.

## Stage C.5, part B: design (18 Oct 2026)

James had read the part A summary and had no changes. He chose to try the saving part after part B, so nothing from A or B is applied, deployed or merged. Before building, `main` was merged into `clans` (it had moved on: Maths Monsters, Dragon Maths, Power Clash); the migrations here are numbered after those.

**A mine fight, step by step**
1. **Start** (`fightStart`). The server checks there are fights left and someone is awake, takes one off today's count, and picks the fight's seed from the clan's seed and the fight number (`fightSeed`, the same formula the test page already used). The monsters come from `newFight` with that seed. It keeps the fight "open" and sends it to the browser (depth, boss, seed, the maths settings in force, and the rounds so far, none yet).
2. **Play.** The browser plays each round itself (so the screen answers at once and the test page needs no server) and sends what it did: the order for each member and the Battle Cry answer, as `fightRound` with the round number.
3. **Check.** For every round the server rebuilds the whole fight from the seed with `replayFight`, marking the Battle Cry answer by rebuilding the question from the seed and round number. It never reads a result from the browser. Any extra fields (a claimed result, gold, experience) are dropped when the request is read.
4. **Pay.** When the replay says the fight is over, the server pays in one go (`payFight`, the same function the test page uses): surviving HP and SP, knock-outs, experience and levels, gold, followers. The open fight is closed in the same save, so a fight can only pay once.
5. **Same fight sent twice.** An identical request (same request id from part A) gets the first answer back. A *new* request for a round that was already played is refused ("stale round"), and one for a fight that is over is refused ("no fight"). Nothing is paid either time.

**A half-finished fight is kept after every round** (so a refresh, or another Chromebook, rebuilds it exactly), as the plan said. That costs about one request per round (4 or 5 a fight, up to about 40 a day if all 8 fights are used) instead of one per fight; it is the price of "a refresh must not lose it or give a free retry". The function already allows 40 a minute and a round takes far longer than that to play. Starting a fight while one is open just shows the open one (no extra fight used); the fight screen then replays the kept rounds to show the same log and the same state.

**Where fights are kept:** a new table `clan_fights`, one row per clan at most (the open fight: depth, boss, seed, fight number, maths settings, rounds so far). It is deleted when the fight is paid and when a teacher resets the clan. The members are *not* copied: instead, **nothing else about a clan can change while a fight is open** (shop, training, Church, empire, quest and raids are refused with "You are in the middle of a fight. Finish it first!") and **the night's rest waits until the fight is over**. That keeps the replay honest without a second copy of the clan. The maths settings are kept with the fight so a teacher's change cannot alter an open fight's questions.

**What the browser can and cannot do.** The browser is told the seed (it has to play the fight), so a child with developer tools could work out the best orders before sending them. The fight pays about 50 gold, the server caps it at 8 fights a day, and a replay can never produce more than the rules allow. If that is ever seen in class, the next step is for the server to play each round and never send the seed; it is a bigger change and not needed for a trial.

**The midnight job** (`clan_nightly`, a database function run by two schedules, 11:00 and 12:00 UTC, which are midnight in New Zealand summer and winter time; the one that is not midnight finds the day already done and stops):
- **Rest for clans nobody opened.** Does in SQL exactly what `catchUp` does when a clan is next opened: heal and wake everyone, the Church's free wake-up back, empire energy and raids reset, 8 fights, and the clan's day moved to today's number. Because the day is moved, the server then finds nothing left to do, so **a clan is never rested twice**. A clan in the middle of a fight is skipped and rests after its fight (same rule as the server). The job raises the clan's version, so a request made from an older copy is refused and redone. The "8" lives in one SQL function and a test checks it matches `CONFIG.fightsPerDay`; a TypeScript test and the database test check the same clan gives the same rest both ways.
- **Computer clans' day.** There are no computer clans yet (the six computer kingdoms have no day of their own: fixed armies). The job is where they will go in stage C.6. Nothing is faked here.
- **News.** Computer-written lines from the finished-fight log, counts only: "N fights were won in the Mines yesterday." and one line for each boss beaten (by depth, up to three). The log and the news tables have no student id or name at all, so a line cannot name a student. The clan page shows the latest five. Lines are tidied after 30 days.
- **Tidying:** old fight log lines, the job's own record, remembered requests.

**Class trial** (everything a first trial needs and nothing more):
- **A switch:** `app_settings.clans_enabled`, off until a teacher turns it on, with a Clan Quest panel on the teacher page. Off means the hub card is hidden and the `clans` function refuses every request ("not switched on yet"). A teacher can always open it, so James can try it before the class can.
- **Teacher's reset button:** on each pupil's page, the clan at a glance (name, day, level, gold, fights left, in a fight) and "Reset this clan…" with a confirm (`teacher_reset_clan`, which also removes an open fight).
- **A short teacher guide** (`docs/CLANS-TEACHER-GUIDE.md`).
- **Not in:** classmate raids, the village chest, votes, points, achievements, the scoreboard, the maths-topics teacher page (all stage C.6). Clan Quest gives no points yet.

**Browser:** the Mines open when there is a server; "Into the Mines!" asks the server to start; each round is sent as it is played (in order, one at a time); the results screen shows what the server paid, not the browser's sum. If a round is turned down or the connection drops, the fight screen is shown again from the server's copy with a plain message. The test page (no server) still plays everything in the browser, unchanged.

## Stage C.5, part B results (18 Oct 2026): fights, the midnight job and the class trial

Built, tested and **not applied, not deployed, not merged**. Branch `clans`.

**Built**
- `shared/clans/actions.ts`: `fightStart` and `fightRound` actions, the open fight in the saved state, the "finish your fight first" rule, the rest waiting for a fight to end. `play.ts`: `fightSeed`, `payFight`, `FightSummary` (the test page's fight now uses the same ones).
- `supabase/migrations/20261018001900_clans_fights.sql`: `clan_fights`, `clan_fight_log`, `clan_news`, `clan_daily_runs`, the class switch (`clans_enabled`, `teacher_set_clans`), `teacher_clan_info`, `load_clan` and `save_clan` replaced (they carry the fight, the switch and the news), `clan_nightly` and its two schedules.
- The `clans` function: refuses everything when the switch is off, sends the open fight and the news.
- Browser: Mines unlocked, the fight screen plays a server fight (start, send each round, resume after a refresh), the Clan Quest card on the hub behind the teacher's switch, the teacher panel and the student panel, the news on the clan page.
- Docs: `docs/CLANS-TEACHER-GUIDE.md`.

**Checked** (numbers are in the summary)
- 51 rule tests (`shared/clans/fights.test.ts`): start, seed per fight, resume, fights running out, a fight replayed identically, equal to the browser's own engine, Battle Cry marked by the server, paid exactly once, a changed or repeated round refused, a refresh in the middle (and the same ending as an uninterrupted fight), other actions refused while a fight is open, the night's rest waiting, bad requests refused, 60 fights of random play, and the night's rest agreeing with the database job.
- 6 function tests for fights through the real handler (a repeated and a simultaneous last round pay once; a refresh; a wrong round number; a claimed result ignored; the switch).
- 78 database checks (`clans_fights.test.sql`), run together with the part A migration and the part A checks (47) in one transaction that was rolled back, so the shared local database was left as it was.
- 5 fight tests with the real screens against a server in a box (start, the monsters the server picked, every round sent, the paid result shown, refresh, a refused round) and tests for the teacher panels and the card switch.

**Whole suite:** 2,118 tests, type check clean. In the one full run a single slow 101 test (not Clan Quest) timed out at 5 seconds while the machine was busy; it passes on its own.

**Choices to know about:** a round is sent for every round (see the design); the seed is visible to the browser; no computer clans exist yet; Clan Quest gives no points; the maths settings are still the defaults until the Teacher page.

**To go live** (each needs James to say so): apply the two migrations (`20261018001800_clans.sql`, `20261018001900_clans_fights.sql`), deploy the `clans` function, merge `clans` into `main`, then switch Clan Quest on from the teacher page.
