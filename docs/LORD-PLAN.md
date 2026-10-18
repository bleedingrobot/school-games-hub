# Dragon Maths: plan

A daily-turns fantasy adventure for the hub, in the spirit of the 1990s BBS door game *Legend of the Red Dragon* (LORD). Visit a small village from a menu, go into the forest a few times a day, fight monsters, buy a better sword, beat your master to level up, and one day face the Red Dragon. **Maths is one of the tools that helps you win**: sizing up a monster, working out the healer's bill, counting change at the shop, cracking a riddle, a master's trial and the dragon fight.

Written 17 October 2026 from James's brief ([prompts/lord-maths.md](prompts/lord-maths.md)) after reading [talisto/LORD.ts](https://github.com/talisto/LORD.ts) (v1.4.6) and the hub's code on `main` and `monsters`.
**Status: STARTED 18 Oct 2026 (Maths Monsters is on main): L.0 to L.5 done and tested. L.4 and L.5 are built but NOT applied or deployed: they stop for James (see "L.4 results", "L.5 results" and prompts/lord-golive.md). Next is L.6 (how to play, accessibility, slow-Chromebook check, hint button, final docs), only after James has tried it with the class. Branch `dragon-maths`.** James answered every question in section 14 (all my picks, except: start only **after Maths Monsters is live**).
**Updated 18 Oct 2026** after reading every file of LORD.ts (main game, all 13 add-ons, scripts, tests, change log): **5-week seasons** with a fresh start each time, **romance and orphans kept out for good**, rule-table fixes, and a simulator check of the pace. See section 15.

## The short version

