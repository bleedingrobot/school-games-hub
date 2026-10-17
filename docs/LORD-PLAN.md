# Dragon maths adventure (LORD-style): plan

A daily-turns fantasy adventure for the hub, in the spirit of the 1990s BBS door game *Legend of the Red Dragon* (LORD). Visit a small village from a menu, go into the forest a few times a day, fight monsters, buy a better sword, beat your master to level up, and one day face the Red Dragon. **Maths is one of the tools that helps you win**: sizing up a monster, working out the healer's bill, counting change at the shop, cracking a riddle, a master's trial and the dragon fight.

Written 17 October 2026 from James's brief ([prompts/lord-maths.md](prompts/lord-maths.md)) after reading [talisto/LORD.ts](https://github.com/talisto/LORD.ts) (v1.4.6) and the hub's code on `main` and `monsters`.
**Status: NOT STARTED.** James answers section 14 first.

## The short version

- **LORD.ts is our rule book, not our code base** (the brief's "Path C"). It is GPL-3 code that needs its own always-on Node server with WebSockets and SQLite, and much of the original game is for grown-ups (the barmaid, marriage, children, drinking, gory death lines). The hub is a GitHub Pages site plus Supabase with no always-on server. So we write our own small engine in TypeScript, using LORD's *shape and numbers* (daily turns, 12 levels, masters, the damage formula, the healer's price per HP...), with fresh, kid-friendly writing and our own art. Section 1.
- **It keeps what makes LORD special:** a limited number of forest fights each day, a menu village, cheeky random events, slow-burn progress over weeks, a daily news page, and the dragon at the end.
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

**What we take from it (rules and numbers, rewritten in our code, credited):**

| LORD rule | LORD's number | Ours |
|---|---|---|
| Forest fights a day | 15 | 10 (question 2) |
| Arena (player) fights a day | 3 | 3 |
| Levels | 12, then the dragon | Same |
| Monsters | 11 per level, mostly your level, sometimes weaker (1 in 6) | Same, our own monsters |
| Damage | random half of strength + half of strength, minus the defender's defence | Same |
| Masters | 11 masters; you need enough exp to challenge one, beating them raises a level and gives strength and HP | Same, our own masters |
| Exp needed per level | 100, 400, 1,000, 4,000, 10,000... 10,000,000 | Same shape, rescaled (section 7) |
| Healer | 5 gold × your level per HP | Same, and it's a maths moment |
| Losing a fight | lose all gold you carry and 10% exp, dead until tomorrow | Softer (question 3) |
| Bank | gold in the bank is safe when you lose | Same (the reason to bank) |
| Forest events | about 1 in 5 forest turns is an event instead of a fight | Same, our own events |
| Classes | Death Knight, Mystic, Thief, each with skill uses per day | Knight, Mage, Trickster (section 4) |
| The dragon | very strong; killing it starts you over at level 1, stronger and famous | Same |

## 2. How it fits with Maths Monsters

Both are battle adventures with maths, so they need to feel different:

| | Maths Monsters | Dragon maths |
|---|---|---|
| Feel | Collect a team, walk a world | One hero, a menu village, daily turns |
| Maths | A question on every attack | Questions at chosen moments; plenty of fights have none |
| Pace | Play as much as you like | A few minutes a day, come back tomorrow |
| Social | Collection leaderboard | Rival heroes, arena, daily news |

They share the maths engine, the question box, answer records and the teacher's topic switches. That's why this should come **after Maths Monsters N.6** (question 8): its maths packs and saving pieces are on the `monsters` branch, not on `main` yet.

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
- **Pick a class** (can't change until you beat the dragon):
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

**A forest turn** is a fight (4 in 5) or an event (1 in 5), as in LORD.

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
- The **ratios stay LORD's**, so the pace of the game should feel the same. A simulator (like the Maths Monsters one) checks it: how many days to each level, how often a student loses, how long until the dragon.
- **The target: the dragon after about 5-8 weeks** of playing most school days. Long enough to be a goal, short enough to finish in a term.

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
- A long fight in **three stages**. Before each stage, one question from a different topic. Right answers give a shield or a heavy hit for that stage. The dragon can still be beaten with great gear and no right answers, and lost with every answer right. It's a fight, not a test.
- **Beating it:** a big news story, the Hall of Heroes, points and an achievement. Then, as in LORD, your hero starts again at level 1 with a dragon-kill star, keeping your class skill. A second run is faster.

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
- **New season:** keep heroes, reset points (question 9).
- **Teacher page:** game on/off; topics on/off (shared with Maths Monsters); forest fights a day; Practice Mode; each student's topics using Gem Keep's "hardest facts" panel; reset a student's hero. A CSV export can come later.
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

## 14. Questions for James

| # | Question | My pick |
|---|---|---|
| 1 | **Name.** "Legend of the Red Dragon" belongs to someone else. Something of our own? | e.g. **Dragon Maths** or **The Red Dragon of Kauri Village** |
| 2 | **Forest fights a day** | **10** (LORD has 15; 10 is about 5-10 minutes) |
| 3 | **Losing a forest fight** | **Soft:** lose the gold you're carrying (banked gold is safe), keep your exp, wake at the healer, can still keep fighting. LORD's way: lose gold and 10% exp, out until tomorrow |
| 4 | **Arena opponents** | **Classmates' heroes and computer heroes**, losing costs nothing |
| 5 | **Gambling games at the inn** (LORD's dice and blackjack) | **Leave them out**, use the number-guess game instead |
| 6 | **Practice Mode** | **Little gold, no exp** |
| 7 | **Look** | **Dark BBS style** (rather than the hub's usual look) |
| 8 | **When** | **After Maths Monsters N.6**, which this needs |
| 9 | **New season** | **Keep heroes, reset points** (like Maths Monsters) |

## Credits to carry over

- Game structure, rules and numbers adapted from *Legend of the Red Dragon* by Seth Able Robinson, as ported to TypeScript in *LORD.ts* by talisto (GPL-3; no code or text copied).
- Monster and item pictures from Kenney (CC0), if used.
