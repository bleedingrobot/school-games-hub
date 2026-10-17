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

C.3 is split in two (James agreed). **Part 1 (done):** clan creator, Mines, fights, Battle Cry, settings strip, pictures. **Part 2 (not started):** Market, Training Hall, Church and the full clan page with their maths moments. James said the C.2 question wording and levels were fine, so nothing changed there. Branch `clans`; nothing saved, no server, nothing live.

**Built** (`src/games/clans/`, `src/maths/PracticalAsk.tsx`, `preview/clans/`, `npm run clans:preview`): the dark terminal look (VT323 headings, system monospace for reading; Dragon Maths' look exists only in its own folder, so this is a fresh copy with the same colours, to be merged into one later). Creator with race, class and name pickers, "Roll again" three times, clan name from two word lists, only HP / attack / defence / best stat by default and "More details" for the rest. The Mines with depth 0-20, the hint from `depthHint`, the 8-a-day counter and bosses at depths 5, 10, 15, 20. The fight: members choose in agility order, Attack / Spell / Guard / Run, Enter for the default action, keys A S G R and 1-9, a plain gentle log ("crumbles away", "runs off", "knocked out and rests"), HP and SP bars with the numbers written on them, duplicate enemies lettered A, B. The Battle Cry before each round (right: pick damage or healing; wrong or "No thanks": the worked answer and carry on; no timer). Number pad now has an optional minus key (Year 6 negatives) and "which is better" is tap-to-answer. Settings strip (year band, topics, depth, "Skip a day") for James's test only. Portraits are made from the class figure coloured by race with a race letter; monsters are Kenney's 1-Bit Pack, coloured by mine zone.

**Licence check (18 Oct 2026):** Kenney's 1-Bit Pack is still CC0 on kenney.nl and in the pack's own licence file (copied to `src/games/clans/KENNEY-LICENSE.txt`).

**Checked:** 14 new tests (creator, three rolls, a fight won with no maths, right and wrong Battle Cry, "No thanks", a keyboard-only fight, minus key, tap answers, skip a day). Whole suite 916 passing, type check clean. Looked at the real page at 1366 x 640: it fits with the settings strip closed (it closes itself in a fight).

**Choices to know about:** the "choosing order" on screen uses agility and health without the engine's small dice roll, so the real turn order in the round can differ slightly. The question box is a new `PracticalAsk` that reuses the number pad and look, because the old box closes itself after 2 seconds and the worked answer needs to stay. VT323 loads from Google Fonts in the test page only; the real site should host it itself. No sound yet. A phone-size screen is laid out but not tried.

**Left for part 2:** Market, Training Hall, Church and the clan page's gear and "practising" line with their maths moments, the shop pictures, then the "Stage C.3 results" wrap-up.