- **LORD.ts is our rule book, not our code base** (the brief's "Path C"). It is GPL-3 code that needs its own always-on Node server with WebSockets and SQLite, and much of the original game is for grown-ups (the barmaid, marriage, children, drinking, gory death lines). The hub is a GitHub Pages site plus Supabase with no always-on server. So we write our own small engine in TypeScript, using LORD's *shape and numbers* (daily turns, 12 levels, masters, the damage formula, the healer's price per HP...), with fresh, kid-friendly writing and our own art. Section 1.
- **It keeps what makes LORD special:** a limited number of forest fights each day, a menu village, cheeky random events, steady progress over weeks, a daily news page, and the dragon at the end.
- **5-week seasons** (James, 18 Oct): every hero starts fresh at level 1 every 5 weeks, so a new pupil or a slow starter is never hopelessly behind. A steady player can reach the dragon inside one season. Section 11.
- **Maths is short and not on every screen.** About 1 in 3 fights offers a "size it up" question, plus the shop, healer, bank, master trials, riddles and the dragon. A wrong answer shows how to do it and the game goes on. No timers, no speed bonuses.
- **It reuses the maths engine Maths Monsters is building** (the six topic packs in `shared/maths/skillPacks/`). No new maths code except a few new question kinds (money, patterns).
- **Saved on the server, and the server is the boss** (the brief is firm about this, and daily turns make it matter): the server hands out each fight and checks it before it counts.
- **Classmates appear as rival heroes** in the arena and the news, along with a few computer heroes so the village feels busy from day one. No chat, no typing, no student-made text, same as the rest of the hub.
- **Size:** about the same as Maths Monsters without the walking world. Seven stages (section 13), with a test page for James after the fights stage.

## 1. What we found in LORD.ts (17 Oct 2026)

**What it is:** a careful TypeScript port of LORD from the Synchronet BBS version. About 12,000 lines in the main game files, plus scripted events (the original `.ldy` files), 13 add-on modules, and 68 test files. It runs from the terminal, telnet or a browser terminal, all through a Node server.

**Licence: GPL-3** (checked in its `LICENSE` file). Copying its code into the hub would mean the hub's code has to be shared under GPL-3 too. The hub's repo has no licence yet, so that would be a decision for James, not something to slip in. The original writing, monster names and characters belong to Seth Able Robinson and weren't given away by anyone, and the README itself says the port was made without permission. **So: no copied code, no copied text.** Game rules and numbers aren't owned the same way, and we credit LORD and LORD.ts for them.

**Why we can't just host it:**

- It needs a server running all the time (Node 22, WebSockets, SQLite file, Docker in its setup). The hub deliberately has no server like that, and Supabase's free functions only answer one request at a time.
- Its screen is a terminal: text drawn with colour codes and key presses. That's hard for a 9-year-old on a Chromebook, has no touch support, and screen readers get little from it.
- Its sign-in is a typed username. The hub's school Google sign-in, profiles, points and teacher page would all need rebuilding inside it.

**Not suitable for children, so left out or rewritten:** Violet the barmaid (flirting, "lays" stat), marriage and having children (children even give you extra fights), drinking at the inn, the Dark Cloak Tavern's gambling and blackjack, the flower garden and mail (players write free text to each other), killing players who are asleep at the inn, and the gory monster death lines.

**Kept out for good (James, 18 Oct): all romance and all orphans.** That means no flirting, kissing, dates, love letters, marriage or babies, and no orphans, adopting, buying, selling or "catching" children, and no children as a stat. This covers the add-on ideas too: Olodrin's Orphanage, Felicity's temple nursery and flirting, the Cavern's lost children and "lost warrior" scene, the cavern women, Violet's add-on, TeamLord's parties, and the forest's Olivia, Violet and Seth scenes. LORD's backstory (the dragon eats the village's children) is replaced too: our dragon steals the village's treasure, food and light (final wording in L.3).

**What we take from it (rules and numbers, rewritten in our code, credited):**

| LORD rule | LORD's number | Ours |
|---|---|---|
| Forest fights a day | 15 | 10 (question 2) |
| Arena (player) fights a day | 3 | 3 |
| Levels | 12, then the dragon | Same |
| Monsters | 11 listed per level but only 10 ever appear; mostly your level, sometimes weaker (1 in 6) | 10 per level, our own monsters |
| Damage | random half of strength + half of strength. **Monsters have no defence**: only *your* defence cuts the damage you take (defence on both sides only in player fights) | Same |
| Masters | 11 masters; you need enough exp (exp is never spent) to challenge one, **once a day**; beating them raises a level and gives strength, defence and HP; **losing costs nothing**, you're healed | Same, our own masters |
| Exp needed per level | 100, 400, 1,000, 4,000, 10,000... 10,000,000 | **Our own curve**, tuned for a 5-week season (section 7) |
| Healer | 5 gold × your level per HP | Same, and it's a maths moment |
| Losing a fight | lose all gold you carry and 10% exp, dead until tomorrow | Softer (question 3) |
| Bank | gold in the bank is safe when you lose | Same (the reason to bank) |
| Forest events | 1 in 5 trips into the forest is an event, and **events don't use up a fight** | Same: events are free (decide finally in L.0 with the simulator) |
| Classes | Death Knight, Mystic, Thief, each with skill uses per day; master one (40 lessons) and you can learn another | Knight, Mage, Trickster (section 4), one class per run |
| Shop | sell your old item first (half price back); the best gear needs enough strength or defence | Same: this is what stops saved-up gold skipping half the game |
| Bank | 10% interest added automatically every day (LORD's main money engine) | Not automatic; see section 15 |
| The dragon | one huge fight (15,000 HP), found by a secret key at level 12; killing it starts you over at level 1, stronger and famous; **3 kills ends the game for everyone** | Three-stage fight (section 9); no game-ending kill, seasons instead |

## 2. How it fits with Maths Monsters

Both are battle adventures with maths, so they need to feel different:

| | Maths Monsters | Dragon maths |
|---|---|---|
| Feel | Collect a team, walk a world | One hero, a menu village, daily turns |
| Maths | A question on every attack | Questions at chosen moments; plenty of fights have none |
| Pace | Play as much as you like | A few minutes a day, come back tomorrow |
| Social | Collection leaderboard | Rival heroes, arena, daily news |

They share the maths engine, the question box, answer records and the teacher's topic switches. That's why this comes **after Maths Monsters is live** (James, question 8): its maths packs and saving pieces are on the `monsters` branch, not on `main` yet.

## 3. The village

A menu, not a map (the brief says the menu is a feature). Each place is a short scene with big buttons and LORD-style letter keys (**F**orest, **S**hop...).

| Place | What happens | Maths? |
|---|---|---|
| **The Forest** | Fights and random events. Uses a forest turn | Sometimes (section 6) |
| **Blacksmith** (weapons) and **Armourer** | Buy and sell one weapon and one armour, LORD-style ladder | Yes: change, "can you afford it?", "which is better value?" |
| **Healer's Hut** | Pay to heal | Yes: "12 HP at 15 gold each?" right answer = 10% off |
| **The Bank** | Deposit and withdraw; safe when you lose | Optional interest question (Decimals pack, older students) |
| **The Inn** | Gossip, the bard's song, a riddle of the day, the number-guess game | Patterns and logic |
| **Training Grounds** | See your master; challenge them when you have the exp | Master's trial (3 questions) |
| **The Arena** | 3 fights a day against classmates' and computer heroes | No |
| **Daily News** | What happened in the village today (computer-written lines only) | No |
| **Your hero** | Stats, gear, history, achievements, "maths I'm practising" | No |
| **The dragon** | Found in the forest once you're level 12 and have beaten the last master | Dragon trial (section 9) |

## 4. Your hero

- **Name: your hub name** (the word-list name, e.g. *Brave Kiwi*). Nothing to type.
- **Pick a class** (can't change until you beat the dragon or a new season starts):
  - **Knight**: a power strike (×2 damage) a few times a day.
  - **Mage**: a few small spells (a heal, a shield, a zap).
  - **Trickster**: dodge, or "pinch" a little gold from a monster.
  - Uses per day grow when you visit your class's secret place in the forest (a LORD idea).
- **Maths doesn't depend on class.** Every class gets the same questions and the same bonus sizes.
- A simple look: the hub avatar shown in a pixel frame, plus a colour.

## 5. A day in the game

1. Open the game: "You have 10 forest fights and 3 arena fights today."
2. Go to the forest, fight, find gold and exp, maybe a random event.
3. Pop back to heal, bank gold, buy a better sword, try your master.
4. When the forest turns run out, the village is still open: shop, bank, inn, news.
5. **The next New Zealand day** (midnight) gives the turns back, plus new news and a new riddle.

A day's turns take about 5-10 minutes. Turns don't pile up if you miss a day (like LORD).

**Practice Mode** (teacher switch, question 6): a "training yard" for extra maths in class without unbalancing the game. My pick: practice questions earn a little gold but no exp, so nobody can level up faster by grinding practice.

## 6. Forest and fights

**A trip into the forest** is a fight (4 in 5) or an event (1 in 5). As in LORD, only fights use up a forest fight; events are free (to confirm in L.0).

**A fight:**

1. A monster appears with its name, picture, HP and a cheeky line ("A goblin who says the treasure is for tax purposes").
2. About 1 fight in 3 offers **Size it up** (never forced; you can just fight):
   - a question from the topic the teacher has on, at the student's own level (the shared engine's Leitner boxes pick it);
   - **right**: the monster's weak spot, your first hit does ×1.5;
   - **right after a hint**: ×1.25;
   - **wrong**: the worked answer is shown and the fight carries on normally. Nothing is lost.
3. Then LORD fighting: **A**ttack, **R**un, or your class skill. Damage is LORD's formula. Running away sometimes fails.
4. Win: gold and exp. Lose: question 3.

**No speed bonus and no timer.** The brief says power must never come from answering fast, so this differs from Maths Monsters' "quick hit".

**Forest events** (our own writing, a mix of maths and no-maths, about 15 to start):

- *The treasure piles*: two chests labelled 4,060 and 4,600 coins; pick the bigger (place value).
- *The old woman's riddle*: what comes next in 3, 7, 11, 15...? (patterns)
- *The gem-sharing goblins*: share 24 gems between 3 goblins and keep what's left (division).
- *Lost gold*: just finding it (no maths).
- *The fairy*: heals you (no maths).
- *The treasure map*: it's a very detailed map of the rubbish tip (no maths, a joke).
- *Your class's secret place*: learn another skill use.

## 7. Numbers that work for 9-year-olds

LORD's numbers get huge: a level-12 monster drops 336,643 gold and the best armour costs 400 million. Those are too big to do sums with. So:

- **All gold and prices ÷ 100**, rounded to friendly numbers, and the shop trimmed to 12 weapons and 12 armours (about one per level). The dearest item is then about 100,000 gold. Exp is rescaled the same way.
- **LORD's exp curve is far too slow for us.** A quick simulator on 18 Oct (LORD's real monsters, masters and shop; 10 fights a day, soft losing, no interest) put a pupil playing *every* day at level 6 after about 22 days and level 12 after about **157 days**. Exp alone needs about 117 days; levels 10 and 11 take about 29 days each. Adding interest or 15 fights still leaves it at 113-130 days.
- **So we write our own exp curve** (and gold to match), keeping LORD's feel of each level being a step up. **The target, for a 5-week season:** a pupil who plays about 4 school days a week (about 16-20 play days in the season) reaches the dragon in week 4 or 5. That's roughly **1½ play days per level**, about 15 forest fights. Someone who plays every day gets there around week 3 and can start a second, faster run.
- The L.1 simulator checks it against those targets: days to each level for "every day", "4 days a week" and "2 days a week" players, how often a pupil loses a fight (aim: now and then, not never), and how often a master beats you.

## 8. Maths moments

| Moment | Topic (shared packs) | Right answer | Wrong answer |
|---|---|---|---|
| Size it up (1 fight in 3) | Whichever topics the teacher has on | ×1.5 first hit | Worked answer, normal fight |
| Shop | Decimals and money / adding and taking away | Small discount or a free potion | Worked answer, normal price |
| Healer | Times tables / multiplying | 10% off | Worked answer, normal price |
| Bank interest (optional, off for younger) | Decimals | A little interest | Worked answer, no interest that day |
| Treasure and riddles | Place value, patterns | Extra gold | Worked answer, a little gold |
| Inn number-guess | Logic (higher/lower in 7 guesses) | Gold prize | Small prize for trying |
| Master's trial | Mixed, at the student's level | Bonus strength when you level up | Worked answer; the master fight is still decided by the fight |
| Dragon trial | Mixed review | See section 9 | Worked answer, the fight goes on |

- **New question kinds needed:** money word problems ("You have 240 gold, the shield costs 185"), "which is better value?", and number patterns. These are added to the shared packs, so other games get them too.
- **Questions are made and marked by code**, never by an AI. The server rebuilds each question from its numbers to check the answer (Maths Monsters already works this way).
- **Hints:** one hint per question (a short worked step), then the answer.
- **Private:** a student sees "practising: fractions" on their hero page. Maths accuracy is never shown to classmates.

## 9. The dragon and winning

- Reachable at **level 12 after beating the last master**, from the forest, like LORD.
- A long fight in **three stages**. Before each stage, one question from a different topic. Right answers give a small shield and a slightly bigger first hit for that stage. The dragon can still be beaten with great gear and no right answers, and lost with every answer right. It's a fight, not a test.
- **Beating it:** a big news story, the Hall of Heroes, points and an achievement. Then, as in LORD, your hero starts again at level 1 with a dragon-kill star, keeping your class skill. A second run in the same season is faster.
- **There is no game-ending kill** (LORD ends the game for everyone after 3). The season clock does that job instead (section 11).

## 10. Saving and fairness

The server decides everything that matters: gold, exp, HP, turns left, gear.

- **New tables** (students can't write to them directly, as usual): `lord_heroes` (one row per student), `lord_news` (computer-written lines), `lord_fights` (each fight handed out and its result).
- **New `lord` server function.** A forest turn: the server takes one turn off today's count, picks the monster and a random seed, and sends them. The browser plays the fight. At the end it sends the choices and answers; the server replays the fight with the same engine (`shared/lord/`) and seed, checks each answer by rebuilding its question, and only then gives the gold and exp. Sending the same result twice counts once. Shop, healer, bank and training are one request each, done on the server.
- **Why so strict:** with daily turns, a faked fight or a replayed request would be a real advantage over classmates. This is the same replay idea as the bot games.
- **Free-plan cost:** about 25 requests per student per day (one per fight, because the end of one fight and the start of the next go together, plus shopping). 100 students playing every day for a month is about 75,000, alongside the other games' ~70,000 a month, against 500,000.
- **Refresh-safe:** a half-finished fight is kept on the server and picks up where it was.

## 11. Rivals, news, points and the teacher

- **Arena:** fight a saved copy of a classmate's hero (the computer plays it). 3 a day. Winning gives a little exp and a news line. **Losing costs nothing.** (LORD took gold and exp. Too harsh when your friend did it to you.)
- **Computer heroes:** about 8 village heroes who level up at a believable pace, so the arena and news are busy from day one. They're clearly marked as computer heroes.
- **Daily News:** lines like "Brave Kiwi beat Master Halder!" or "Quiet Tui was flattened by a Grumpy Troll." Only computer-written lines, no student text.
- **Warriors list:** level and dragon kills, top 10 plus you, like the other games' boards. Never maths scores.
- **Points:** inside the shared 40-a-day bot-game cap. My pick: 1 point per 3 forest wins, 3 for a master, 10 for the dragon. `ranked: false`.
- **Achievements** (about 8): first master, level 6, level 12, dragon, 10 arena wins, 50 riddles...
- **5-week seasons** (James, 18 Oct; replaces question 9's "keep heroes"). LORD.ts has a similar "tournament" mode (a round lasts a set number of days, then resets).
  - At the end of week 5 every hero goes back to level 1 with starting gold and gear. The Warriors list starts empty.
  - **Kept forever:** achievements, dragon-kill stars, and the **Hall of Heroes**, a list per season of everyone who beat the dragon (and how many times). Hub points already earned stay earned.
  - My pick: the teacher sets the season start date on the teacher page (default: the next Monday); seasons then run back to back, two to a 10-week term. In the school holidays the game is closed and the season clock waits.
  - The last few days of a season show a countdown ("4 days left this season") so the reset is never a surprise. Fights already in progress finish first.
  - Class choice can change at each new season.
- **Teacher page:** game on/off; topics on/off (shared with Maths Monsters); forest fights a day; Practice Mode; each student's topics using Gem Keep's "hardest facts" panel; reset a student's hero; season start date and the Hall of Heroes. A CSV export can come later.
- **Privacy:** no new personal data. Heroes use hub names; answers are stored the same way as Gem Keep's and Maths Monsters'.

## 12. Look and sound

- **Modern BBS look:** dark background, the old 16 ANSI colours, a pixel font for headings (*VT323*, open licence) and a clear normal font for reading. Box-drawn borders, short screens of text, small pixel pictures.
- **Monsters and items from Kenney's 1-Bit Pack** (CC0, free for anything; check the licence again when we start), drawn big and coloured in code. Our own masters and dragon pictures from parts, like the 101 card faces.
- **Real web pages, not a terminal**, so it has big buttons, touch, keyboard letters, screen readers, and fits a Chromebook at 1366 × 640. A "classic" setting can make it look even more like a terminal.
- Little animations (hits, treasure, level up, dragon roar), all off for reduced motion. Sound made in code, off by default in class.

## 13. Stages (when picked up)

| Stage | What | Rough size |
|---|---|---|
| **L.0** | LORD rule sheet: every number we take from LORD.ts, the rescaled economy, and every place we change LORD on purpose. Check Kenney and font licences | Small |
| **L.1** | `shared/lord/` engine: heroes, classes, monsters, fights, events, shop, healer, bank, masters, daily turns, dragon, replay. Seeded random. Simulator to tune the pace (section 7) | Medium |
| **L.2** | Maths: new money / better-value / pattern question kinds in the shared packs, and the maths moments wired into the engine | Small-medium |
| **L.3** | Screens: village, forest, fight, shop, healer, bank, inn, training, hero page, all writing and art. **Test page artifact for James**, nothing saved | Big |
| **L.4** | Saving and fairness: migration, `lord` function, replay checks, refresh-safe fights. Class trial possible from here | Medium |
| **L.5** | Arena, computer heroes, daily news, warriors list, points, achievements, teacher page. **Go live**, needs James to say so | Medium |
| **L.6** | How to play, accessibility pass, slow-Chromebook check, docs | Small |

Each stage ends with tests passing and a results section here, and stops for James's review.

## 14. James's answers (17 Oct 2026)

| # | Question | Answer |
|---|---|---|
| 1 | Name | **Dragon Maths** |
| 2 | Forest fights a day | **10** |
| 3 | Losing a forest fight | **Soft:** lose the gold you're carrying (banked gold is safe), keep your exp, wake at the healer, keep playing |
| 4 | Arena opponents | **Classmates' heroes and computer heroes**, losing costs nothing |
| 5 | Inn games | **No gambling:** number-guess, riddle of the day and the bard |
| 6 | Practice Mode | **A little gold, no exp** |
| 7 | Look | **Dark BBS style** |
| 8 | When | **After Maths Monsters is fully live** (not just N.6) |
| 9 | New season | ~~Keep heroes, reset points~~ → **5-week seasons, heroes start fresh** (18 Oct) |
| 10 | Romance | **Kept out for good** (18 Oct) |
| 11 | Orphans and children | **Kept out for good** (18 Oct) |

## 15. Review against all of LORD.ts (18 Oct 2026)

The rule table in section 1, sections 7, 9 and 11 and the "kept out" list are already updated. These are left to settle in **L.0**, each with a pick:

- **Gems.** Everywhere in LORD: 2 gems buy a permanent +1 strength, defence or HP at the inn, they pay for class lessons, and events hand them out. Good maths too ("3 gems for 2 potions", "can you afford it?"). *Pick: keep gems* as a second, rarer currency.
- **Charm → Kindness.** LORD's charm is mostly romance (out), but it also rewards kind choices (helping the old man, leaving a grave alone, letting the fairy go). *Pick: a Kindness stat* that small events reward, giving slightly better shop prices.
- **Bank interest.** LORD adds 10% a day automatically, and its late game depends on it. *Pick: no automatic interest*; the economy is tuned without it, and the optional interest question gives a small bonus.
- **Running away, the fairy that can save your life, a horse for extra fights.** *Pick: keep running away (sometimes fails) and the fairy; leave out the horse* (extra fights unbalance a short season).
- **Computer heroes** must not copy LORD's computer-player add-on, which uses different fight maths, levels up without masters and attacks real players. Ours use the same engine and simulator, level on a schedule, and **never cost a pupil anything**.
- **Events as data, not code.** LORD's scripted events (`.ldy`) and the Cavern's scripts are filled-in tables run by a small engine. Ours too, so going from 15 events to 50 is writing work.
- **A daily village event** (from the LrdEvent add-on): one line each day like "Market day: everything 10% off" or "A fog: one less forest fight". Cheap variety, and often a maths moment.
- **Maths ideas to borrow (ideas only, never text):** "can you afford it?" deals where asking for too much backfires; swap rates; spot-the-cheat cup games; the class tests (the mage's number-guess only gives 6 tries for 1-100, which isn't always enough; ours gives 7 and then shows the halving trick). **Not borrowed:** higher/lower card games and wagers (gambling). If a screen ever states a chance, the code must match it (one add-on promises 25% chances that are wrong).
- **Riddles and trivia** in the add-ons are typed answers; ours are multiple choice or a number pad (no typing).
- **Lessons from LORD.ts's change log:** players stockpiled children for extra daily fights and disconnected mid-shop to keep purchases. Anything that adds fights or income every day will be farmed; the simulator should try the greedy strategies, and every spend is saved on the server at once (already the plan).
- **Don't block players who share an internet address** (a LORD.ts option): the whole school shares one.
- **Testing:** LORD.ts has a "god mode" that can set any stat, trigger any event and force the next random numbers. The L.3 test page gets the same: jump to any level, trigger any event, go straight to the dragon.
- **Daily reset with no server:** LORD resets a player's day the first time they play that day. Our `lord` function does the same (NZ date), so nothing needs to run at midnight. The season reset works the same way (checked on first play after the end date).

## Results so far (18 Oct 2026)

**L.0 done:** [LORD-RULES.md](LORD-RULES.md) lists every rule and number, and where we differ from LORD.

**L.1 done:** the engine is in `shared/lord/`: seeded fights that can be saved and replayed (the whole random generator is one number), heroes, three classes, the daily rollover and New Zealand date, 35-day seasons, forest trips and events (11, four with maths hooks for L.2), masters, the three-stage dragon, healer, bank and shop. 47 tests. The simulator is `npm run lord:sim`.

What the simulator told us, and what changed because of it:

- The first Trickster could not win master fights (14% against the Knight's 63%). Dodge now also hits back, and Pinch is a normal hit that lifts gold. All three classes now finish within a play day of each other.
- Healing at LORD's price ate 55-60% of gold. Now about 40%.
- The dragon was unbeatable (0%), then too easy. James chose "harder" (18 Oct). **The simulator was refilling a pupil's 3 daily skill uses at each dragon stage (9 uses); it is fixed, and the final numbers are in [LORD-RULES.md](LORD-RULES.md):** about 35% a try for a pupil who answers 70% right, with a 30% HP breather between stages.
- Pace: a pupil who plays every day reaches level 12 in week 3, and one who plays 4 days a week in week 5. **A pupil who plays 2 days a week only reaches level 6 or 7 in a 5-week season.** That is open question 12 below.

**L.2 done (18 Oct 2026):**

- **Two new maths packs** in `shared/maths/skillPacks/`: *Gold and shopping* (`money.ts`: change, the cost of several, totals, gold left, swap rates, how much more you need, which deal is better value as a pick-one question, bigger change) and *Number patterns* (`patterns.ts`: counting on and back, doubling, a gap in the middle, the step, growing steps, rules like n × 3 + 1). Four bands each, built the same way as the other packs, with worked answers. They are exported as `EXTRA_PACKS` and are **not** in the shared topic list, so Maths Monsters' teacher switches are unchanged. Adding them to that list is a one-line change when another game wants them.
- **`shared/lord/maths.ts`:** which pack each moment uses, and what each result is worth. Right in *size it up* is ×1.5 on the first hit (×1.25 after a hint, ×1 if wrong); right at the shop or healer is 10% off (5% after a hint); each right answer in a master's trial adds a little strength on levelling up; a right answer before a dragon stage gives a shield and a ×1.5 first hit. A wrong answer never takes anything away. No timer and no speed bonus anywhere.
- 56 new tests, including that every roll of every question family makes a sound question. They found one real bug (the change question could cost more than you paid), now fixed.

**L.3 done, for James to try (18 Oct 2026):**

- **How to open it:** `https://…/#/dragon-maths` in the hub (no card on the dashboard; `DRAGON_MATHS_ON` in `src/games/registry.ts` is false), or without signing in: `npx vite --config vite.lord-preview.config.ts` (`npm run lord:preview` builds it). The hero is kept on that browser only (clearly labelled as a trial); nothing is sent anywhere.
- **What is there:** class choice; the village with letter keys (F, S, H, B, I, T, N, Y; Esc goes back); the forest (fights and events, events free); the fight screen (Attack, Run, class skills, number keys, a plain-words log); the shop (sell back, strength and defence needed, 10% off for a right answer); the healer (10% off); the bank (and the interest question from level 4); the inn (bard, riddle of the day, number guess); the Training Grounds (your master, 3 trial questions, then the fight); the dragon (3 riddles, 3 fights, a breather between); your hero page; a small daily news page; and **Test tools** (key X): jump to any level or straight to the dragon, +gold, +experience, refill turns, hurt me, skip to tomorrow, best gear, trigger any event, delete the trial hero.
- **Pictures:** Kenney 1-Bit Pack (CC0, licence checked 18 Oct, copy in `src/games/lord/KENNEY-LICENSE.txt`), one-colour tiles recoloured in code by level (`tileMap.ts`). 60 monsters at first (now 120), 11 masters, the dragon, 12 weapons, 12 armours. The picks were checked by eye, and a few will want swapping (some monsters are look-alikes).
- **Checked by playing it in a browser:** a whole run through the forest, shop, healer, bank, inn, a master and the dragon (both losing and winning, with the star), with no console errors. That found two bugs, both fixed: a maths event's story text named numbers that the question then didn't use (event text no longer states numbers, and a test enforces it), and the question box's title was unreadable on the dark theme.
- **Not in yet:** the one hint per question (the shared question box has no hint button; to add in L.6 or with the next change to it), the teacher's topic switches (all topics are on), sound, and the reduced-motion and slow-Chromebook checks (L.6).
- **Font:** the plan said VT323, but the hub's rule is "system fonts only, nothing downloaded", so the game uses the system monospace font for now. Bundling VT323 (open licence) is an option for L.6.

**Question 13 answered (James, 18 Oct): "a fight, not a test".** The dragon's riddle bonuses are now small (a 17-point shield and a ×1.2 first hit), and the dragon was retuned: about 35% a try for a pupil answering 70% right as Knight or Mage (22% as Trickster). See LORD-RULES.md.

**Content added (18 Oct 2026):** **ten monsters a level** (120 in all, five of each level new, each with a one-line intro and a picture), and **28 forest events** (17 luck and jokes, 11 with maths: place value, patterns, division, money, times tables, adding and taking away, fractions and decimals). A maths event can now be declined with **Walk on**: no reward, no penalty. The pace is unchanged by the new monsters (re-run on the simulator). All 28 events were opened in a browser to check each asks a sensible question.

**Not done yet (as of L.3; see "L.4 results" for saving):** gems to spend, the arena and computer heroes. Nothing is on the dashboard.

**Question 12 (James):** should a pupil who plays twice a week be able to reach the dragon in a season? Options: leave as is (they get halfway, and the next season is a fresh start); make the curve gentler (every pupil gets there, but a daily player has four spare weeks); or give Practice Mode extra fights. My pick: leave it, and review once real pupils have played.

## L.4 results (18 Oct 2026): saving and fairness, built and tested, NOT live

**Nothing is applied and nothing is deployed.** The migration is `supabase/migrations/20261018001600_dragon_maths.sql` (run in a rolled-back transaction on the local database, never on the live one) and the function is built into `supabase/functions/lord/index.ts`. `DRAGON_MATHS_ON` is still `false`, so there is no card on the dashboard. The steps to go live are in [prompts/lord-golive.md](prompts/lord-golive.md).

**What was built**

- **One rule book, two places to run it.** `shared/lord/server.ts` (`runLord`) takes one request for one pupil and returns the new state. The `lord` server function calls it against Supabase; the browser-only trial (`preview/lord`) calls the very same code against a little save in the browser (`shared/lord/memoryServices.ts`, which follows the same rules as the SQL). So the trial and the real game cannot disagree about the rules, and the trial still has the test tools.
- **Migration.** Tables `lord_heroes` (hero as JSON, version, season, day, plus an `extra` column for the things the engine's `Hero` does not hold: today's riddle and interest, the number-guess secret, an event waiting, a dragon run in progress), `lord_fights` (monster, seed, the fight as it started, its options, the actions played, the result; a partial unique index allows one open fight per pupil), `lord_events` (an audit note per accepted request, with the request id, unique per pupil) and `lord_refusals` (short codes). All four are closed to students (RLS on, nothing granted). `my_lord()` gives a pupil their own hero, the settings, whether they are a teacher and their maths records (never the guess secret). `app_settings` gets `lord_enabled` (**OFF**), `lord_forest_per_day` (10) and `lord_season_start`; `teacher_set_lord()` changes them (switching on with no date starts season 1 today). `lord_commit()` is the one way the server writes: the hero, the fight and the audit note go in together or not at all, a request id counts once, a change must follow the version it was made from, and a fight is finished once. Old history is trimmed after 60 days. Points, leaderboards and the "warriors" list are untouched.
- **The `lord` function** (`handler.ts` is the front door: sign-in, 60 requests a minute; the rules are in `shared/lord/server.ts`). Actions: `load`, `rollover`, `start-hero`, `forest`, `fight-finish`, `event`, `master-start`, `master-finish`, `dragon-stage`, `dragon-finish`, `shop-buy`, `heal`, `bank`, `inn` and `tools`.
  - **Nothing runs at midnight.** The first request of a new New Zealand day gives back the turns, skills and health; the first request of a new season starts the hero again (stars kept, class can be changed, and a fight in progress finishes first).
  - **The server hands out fights.** `forest` picks the trip with a server seed; a monster costs the turn at once (closing the tab does not give it back); an event is free and stays waiting until it is dealt with, so it cannot be re-rolled. A master's turn for the day is used when the fight is handed out. The fight is stored as it started, so it can always be replayed.
  - **Finishing is a replay.** The browser sends the actions it played; the server runs `replayFight` from the stored start and only then pays. Actions that do not replay, run on past the end, or do not finish the fight are turned down (`tampered`) and the fight stays open. A fight is finished once, even if the repeat has a new request id.
  - **Refresh-safe.** While a fight is open every other change (shop, healer, bank, inn, another fight) is refused with "finish your fight first", and `load` hands the same fight back. Version and request-id checks: an old version is told `stale`, a used id `duplicate`; both get the current state back.
  - **Maths is marked by the server** (`shared/lord/proof.ts`): the browser sends the pack, key, numbers and what the pupil gave; the server checks the pack is allowed at that moment, that the level and key are ones the game could ask a hero of that level, rebuilds the question (`BandedPack.rebuild`, or the times-table facts) and marks it. A proof that cannot be checked counts as wrong and leaves a short code for the teacher page; the pupil sees nothing. It decides the size-it-up bonus (and whether a fight offers it comes from the seed), shop and healer discounts, the master trial strength, the dragon riddles, the bank interest and the inn riddle. Each valid answer goes into the shared maths records (`record_fact_answers`, one batch per request and pack, so a retry counts once). Maths events only pay for a right answer to a question from the event's own topic; "Walk on" pays nothing and costs nothing.
  - **The dragon.** Stage 1 needs level 12 and the last master beaten; the stages go in order, each with its riddle; the hero's HP and the day's shared skill uses carry from stage to stage; winning stage 3 gives the star and a fresh level-1 hero; losing sends you home. A run in progress is dropped at the next New Zealand midnight.
  - **The inn's number guess** is played on the server (the secret never leaves it): `guess-start`, then one request per guess with a high/low hint, seven tries, once a day, resumable after a reload.
  - **Test tools** (`tools`) work only for teacher accounts (anyone else is turned away and it is noted). The screens show them only in the browser trial; the live game never loads them.
- **The website.** `src/data/lord.ts` is the data layer (copied in shape from `src/data/monsters.ts`): it opens the game (flushing anything waiting first), sends requests, and keeps a finished fight in a small queue on the Chromebook if the connection is down ("saving later" banner with a Try again button; it also retries when the Wi-Fi comes back). Everything else waits for the server. The screens show a friendly "village gates are closed" when the switch is off, "can't connect" with Try again, "the season hasn't started", and a note when a half-finished fight is waiting ("press F to carry on from the start of it"). `storage.ts` (the old browser-only save) is gone.

**What was checked**

- 68 handler tests (every action; a normal day; losing; running away; a master won and lost; all three dragon stages, the riddle bonuses, shared skills, losing and "one try a day"; a repeated request; a tampered result of eight kinds; a forged right answer; made-up question numbers; an old version; a second device; a second open fight; the day rolling at New Zealand midnight and not a second before; a missed few days; a fight crossing midnight; a season ending and a fight in progress finishing first; the teacher switch off; test tools for students and teachers; the database being unreachable; the deployable file being up to date), and that the server and the browser get exactly the same result from the same seed and actions.
- 88 SQL tests (`supabase/tests/database/lord.test.sql`): students cannot read or write any table or call any server function, each reads only their own hero, versions, request ids, one open fight, a fight finished once, a refused change leaves nothing behind, the teacher switch and its checks, and the two new maths packs are accepted by the shared records. The security test's list of functions a student may call was updated (`my_lord`, `teacher_set_lord`). The migration and every existing SQL test were run together in a transaction that was rolled back (the local database is shared with other sessions, so `npm run test:db` was not used). All pass.
- 29 website tests: the screens against the real rules (class pick, village, a fight played and paid, a half-finished fight offered again after a reload with no extra fight used, the shop, the bank, test tools in the trial and not in the live game, closed, can't connect, a finished fight saved on the device when the connection drops) and the data layer (opening, closed, offline, the queue, retries, "already saved" counted as done).
- **Played in a real browser** (headless Chromium against the trial build): class pick, a forest fight paid by the rules, a reload keeping the hero, a master trial and win, and the dragon (a riddle before each stage, the stages in order, a loss at stage 3). No console errors.
- `npm run check`: typecheck and build pass; every test passes except the known one (the generated `supabase/functions/monster/index.ts` being out of date, left alone as agreed). The flaky chess-bot test passed this time.

**Where I differ from the brief, or chose**

- The interest question is the `bank` action (`op: "interest"`), not under `inn`, because that is where it is on screen. Riddle and number guess are under `inn`. All three are once a day.
- **A teacher can play while the switch is off**, so James can try the real game before pupils can. Pupils get "closed". (Easy to take out: one line in `runLord`.)
- **The dragon is one try a day** (the rule sheet and simulator assumed it; the old trial did not enforce it).
- A skipped question ("No thanks, pay full price", "Walk on") is "no answer": no discount, nothing recorded in the maths records, never counted as wrong.
- The migration is numbered `20261018001600`. Check the other worktrees' migrations when merging.

**Known limits, and things for James to decide**

- **The fight is played in the browser from a seed the server gives, and the engine is public, so a determined pupil could work out a winning list of actions in advance.** The server cannot see that. Forest losses are soft and a dragon try is once a day, so the gain is small, but it is real. The fix, if it ever matters, is to play each round on the server (more requests, about 3 per fight). My pick: leave it, and watch the teacher page in L.5.
- **A hero is not saved "mid-fight".** If the browser closes in the middle of a fight, the turn is already used, and next time the same fight is offered again from the start (this is the brief's rule). Anything won in the fight is only paid when it is finished. Decision for James: is that right, or should an abandoned fight be counted as a loss after a while? My pick: leave it.
- **Test tools in the live game for a teacher:** the server allows them for teachers but the screens only show them in the browser trial (my pick, as the brief asked). Say if James wants a teacher-only button in the live game.
- The server asks the database 3 or 4 times per request. The brief's budget (about 25 requests per pupil a day) still holds: roughly 2 requests per fight, plus shopping.
- Not done (L.5): points, achievements, the arena, computer heroes, the daily news and warriors list, the teacher page for the switch, the season dates and the refusals list (the tables and `teacher_set_lord()` are ready), and the one-hint-per-question button.

## L.5 results (18 Oct 2026): the arena, news, points and the teacher page, built and tested, NOT live

**Nothing is applied and nothing is deployed.** The new migration is `supabase/migrations/20261018001700_dragon_maths_l5.sql` (it follows the L.4 one, so both must go in, in order). `DRAGON_MATHS_ON` is still `false`. The steps to go live (L.4 and L.5 together) are in [prompts/lord-golive.md](prompts/lord-golive.md). The numbers and rules are in [LORD-RULES.md](LORD-RULES.md) ("The arena, the computer heroes, news and points").

**James's answers to the L.4 questions (asked 18 Oct):** an abandoned fight counts as a loss after a day (done); a teacher does not see the test tools in the live game (nothing to do: they stay in the browser trial); a pupil who plays twice a week should be able to reach the dragon (**not done, see the finding below**). The dragon's 10 points were not answered, so the pick stands (1 point per 3 forest wins, 3 for a master, 10 for the dragon).

**What was built**

- **Computer heroes** (`shared/lord/computer.ts`): eight named heroes, each a whole season played by the pace simulator (`sim.ts` now also keeps the hero at the end of every day), at a steady 2 to 7 days a week. Worked out from the season number, never stored, same every time. They level up by beating real masters. Marked "(computer hero)" in news lines and "computer hero" in the arena.
- **The arena** (`playDuel` in `engine.ts`, the `arena` action): 3 a day, an opponent within a level of yours (a classmate's saved copy from `lord_arena_candidates()`, or a computer hero), played by the server from a seed, stored finished in `lord_fights` (kind `arena`, the two heroes' numbers and the seed, so it can be played again; a test does). A win pays `round(0.5 × tierPower)` experience; losing costs nothing; the classmate's hero is never written to. Odd data for a classmate's hero is ignored.
- **Daily News** (`lord_news` table, read only through `lord_news()`): the server writes the village line and the computer heroes' deeds once a day (the first `load` of the day does it; `load_lord` says whether it's done), and lines about pupils when it accepts a master win, a dragon win, an arena win or a forest loss (`lord_commit` stores them in the same save). One line per kind per pupil per day. `{p}` is filled in with the hub name on reading. No student text can reach it (a test sends junk and checks).
- **Warriors list and Hall of Heroes** (`lord_warriors()`, `lord_hall()`, the `lord_hall` table): level, stars and dragons this season, hub names and avatars only. The Hall is written when the dragon is beaten, under that season's number, and kept for good.
- **Points and achievements** (`lord_scores`, `lord_point_rules()`, eight `dm-` achievements): the server counts forest wins, masters and dragons per request; the database turns them into points inside the shared 40-a-day limit (`scored_games` has a new `lord_score` link). The lifetime counts live in each hero's `extra.stats` and survive new runs, new seasons and class changes. `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students` and `teacher_new_season` were redone from Maths Monsters' latest versions with Dragon Maths added. A new points season clears Dragon Maths points only.
- **Seasons:** the last four days show "N days left" (the header and the village); the Hall is saved at the dragon win; a fight left alone for a whole day counts as a loss; **the holiday pause** is `teacher_set_lord()`: switching off notes the day, switching on moves the season start forward by the days it was closed (a start date typed in wins; a pause before the first season moves nothing).
- **Teacher page** (`src/pages/TeacherLord.tsx`, three lines in `Teacher.tsx`): the game switch (with the pause), forest fights a day, the first season date, a class view (season and days left, heroes at each level, hardest questions, requests turned down with real names, the Hall of Heroes) and a panel on each pupil (hero, lifetime counts, topics, their hardest questions, **reset this hero**, which keeps points, achievements and the Hall).
- **Dashboard card behind a switch:** `useLordEnabled()` hides the card until the teacher's switch is on, once `DRAGON_MATHS_ON` is turned on (it isn't). The how-points page explains the new points.

**What was checked**

- 101 handler tests (33 new for L.5: computer heroes, the duel, the arena, news, points and counts, fights left alone for a day, the countdown) with every old one still passing; the shared harness moved into `supabase/functions/lord/testKit.ts`. 213 tests in all across the Dragon Maths files.
- 119 new SQL tests (`lord_l5.test.sql`: closed tables and server-only functions, the news and its names, points step by step and the daily limit, achievements, the Hall, the arena's classmate list, Warriors, the pause, the teacher's views and reset, a new points season) plus every old suite (run in rolled-back transactions on the local copy: the migrations 1600 and 1700 and then each file). Two old tests were updated for the new rules (an `arena` fight is now allowed; 8 more achievements; the six new functions pupils or teachers can call).
- Website tests for the arena, the news (and "try again"), Warriors, the Hall, the countdown, the abandoned-fight note, the teacher page, the data layer and the dashboard switch.
- The pace was re-run with the arena in the simulator (see LORD-RULES).

**Finding: a pupil who plays twice a week still can't reach the dragon.** With the arena, a daily pupil reaches level 12 on day 16 (week 3), a 4-days-a-week pupil on day 25 (week 4) and a 2-days-a-week pupil gets to level 8. What stops them is the one master try a day: 10 play days is at most 10 tries, a master is beaten about 3 times in 4, and 11 masters are needed. A gentler curve alone can't fix it (a second master try a day plus 10 fights a level got them to level 9 and made a daily pupil reach the dragon in week 2). Options: (a) leave it, (b) a second master try a day after a loss plus a gentler curve (shorter game for everyone), (c) turns that pile up for missed days, up to a day or two (a casual pupil then gets 20 fights on a play day; a rule change from LORD). My pick: (c), then re-run the simulator. I did not change the pace without James.

**Where I differ from the brief, or chose**

- Arena opponents are within one level (or the three closest). The arena news line for a win over a classmate doesn't name the classmate ("Brave Kiwi won a fight in the arena!"), so nobody is named as a loser; wins over a computer hero name it.
- A forest loss does make a news line ("Quiet Tui was flattened by a Grumpy Troll"), as the brief's example does, once a pupil a day. It is one line in `shared/lord/news.ts` to remove if it embarrasses anyone.
- The village event of the day is a line only (often with a sum in it). "Market day: 10% off" would be a real rule; left for later.
- The Warriors list puts pupils who beat the dragon this season first, then by level, because beating the dragon sends you back to level 1.
- Pupils read the news, Warriors list and Hall through database functions called straight from the website (like the other games' boards), not through the `lord` function, so reading costs no function requests.
- Hidden profiles (teachers) leave no news lines, no Warriors place and are never an arena opponent.

**Known limits**

- A missing-factor times-table question also accepts the other factor (8 × ? = 72 takes 8 or 9). It comes from L.4's proof check, which can't tell which factor was hidden. The worst it does is a 10% discount for a wrong answer; fixing it means the question box sending which side was hidden. (It made one L.4 test fail now and then; the test now uses a wrong answer far from any right one.)
- The fight itself is still played in the browser from the server's seed (L.4's note); the arena is not, it is played entirely on the server.
- Switching the game off while pupils are mid-fight leaves those fights open; the "whole day" rule applies from the day it comes back on.

## Credits to carry over

- Game structure, rules and numbers adapted from *Legend of the Red Dragon* by Seth Able Robinson, as ported to TypeScript in *LORD.ts* by talisto (GPL-3; no code or text copied).
- Monster and item pictures from Kenney (CC0), if used.
