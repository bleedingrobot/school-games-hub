# School Games Hub

A games website for Year 4–6 students: maths games, classic games and basic facts training. Students sign in with their school Google account, build an avatar, and play against computer bots or each other.

**Live site:** https://bleedingrobot.github.io/school-games-hub/

**Where it's up to (20 Oct 2026):** it started as chess and checkers (Stages 1–8) and is now nine games, a basic facts training area and a shared maths system, all live. Students sign in with their Douglas Park Google account, pick a safe player name and build an avatar. Every game is checked by the server, saved, and turned into points, levels, badges and achievements, with leaderboards. Teachers have classes, a skill map and a maths focus, plus a switch and a panel for each game. The full plan and the stage list are in [docs/PLAN.md](docs/PLAN.md); each game has its own plan in `docs/`.

### The games

| Game | What it is | Maths | On the dashboard |
|---|---|---|---|
| [Chess](#chess-against-the-bots) | Against 3 bots or a friend | None | Always |
| [Checkers](#checkers-against-the-bots) | Against 3 bots or a friend | None | Always |
| [Wormholes & Black Holes](#wormholes--black-holes-the-space-game) | Space snakes and ladders, 2–4 players | Mission Control maths (teacher switch) | Always |
| [101](#101-the-card-game) | James's family card game, 2–4 players | None | Always |
| [Gem Keep](#gem-keep-the-tower-defence-game) | Tower defence powered by times tables | Follows the maths focus | Always |
| [Power Clash](#power-clash-tic-tac-toe-with-powers) | Noughts and crosses with powers | None | Always |
| [Maths Monsters](#maths-monsters-the-adventure-game) | Walk-around monster adventure | Every attack and catch | Only when the teacher switches it on |
| [Dragon Maths](#dragon-maths-the-daily-adventure) | Daily-turns village and forest adventure | At chosen moments | Only when the teacher switches it on |
| [Clan Quest](#clan-quest-the-clan-game) | Build a clan of four heroes and an empire | Battle Cry and quest questions | Only when the teacher switches it on |

Plus **[Facts training](#facts-training)**, a practice area outside the games. How the maths fits together is in [How the maths works](#how-the-maths-works).

**Built on other branches, not on `main` yet:** Bond Match (`bond-match`; its database change and server function are already live, but the game isn't on the site), Marble Rush (`marble`) and the last Dragon Maths stage, L.6, with teacher topic switches (`dragon-maths`). See "Not on main yet" in [docs/PLAN.md](docs/PLAN.md).

- **Running a lesson:** [docs/CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md) (the day before, a lesson plan, what error messages mean, the problem slip).
- **For the principal and board:** [docs/PRIVACY-SUMMARY.md](docs/PRIVACY-SUMMARY.md).
- **Looking after the site:** [Looking after the site](#looking-after-the-site) below.

## How sign-in stays school-only

Only accounts from a school on the list can get in. The list is the `school_domains` table (a school can have several email domains and must be switched on in `schools`); today it holds `douglaspark.school.nz`, school number 1. That's checked three times, all on the server:

1. Google's sign-in screen (the Google project is "Internal" to Douglas Park, so only its accounts get through; the website no longer names a domain to Google, because that was one school's).
2. Supabase refuses to create an account for any email whose domain isn't on an active school's list (a sign-up hook, plus a database backstop). The new profile is put in that school, and a player's school can never be changed.
3. Every read of the database re-checks the school: `my_school()` is in every row rule and every teacher function, so one school can't read another's students, games, lobbies, boards, records or settings. Students can only change their own name and avatar.

Inside a school, teachers see only the students in their own classes; a school admin sees the whole school; the site owner adds schools and sees no student data (see `docs/MATHS-FOCUS-PLAN.md`, "Stage F.2 results").

Profiles store a random ID, a word-list name (like "Speedy Otter 27") and avatar codes. No emails or real names. Supabase's own sign-in records do keep each student's Google email and name; only the server can see those. The teacher page shows teachers the part of each student's email before the @ (their real name), so they know who is who; students never see it.

**Making someone a teacher:** the first teacher is made by hand. Sign in to the website once, then in Supabase go to **SQL Editor** and run
`select public.make_first_teacher('your.email@douglaspark.school.nz');`
Make the first school admin (a teacher who sees the whole school, makes teachers, archives classes and starts a new season) and the site owner the same way:
`select public.make_school_admin('your.email@douglaspark.school.nz');` and `select public.make_site_owner('your.email@douglaspark.school.nz');`
After that, a school admin can make other staff teachers from the **Teacher** page (see below).

## Chess against the bots

Students pick a bot and a colour, then tap a piece and tap a dot to move. The board works with a mouse, a touchscreen or a keyboard (arrow keys and Enter). The rules come from [chess.js](https://github.com/jhlywa/chess.js), a well-tested chess library: check, checkmate, stalemate, castling, en passant, promotion (the student picks the piece) and all the draw rules.

| Bot | What it does |
|---|---|
| **Very Easy** | Picks any legal move, a bit more likely to grab a piece. Never thinks ahead. |
| **Easy** | Stockfish at its weakest setting, looking 3 moves ahead, plus a random move 1 time in 5. |
| **Medium** | Stockfish at skill 6 of 20, looking 8 moves ahead. Steady, but beatable with a plan. |

**Stockfish** is a free, open-source chess engine. It runs inside the student's browser (so it costs nothing), and its files are part of this website, in `public/stockfish/`. To make a bot easier or harder, change `BOT_SETTINGS` in [src/games/chess/bot.ts](src/games/chess/bot.ts). The bot waits about a second before moving so it feels natural.

## Checkers against the bots

This is English checkers (also called American checkers or draughts) on an 8×8 board. It's **not** international draughts, which has a bigger board and "flying" kings.

- Red goes first (the official rules call that side "Black"; on most boards those pieces are red). Each student plays from their own side, with their pieces at the bottom.
- Pieces move one square diagonally forwards. Reaching the far side makes a **king** (it gets a crown), which can also move backwards.
- **If you can jump, you must.** The pieces that can jump glow, and a note says why the others can't move. If a piece can keep jumping, it must, and the whole jump is one move. A piece crowned part-way through a jump stops there.
- Multi-jumps: tap the piece, then each landing square. If there's only one way to go, one tap does the whole jump.
- You win by capturing all the other side's pieces, or by blocking them so they can't move. After 40 moves each with no capture and no new king, it's a draw.
- The little numbers on the dark squares are the standard checkers square numbers (1–32). The move list uses them, e.g. "11 – 15", or "15 × 24" for a jump.

There's no well-tested library for English checkers, so we wrote the rules ourselves in [shared/checkers/rules.ts](shared/checkers/rules.ts), with thorough tests next to them.

The checkers bots are our own too. They "look ahead": try each move, then each reply, and so on, and pick the move that leads to the best position. They run in a Web Worker inside the student's browser, so they cost nothing and the page never freezes.

| Bot | What it does |
|---|---|
| **Very Easy** | Looks 1 move ahead, with lots of randomness. Often blunders. |
| **Easy** | Looks 3 moves ahead, with a little randomness. Spots simple jumps. |
| **Medium** | Looks 6 moves ahead (up to 8 when there's time) and always follows a jump to the end. |

To make a bot easier or harder, change `BOT_SETTINGS` in [src/games/checkers/bot.ts](src/games/checkers/bot.ts). The tests check each level beats the one below it.

### How results are saved (and why they can't be faked)

When a chess or checkers game ends, the website sends the list of moves to a small **server function** called `save-bot-game`. The server replays every move with the same rules (chess.js for chess, our checkers rules for checkers), decides who won by itself, and only then saves the game. It ignores what the browser *says* the result was. Students can see only their own games.

- Resigning counts as a loss.
- Leaving a game part-way through (closing the tab, going back home, or pressing New game) is saved as **unfinished**, and counts as a loss.
- Unfinished games, and games where the student made fewer than 10 moves, are saved but **earn nothing**.
- One honest limit: the bot runs in the browser, so a very determined student could fake *the bot's* moves. The server still checks every move is legal. That's why bot games earn only small, capped points and never count towards badges.

## Playing a friend

Students tap **Play a friend** on the dashboard (or **Lobby** at the top) and either:

- **Start a game:** pick chess or checkers and a colour (or "Surprise me"). They get a 5-character **game code**, like `KM4 TP`, to read out to a friend. Codes never use vowels or lookalike characters (no O/0, I/1/L, S/5, Z/2 or B/8), and typing them in lower case or with a space is fine. They can also choose **Anyone in the lobby**, which lists the game for everyone to see with just their player name and avatar.
- **Join a game:** type a friend's code, or tap **Join** next to a game in the lobby.

The game starts the moment someone joins. Then:

- Each move appears on the other screen within about a second (it took 0.3 seconds in testing).
- **Resign** asks "Are you sure?" first, and counts as a loss.
- **Offer a draw:** the other player taps Yes or No. Making a move instead also says no. Each player can offer at most 3 draws a game, with at least 5 of their own moves between offers. When they can't offer one, the button greys out and a note says why.
- **The 2-minute rule:** if it's your opponent's turn and they haven't moved for 2 minutes, a **Claim the win** button appears. The server's clock decides, not the device's. Walking away counts as a loss for the one who left.
- If the other player closes the page or loses Wi-Fi, their card says **away** after a few seconds.
- At the end, both players see the result. **Rematch** starts a new game with the colours swapped, once both players have pressed it.
- A waiting game is cancelled after 10 minutes if nobody joins (or straight away with **Cancel**). Each student can have one waiting game at a time.

**Coming back to a game:** reloading the page, closing the Chromebook lid or losing Wi-Fi doesn’t lose the game. If the Wi-Fi blips for a moment, the site quietly tries again once. Unfinished games are shown at the top of the dashboard and in the lobby, with a **Carry on** button. If nobody moves for 30 minutes, the game ends by itself as a loss for the player whose turn it was.

### Why students can't cheat

The website never changes a game itself. It only *asks* a server function called `multiplayer`, which checks the student's sign-in, that it's their game and their turn, that the move is legal (using the same rules code as the bot games), and that the game isn't over. The server alone decides checkmate, every draw rule and every checkers ending. If two requests arrive at the same moment (say, a double-tap), only one gets through. Students can only read the games they're playing in.

Games that were abandoned, or where either player made fewer than 10 moves, are saved but **earn nothing**. Games against friends and bot games are kept apart in the stats, and bot games never count towards badges.

### If games against friends misbehave in class

You can switch them off for everyone straight away: open the **Teacher** page and press **Pause games against friends**. The lobby then says "Your teacher has paused games against friends for now", and the server refuses new games and moves. Games already going can still be resigned. Bot games carry on as normal. Press **Switch games against friends back on** to undo it.

If you can't sign in for some reason, the same switch works from Supabase: **SQL Editor**, paste
`update public.app_settings set multiplayer_enabled = false where id;` and click **Run** (`true` switches it back on).

Other problems:

- **Moves seem slow or stuck:** the page checks for moves every few seconds even if live updates drop, and reloading is always safe. If several students see it at once, Supabase may be having a hiccup; check status.supabase.com.
- **"We couldn't find a game with that code":** the code may be mistyped, or the game may have already started, been cancelled or waited 10 minutes. Make a new one.
- **A student keeps leaving games:** each one is recorded as a loss for them, and earns nothing.

## Points, levels, badges and leaderboards

Students can read all of this on the **How points work** page (linked from the dashboard and the leaderboard). The numbers on that page come straight from the database, so it never disagrees with the scoring.

**How to explain it to a class:**

- Every game you finish earns points, **even if you lose**. Harder bots earn more, and playing a friend earns the most.
- Bots can earn you up to 40 points a day. Playing the same friend, your first 5 games together each day earn points.
- Every achievement earns 10 bonus points. Points take you up levels.
- Games only count if you each make at least 10 moves. Leaving early earns nothing.
- Your **badge** (Bronze, Silver, Gold, Champion) comes only from games against friends. Win and you take some of the other player's hidden score; beat someone better and you climb more.

| Points | Lose | Draw | Win |
|---|---|---|---|
| Very Easy bot | 1 | 2 | 3 |
| Easy bot | 2 | 3 | 5 |
| Medium bot | 3 | 5 | 8 |
| A friend | 4 | 6 | 8 |

**Levels:** level 2 at 50 points, level 3 at 125, level 4 at 225, and each level needs 25 more than the last.

**Ratings and badges:** each student has a hidden chess score and a hidden checkers score, starting at 1000. Only games against friends change them (an "Elo" rating: a win against an equal player is +10, and one game moves it by 20 at most). Badges: **Silver** at 1030 (about 3 more wins than losses against players at your level), **Gold** at 1080 (about 8 more), **Champion** at 1150 with at least 15 games against friends. Students never see the numbers, only the badge and how close they are to the next one.

**Achievements:** chess and checkers have 12 each: first game, first win, 10 and 50 games, beating each bot, beating a friend, reaching Silver, Gold and Champion, plus Checkmate! (chess) and Crown 5 kings (checkers).

**Leaderboards** (chess and checkers each): **This week** (points since Monday midnight, NZ time; needs 3 games), **All time** (by badge; needs 5 games against friends) and **Most improved** (the biggest climb this week; needs 3 games against friends). Students see the top 10 plus their own place. Boards show only player names, avatars and badges. Hidden students aren't on them.

The other games have their own points, achievements and boards (Gem Keep's most stars, Maths Monsters' most monsters collected, Dragon Maths' Warriors list, Clan Quest's fame Scoreboard). They're in each game's section below, and all of them on the **How points work** page. Only chess and checkers change ratings and badges.

**Why it can't be faked:** everything is worked out inside the database, the moment the server saves a game. The website can only read the results; it can't write points, ratings or badges, and it can't call the code that works them out.

## Wormholes & Black Holes (the space game)

A space snakes and ladders for 2–4 rockets: against 1–3 bots, with classmates, or pass-and-play (2–4 people taking turns on one Chromebook, never saved and no points). Race from Earth to the space station. Wormholes zoom you up, black holes pull you down, and stars give items that help you (or slow the others down). The full design, the simulation results and every decision are in [docs/SPACE-GAME-PLAN.md](docs/SPACE-GAME-PLAN.md).

- **Boards:** Inner Solar System (gentle), Nebula (medium, the default), Deep Space (wild), Asteroid Belt (a quick 50-square game), and **Random Galaxy**. A galaxy has a code like `Comet-Kiwi-48`, so a class can all type the same one in. **Galaxy of the day** is the same for everyone that day.
- **Modes:** **Cosmic** (everything) or **Classic** (just wormholes and black holes, no items and nothing to aim at other players). Use Classic for a gentler lesson.
- **How long:** about 4–8 minutes for a big board, 2–4 for Asteroid Belt. A fuel gauge ends any game that drags on (places then go by how far everyone got).
- **How to play** and the **Star chart** open from the settings, the game (button or the `?` key) and the waiting room. How to play has a picture and one line for every square and item, the fair-play rules and the keys. Landing on a star (or a wormhole, black hole, comet...) shows a short space fact, which is collected on the student's **Star chart**. The Star chart is kept on that device only, not in the database. The facts are in [shared/space/facts.ts](shared/space/facts.ts).
- **Cosmic events** (on by default on Deep Space, a setting elsewhere): every 5 rounds, solar wind, a meteor shower or a wormhole shift, with a banner and a line in the mission log.
- **Sound** is off until the student turns it on, like chess and checkers. **Less motion** turns hops into slides and stops things popping in (it's on automatically if the device asks for less motion).
- **Keyboard:** Space or Enter rolls, 1–3 use items or pick cards, 1–6 picks a Navigator roll, arrow keys move between buttons, Escape closes things. Every move is read out by screen readers through the mission log.

**Points:** taking part only. It's a dice game, so winning is mostly luck and never earns more than losing. A finished bot game earns **2** (inside the same 40-a-day bot limit as chess and checkers). A finished classmates game earns **4** (the first 6 a day). Games under 5 turns, and players who leave or go on autopilot, earn nothing. Space games **never** change ratings, badges or leaderboards. There are 9 space achievements (10 points each), three of them about Mission Control maths (below). Right answers themselves never earn points.

**Playing classmates:** one student taps **Play a friend → Start a game → Wormholes & Black Holes**, picks a board, and reads out the code. Up to 3 others join with it (or from the lobby). The host can fill empty seats with bots, then presses **Launch**. The server rolls every die. Each turn has 30 seconds (15 for a choice). A student who misses 3 turns in a row goes on **autopilot**, so the game carries on for everyone; they can **Take the controls** back, but that game no longer earns them points. At the end, **Rematch** starts a new waiting game with the same board.

**Mission Control maths** (the Teacher page switch, default *Students choose*): times-table questions inside the game. A question at a **wormhole** (right = powered up, a few squares further) and at a **black hole** (right = you fall half as far), and one **after every turn** on a side card (right = +1 on your next roll). A wrong answer never costs anything, and the other players only see good news. Questions come from the student's own times-table records (the same ones as Gem Keep, with the teacher's Gem Keep settings), and every answer goes back into those records. The teacher switch is school-wide: **Off** (no maths, and the server refuses any maths game), **Students choose** (a maths chip when they set up a game; in a classmates game the host decides for everyone) or **On for everyone** (the server makes every new game a maths game). Against bots the server replays the game and checks every answer before saving it; with classmates the server picks and marks every question itself, with a 20-second timer for wormhole and black hole questions. Three achievements: **Mission Control** (10 right answers), **Wormhole booster** (power up a wormhole) and **Great escape** (escape half a black hole). Design and numbers: [docs/SPACE-MATHS-PLAN.md](docs/SPACE-MATHS-PLAN.md).

**Teacher switches:** the **Pause games against friends** switch covers space games too. **Emoji reactions in space games** (on the Teacher page, off to start) lets students send one of 6 fixed emoji (🚀 👏 😮 🎉 😂 👍) over their rocket, at most one every 5 seconds and 20 a game. There's no text and no chat. Each student can hide reactions on their own screen with 🙈.

**Why it can't be faked:** bot games play in the browser from a dice "seed" the server stamps at the start. At the end the server replays the whole game from that seed before saving it. In classmates games the server rolls the dice and runs the rules, and the website only asks.

## 101 (the card game)

James's family card game, for 2–4 players: against 1–3 bots or with classmates. Everyone has 4 face-down cards and peeks at their bottom two once. On your turn, take a card from the stack or the discard pile and swap it in (it goes face up and stays) or throw it away; or knock when you think you're lowest. Pairs cancel, a 3 cancels your highest card, three of a kind makes the hand 0. Lowest total when someone reaches 101 wins. The rules are in [docs/101-RULES.md](docs/101-RULES.md); the design, simulation results and every decision are in [docs/101-PLAN.md](docs/101-PLAN.md).

- **Game length:** Normal (to 101, about 15–30 minutes) or **Quick** (to 50, about 8–15 minutes). Use Quick in lessons.
- **Bots:** Very Easy (forgets, knocks at random), Easy (remembers its own cards) and Medium (watches everyone, knocks only when it's very low). Bots are only ever given what their seat may see, so they can't peek.
- **The scoring show:** at the end of each round every hand turns over and the working is shown in words ("The 3 cancels the Queen: 10 → 0", "Hand: 4 + 0 = 4").
- **How to play** opens from the settings, the game (button or the `?` key) and the waiting room. Its examples are scored by the game's own scoring code.
- **Keyboard:** S stack, D discard pile, K knock, T throw away, arrow keys and Enter to swap, ? help, Escape closes things. Every move is read out through the game log.

**Points:** a bot game earns the **same as chess and checkers** (Very Easy 1/3, Easy 2/5, Medium 3/8 for lost/won; a shared lowest total is a win), inside the 40-a-day bot limit. A classmates game earns **8** for a win and **4** for finishing (the first 6 a day). Games of fewer than 2 full rounds, and players who leave or run out of time, earn nothing. 101 **never** changes ratings, badges or leaderboards. There are 8 achievements (10 points each).

**Playing classmates:** one student taps **Play a friend → Start a game → 101**, picks 2, 3 or 4 players and the length, and reads out the code. The others join with it (or from the lobby). The cards are dealt as soon as the table is full, or the host can start early with 2 or more. Each turn has 60 seconds (then it's skipped; 3 skips in a row and you're out), the peek 15 seconds, and the scores between rounds wait until everyone presses Next (or 30 seconds). At the end, **Rematch** starts a new waiting game. The **Pause games against friends** switch covers 101 too. No chat and no reactions.

**Hidden cards (why nobody can see anyone else's hand):** in a classmates game the whole game (the shuffled stack and every hand) is in a database table students can't read at all. Each player has their own small row holding only what they're allowed to know, and the database only lets them read their own. The server shuffles with secure randomness and referees every move. Bot games play in the browser from a seed the server stamps, and the server replays them before saving (like the space game); a student with developer tools could find the bots' cards, which is why bot games only earn small, capped points.

## Maths Monsters (the adventure game)

A walk-around adventure for one student at a time. Walk through Harbour Town and six New Zealand places (Kauri Bush, Shell Beach, Fire Mountain, Snowy Peaks, Glowworm Caves, Harbour City), find wild monsters in the long grass, battle trainers, catch monsters and win a badge from each place's Tower. **Every attack and every catch is a maths question**, and each of the six monster types asks its own topic: Leaf place value and rounding, Water adding and taking away, Fire times tables, Ice division, Spark fractions, Stone decimals and money. A wrong answer is a small hit and the right answer is shown. Nothing is lost for getting maths wrong, and losing a battle only sends you back to your last healing spot. The design and every decision are in [docs/MONSTER-PLAN.md](docs/MONSTER-PLAN.md), with a results section for each stage.

- **Switched off until the teacher turns it on** (Teacher page, **Maths Monsters**: the game switch, which topics are on, the class view of right answers and hardest questions, each student's panel, and a list of saves the server turned down). While it is off the card, leaderboard tab, achievements and point rules are hidden and the server refuses saves.
- **Saving:** the whole adventure is saved on the server, so it follows a student to any Chromebook. It saves at a new game, at the nurse, after a Tower battle, on a badge, every 3 minutes and when the page closes; if the internet drops it waits on the device and sends later. The server replays every battle with the real rules and checks every maths question, so levels and monsters can't be made up. A refused save leaves the last good save alone.
- **Points** (inside the 40-a-day cap, never ranked): 1 for every 3 wild battles won, 3 for a trainer, 8 for a Tower badge (first time only). Eight achievements. The leaderboard is "most monsters collected". A new season keeps the adventure and clears only the points.
- **How to play** is on the new-game screen and in the in-game **Menu**. It is written for 9-year-olds, and its numbers come from the game's own rules.
- **Keyboard and screen readers:** arrow keys or W A S D to walk, Space or Enter to talk, M or Esc for the Menu, 1-4 in battles. Everything except the map picture is normal HTML with names (the map picture has a description). Menus keep Tab inside them, pages that are only words can be scrolled with the keyboard, and the battle effects, door fade and white flash are switched off for people who ask their computer for less motion. **Calm** turns off the quick-answer bonus, **Choose answers** replaces the number pad with four buttons, and **On-screen arrows** are there for touch screens (tapping the map to walk works too).
- **Slow Chromebooks:** the map is drawn only when something changes. In a real browser with the processor slowed 6 times, walking stayed at 60 frames a second and a battle opened with no slow frames.
- **Making maps:** the maps are Tiled JSON in `shared/monsters/maps/`, made by `node scripts/make-monster-maps.mjs` (the steps are in `scripts/monster-maps/`). The map maker warns when a tree, bush or rock stands on a path, and a test checks that the files in the game are exactly what the map maker makes, so don't edit the JSON by hand without also changing the script. `npm run monsters:sim` plays whole battles to tune levelling; `npm run monsters:preview` builds a stand-alone test page.
- **Credits:** tiles from Kenney (CC0); battle flow and the catch and exp ideas adapted from *Monster Tamer* by Dev Share Academy (MIT).

## Gem Keep (the tower defence game)

A tower defence game for one student, where times tables power everything. Students answer facts to earn mana, forge and combine gems, and stop the waves. There are 10 levels on a campaign map, and a **Level Key** (a short round of facts) opens each new level. The questions follow the student's [maths focus](#how-the-maths-works). The plan is [docs/gem-keep/RECON.md](docs/gem-keep/RECON.md); what was built, phase by phase, is in [docs/gem-keep/PROGRESS.md](docs/gem-keep/PROGRESS.md).

- **Saving:** progress is saved on the server through the `gem-keep` function, so it follows the student to any device. With no Wi-Fi it keeps playing and saves later. The server can't replay a whole level, so it checks that each result is possible.
- **Points** (inside the 40-a-day bot limit): a win is 3, 4 or 5 (2 plus the stars), a loss after wave 3 is 1. Seven achievements. A "most stars" leaderboard, never maths accuracy. No ratings or badges.
- **Teacher page:** Gem Keep settings (Calm or Challenge, which tables, missing-number questions, division, multiple choice, the Level Key pass mark), the class's hardest facts, and a 12 × 12 grid for each student. A new season clears Gem Keep progress and records.
- **Still to do:** Phase 6 (polish and a classroom test).

## Power Clash (tic-tac-toe with powers)

Noughts and crosses with once-a-match powers: Body Swap, Freeze Ray, Board Wipe, Force Field, Portal Chaos, Wild Card and Time Heist (Double Trouble was taken out on 18 Oct 2026), plus a Chaos Mode with random events. Each player picks 3 powers. A match is best of five. Play it two-to-a-Chromebook, against Very Easy, Easy or Medium bots, or against a classmate with a game code. The plan and every stage's results are in [docs/POWER-CLASH-PLAN.md](docs/POWER-CLASH-PLAN.md).

- **Points:** taking part only. A finished bot game earns 2 (inside the 40-a-day bot limit); a finished classmates game earns 4 (the first 6 a day). Never ratings, badges or leaderboards.
- **Playing a classmate:** refereed by the `power-clash` server function. 60 seconds a turn; 3 missed turns in a row ends the game. The **Pause games against friends** switch covers it.
- **Still to do:** one real two-device game and the class trial.

## Dragon Maths (the daily adventure)

A *Legend of the Red Dragon*-style game: each day a hero gets 10 forest fights and 3 arena fights, visits the village (shop, healer, bank, inn), beats 12 masters to level up, and finally faces the dragon. Every hero starts again each 5-week season. Maths turns up at chosen moments (sizing up a monster, shop change, the healer's bill, riddles, the master and dragon trials), with no timer, and a wrong answer shows how to do it and the game goes on. LORD.ts is used as a rule book only: the code, writing and art are our own. The plan is [docs/LORD-PLAN.md](docs/LORD-PLAN.md) and the rules are in [docs/LORD-RULES.md](docs/LORD-RULES.md).

- **Switched off until the teacher turns it on** (the Dragon Maths panel on the Teacher page).
- **Saving:** on the server, through the `lord` function, which hands out each fight and checks it before it counts.
- **Points** (inside the 40-a-day limit): 1 for every 3 forest fights won, 3 for a master, 10 for the dragon. Arena fights and maths answers earn none. Eight achievements. A Warriors list for this season and a Hall of Heroes that's kept for good.
- **Still to do:** L.6 (How to play, hint button, accessibility, font) and teacher topic switches are built on the `dragon-maths` branch, not on `main` yet.

## Clan Quest (the clan game)

Each student builds a clan of four heroes, fights in the Mines (with a maths **Battle Cry** question before each round that can help), shops, trains, does one quest a day and builds a small empire. Clans belong to a class **village** that builds together, and can raid computer kingdoms (and classmates, if the teacher allows it). Everything is saved on the server through the `clans` function. The plan is [docs/CLANS-PLAN.md](docs/CLANS-PLAN.md), the rules are in [docs/CLANS-RULES.md](docs/CLANS-RULES.md), and a two-minute teacher guide is [docs/CLANS-TEACHER-GUIDE.md](docs/CLANS-TEACHER-GUIDE.md).

- **Switched off until the teacher turns it on** (the Clan Quest panel). Raids on classmates have their own switch, off to start.
- **The maths has its own settings**, not the maths focus: a year band (4, 5 or 6), which topics (times tables, percentages, money, area and perimeter, remainders, ratios, better buys, negative numbers) and how many mine fights a day. The questions are word-problem style, from `shared/maths/practical.ts`.
- **Points** (inside the 40-a-day limit): 1 for every 3 mine fights won, 3 for a boss, 2 for a Friendly War win, 5 for voting in a week the village builds something. Eight achievements. The in-game Scoreboard ranks clans by **fame**, never by maths. Not on the hub's leaderboards.

## Facts training

A practice area next to the games, not part of them (open it from the dashboard or `/#/training`). A student does a short daily session of times-table and division facts. Timing is hidden while they answer; afterwards a **facts map** colours each fact by how quickly *that child* knows it, after taking off how long they take just to type. There's no clock, no score and no ranking. A wrong answer shows the right one and the student types it in. The plan is [docs/TRAINING-PLAN.md](docs/TRAINING-PLAN.md).

- **Kept apart from the games (James, 18 Oct 2026):** training keeps its own records (the `training` function and its own tables) and its own list of facts (`shared/training/facts.ts`). Training answers don't change what the games ask, and game answers don't change training.
- **Built and live:** T.1 (sessions, the typing check, Fix-it moments, the summary) and T.2 (the facts map, the "this week" line, saving). **Not built yet:** T.3 onwards (strategy lessons, early facts, Quick-fire 20, fractions, the teacher view and more). The on/off switch is `src/training/switch.ts`.

## How the maths works

The maths games share one maths system in `shared/maths/`. The full plan is [docs/MATHS-FOCUS-PLAN.md](docs/MATHS-FOCUS-PLAN.md).

- **The ladder** (`shared/maths/ladder.ts`): one ordered list of skills, easiest first. It goes from early facts (bonds to 10, doubles), through times tables and division, place value and rounding, order of operations, to fractions, decimals and percentages. Each skill is tagged with the NZC teaching-sequence step it matches. To change the order, move a line.
- **Skill packs** (`shared/maths/skillPacks/`): one per topic. They make every question and mark it in code (never AI), so the server can rebuild and check any answer.
- **Choosing questions** (`shared/maths/selector.ts`): about 60% from what the student is working on, 30% review (weak facts more often) and 10% stretch. A fact answered wrongly comes back 3–6 questions later. Mastery records use Leitner boxes (`leitner.ts`).
- **The question box** (`src/maths/QuestionModal.tsx`): the same pop-up in every game. A right answer gives a sparkle; a wrong one shows the whole fact, with nothing taken away.
- **Maths focus:** a teacher can set what the maths asks for a class, a group or one student, for a set time ("×6 until Friday", on the **Maths focus** page). When that time ends it goes back to the student's own choice or to **auto**, which walks them up the ladder. A short warm-up (`/#/placement`) finds where a new student starts.
- **Which games use what:**

| | Ladder and maths focus | Skill packs and question box | Its own maths settings |
|---|---|---|---|
| Gem Keep, Wormholes & Black Holes | ✅ | ✅ | Gem Keep and space maths switches |
| Maths Monsters | | ✅ (each monster type asks its own topic) | Teacher picks which topics are on |
| Dragon Maths | | ✅ (each moment asks its own topics) | All topics on for now (teacher topic switches are on the `dragon-maths` branch) |
| Clan Quest | | Uses `shared/maths/practical.ts` | Year band, topics, fights a day |
| Facts training | | | Its own facts list and records |

- **Records:** Gem Keep, the space game, Maths Monsters, Dragon Maths and Clan Quest all send their answers to the database through `record_fact_answers`, by the same rules as `leitner.ts` (each game's server function checks the answers first). Teachers see them on the **Skill map** page (one row per student, one column per ladder stage). Facts training keeps its own records.

### Classes and schools

Students belong to a **class**; a class has one or more teachers and belongs to a **school** (Douglas Park is school 1). Teachers make classes and groups on **My classes**. Each class and group has a **warp code**: a student types it to join. Game switches and settings are kept per class. A teacher sees only their own classes; a school admin sees the whole school. Opening the hub to a second school (F.8 Part B) isn't built yet.

## The teacher view

Teachers see a **Teacher** link in the top bar (students don't, and the database refuses them even if they type the address). It has:

- **Games against friends:** pause them for everyone (chess, checkers, space games, 101 and Power Clash), or switch them back on.
- **Emoji reactions in space games:** off to start (see the space game section).
- **Mission Control maths in space games:** Off / Students choose (the start) / On for everyone (see the space game section).
- **Players:** everyone with an account, with their player name, avatar, games played and when they last played. Type in **Find a player** to search. Tap someone to see their games against bots and friends, how many they left early, their badges and their last 10 games. Then:
  - **New name:** gives them a new random name (for a name that's being used to tease). They can pick their own again.
  - **Hide / Show again:** a hidden student is left off leaderboards and the lobby, and can't play friends. Their bot games still work.
  - **Make teacher / Remove teacher:** for other staff. You can't change your own role, so there's always at least one teacher.
  - **Delete:** removes the student's account and all their games, points and achievements. You type their player name to confirm. It can't be undone. Friends they played keep those games, without their name. If they sign in again, they start fresh. Teachers can't be deleted (remove their teacher role first).
- **A panel for each newer game:** Gem Keep, Maths Monsters, Dragon Maths and Clan Quest each have their own switch and settings (see each game's section above). Switches and settings are per class: a teacher's change applies to every class they teach.
- **End of year: start a new season:** see below.

The maths pages are linked at the top of the Teacher page: **My classes** (classes, groups, warp codes, co-teachers), **Maths focus** (what the games ask) and **Skill map** (where each student is on the ladder) (see [How the maths works](#how-the-maths-works)).

Teachers can see students' games and stats only through these screens; the database gives them nothing else.

### End-of-year cleanup (new season)

At the start of a new school year, on the Teacher page, type `NEW SEASON` (in capitals) and press **Start a new season**. It:

- **deletes** every finished game, and every point, level, badge, achievement and leaderboard place, so everyone starts fresh;
- **keeps** every account, player name and avatar, the teachers, who is hidden, the friend-games switch, and any games still being played.

It can't be undone. Delete students who have left the school first, one by one. It also frees space in the free database.

## Running it on your computer

You need **Node.js** version 22 or newer. Check by typing `node -v` in a terminal. If it's missing, get the "LTS" version from nodejs.org.

In VS Code, open the project folder, then open a terminal (**Terminal → New Terminal**) and type:

```bash
npm install
```

You only need this the first time, or after the project's packages change. Then:

```bash
npm run dev
```

It prints a link like `http://localhost:5173/`. Ctrl-click it to open the site. Changes you save show up straight away. Press **Ctrl+C** in the terminal to stop it.

## Checking it works

The tests come in two groups: **logic** (the game rules, the maths and the server functions, in `shared/`, `supabase/functions/` and `scripts/`) and **screens** (the website, in `src/`). A few files that play many whole games are marked slow in `vitest.slow.ts`.

**While you work** (quick, pick what fits the change):

| Command | What it does |
|---|---|
| `npm run test:watch` | Keeps running, and re-runs the tests for each file you save |
| `npm run test:changed` | Runs only the tests affected by what you have changed and not yet committed (`npm run test:changed -- main` for everything since `main`) |
| `npm run test:logic` | Just the rules, maths and server functions (about a minute) |
| `npx vitest run src/games/clans` | Just the tests in one folder (or one file) |
| `npm test` | Every test except the slow files |

**Before you push or merge** (the full set):

| Command | What it does |
|---|---|
| `npm run check` | Type check, **every** test (slow ones too) and the build: exactly what the publish runs |
| `npm run check:quick` | Type check and `npm test`, for in between |
| `npm run test:all` | Every test, slow ones too |
| `npm run test:db` | Tests the database rules (needs the local Supabase copy, see below) |
| `npm run typecheck` / `npm run build` | The type check, or the build into `dist`, on their own |
| `npm run build:functions` | Rebuilds the server functions after you change them (see below) |

Run `npm run check` before pushing. If it says everything passed, the publish will work too. The publish runs the full set every time, so a skipped check on your computer can't reach the live site.

### Testing the database rules on your computer

This needs **Docker Desktop** installed and running. Then:

```bash
npx supabase start     # first time downloads a lot; later it's quick
npm run test:db
npx supabase stop      # when you're done
```

## How publishing works

Every time you push to the `main` branch on GitHub, GitHub automatically:

1. runs the type check, tests and build,
2. and, if they all pass, puts the new version on the live site.

It takes about 1–2 minutes. To watch it, open the repo on GitHub and click the **Actions** tab. A green tick means it's live. A red cross means something failed: nothing was published, and the old version stays up. Click the red run to see what went wrong.

### One-time setup (already done, here for reference)

On GitHub, open the repo, then go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. There's nothing else to set.

## Where things are

```
src/              the website
  pages/          one file per page (Dashboard, Lobby, Leaderboard...)
  components/     building blocks used on many pages (buttons, cards, avatar)
  games/          one folder per game, plus registry.ts which lists them
  styles.css      colours, sizes and layout
  auth/           sign-in and keeping pages private
  avatar/         avatar parts and drawing
  data/           talking to the database
  multiplayer/    the shared screen for games against friends, and keeping them up to date
  games/chess/    the chess board, the bots, and the Stockfish connection
  games/checkers/ the checkers board and our own checkers bots
  games/space/    Wormholes & Black Holes: board, screens, How to play, Star chart, bot worker
  space/          keeping a space game with classmates up to date
  games/card101/  101: the table, cards, scoring show, How to play, bot and classmates screens
  card101/        keeping a 101 game with classmates up to date (your own seat only)
  games/monsters/ Maths Monsters: the map and walking, battle screen, monster pictures, menus, How to play
  games/gem-keep/ Gem Keep: the drawing engine, game screen, campaign map and maths rounds
  games/power-clash/ Power Clash: board, power picker, effects, bot and classmates screens, Guide
  power-clash/    keeping a Power Clash game with classmates up to date
  games/lord/     Dragon Maths: the village, forest, arena and news screens
  games/clans/    Clan Quest: clan, Mines, market, empire, village and quest screens
  maths/          the shared question box, number pad, ladder path and maths focus screens
  training/       Facts training: sessions, facts map, summary
  teacher/        the teacher's class panel
public/stockfish/ the Stockfish chess engine files and their licence
shared/           game rules shared with the server (chess and checkers rules, deciding results, refereeing friend games)
  maths/          the maths ladder, skill packs, question picker, mastery records and maths focus (see "How the maths works")
  space/          the space game's rules engine, boards, bots, galaxy codes, space facts and simulation
  card101/        101's rules engine, scoring, what each player may see, bots, saving, timers and simulation
  monsters/       Maths Monsters: monsters and attacks, battle rules, the maps and walking rules, and the check the server runs on a save
  gem-keep/       Gem Keep: levels, towers and gems, saving checks
  power-clash/    Power Clash: rules engine, powers, bots, match and classmates rules
  lord/           Dragon Maths: rules, monsters, masters, maths moments, the server's checks
  clans/          Clan Quest: game data, fights, quests, empire, Battle Cry maths
  training/       Facts training: the facts list, sessions, speed colours, saving
supabase/         database setup (migrations), its tests, the ten server functions, local settings
scripts/          builds the server functions into single files; game simulations; the Maths Monsters map maker
preview/          stand-alone test pages for single games (built with the `*:preview` npm scripts)
docs/             the main plan, a plan for each game, the original brief and the prompts used to build each stage (docs/prompts/)
.github/workflows the automatic test-and-publish steps
```

**Adding a game later:** make a new folder in `src/games/` and its rules in `shared/<game>/`, then add one line to `src/games/registry.ts`. It then gets its own card on the dashboard and its own page. For a game without maths, `card101/` is the closest example; for a maths game, copy how `gem-keep/` gets its questions from `shared/maths/` and shows them with `src/maths/QuestionModal.tsx`.

## Server functions (Supabase Edge Functions)

Server functions live in `supabase/functions/`. Each one has a `handler.ts` (the logic, with tests) and an `index.ts`, which is **generated**: it's the single file that gets deployed. After changing a handler, or the rules in `shared/`, run `npm run build:functions`. A test fails if you forget.

To update a function on the live site without the Supabase CLI:

1. On GitHub, open `supabase/functions/<name>/index.ts` and click **Copy raw file**.
2. In Supabase, go to **Edge Functions**, open the function, click **Code**, select everything, paste, then click **Deploy**.

There are ten functions: `save-bot-game` (saves bot games: chess, checkers, space, 101 and Power Clash), `multiplayer` (referees chess and checkers between students), `space-game` (runs Wormholes & Black Holes with classmates), `card-game` (runs 101 with classmates), `power-clash` (runs Power Clash with classmates), `gem-keep` (saves Gem Keep levels, Level Keys and times-table records), `monster` (checks and saves Maths Monsters), `lord` (runs and saves Dragon Maths), `clans` (runs and saves Clan Quest) and `training` (saves Facts training). `_shared/` holds code they all use. Every function must have **Verify JWT** switched **off** (under the function's **Details**). That's safe: each function checks the student's sign-in itself.

## Looking after the site

This part is for whoever looks after the site, including someone who isn't James.

### Where the accounts live, and who owns them

| Account | What it holds | Who owns it |
|---|---|---|
| **GitHub** `bleedingrobot` | The code (public repo `school-games-hub`) and the website (GitHub Pages) | James |
| **Supabase** organisation "Douglas Park Games", project `zqzhetlzvtptnkmeiumi` (Sydney, free plan) | The database, sign-in and the ten server functions | James (logs in to supabase.com with the GitHub account above) |
| **Google Cloud** project "School Games Hub", inside the douglaspark.school.nz organisation | The Google sign-in button (an "Internal" app). Its client secret is stored only in Supabase | James's school Google account |

No account has a credit card, so none of them can send a bill. **Give a second person access** so the site doesn't depend on one login: on GitHub (repo **Settings → Collaborators**), in Supabase (**Organization settings → Team → Invite**) and in Google Cloud (**IAM → Grant access**). Turn on two-step sign-in for all of these accounts.

### After the holidays: waking the site

The free Supabase plan **pauses a project after a week with nobody using it**. If the site says sign-in isn't working, or *"We couldn't load your profile"*, after a break: log in at supabase.com, open the project and click **Restore project**. It takes a few minutes and nothing is lost. Do this the day before a lesson ([CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md)).

### How a change gets published, and how to undo a bad one

- Every push to `main` on GitHub runs the checks and, if they pass, publishes the website in 1–2 minutes (see [How publishing works](#how-publishing-works)). If a check fails, nothing is published and the old version stays up.
- **To undo a bad website change quickly:** on GitHub, open **Actions**, click the last run *before* the bad one, then **Re-run all jobs**. That republishes the older version. (The next push publishes the newest code again, so fix or undo the code too.)
- **To undo it in the code:** in VS Code's terminal, `git revert HEAD` (undoes the latest commit), then `git push`.
- The website, the server functions and the database are published **separately**. Undoing a website change doesn't undo a function or database change.

### Updating a server function

After changing `supabase/functions/<name>/handler.ts` or the rules in `shared/`, run `npm run build:functions`, then `npm run check`. Then deploy it:

```bash
npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api
```

Or, without the command line: on GitHub open `supabase/functions/<name>/index.ts`, click **Copy raw file**, then in Supabase go to **Edge Functions → <name> → Code**, select everything, paste and click **Deploy**. Keep **Verify JWT** switched **off** for every function (each function checks the sign-in itself). To undo, deploy the previous version of `index.ts` the same way (GitHub's **History** button on the file shows older versions).

### Changing the database

Database changes are files in `supabase/migrations/`. Test them locally first (`npx supabase db reset`, then `npm run test:db`). Then apply the new file to the live project, either by pasting it into Supabase's **SQL Editor** and clicking **Run**, or with

```bash
npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>.sql
```

Then add its number to the `migration repair` note at the bottom of [docs/PLAN.md](docs/PLAN.md), so a later `supabase db push` doesn't apply it twice. There's no "undo" for a database change: write a new migration that puts things back. Never run anything that deletes data on the live project without a check first.

### Start of the school year

1. **Delete students who have left:** **Teacher** page → find them → **Delete** (type their player name). Do this first.
2. **Start a new season:** type `NEW SEASON` on the Teacher page and press **Start a new season**. It clears every finished game, point, rating and achievement. Accounts, names, avatars and teachers stay.
3. **New students** just sign in: their account is made the first time, with a random safe name.
4. **A new teacher:** they sign in once, then an existing teacher finds them on the Teacher page and presses **Make teacher**. If there's no teacher left at all, use `make_first_teacher` (see [How sign-in stays school-only](#how-sign-in-stays-school-only)).
5. Wake the site and do the "day before" checks in [CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md).

### If Supabase or Google changes something

- **Supabase keys.** The website uses only the public *publishable* key, in `src/config.ts`. If Supabase replaces it (**Project Settings → API Keys**), put the new one there and push. The server functions get the secret key from Supabase automatically. Never put a secret key in the code.
- **Free plan limits.** Check supabase.com/pricing once a year and update the numbers in [docs/PLAN.md](docs/PLAN.md). A class uses a small part of them (see PLAN.md, "Stage 8: classroom load"). If a limit is passed, Supabase emails the account owner and allows a grace period, then may slow or stop the project until the next month. It can't bill without a card. **Organization → Usage** in Supabase shows how much has been used.
- **The sign-in limit.** Supabase allows about 150 sign-ins and session refreshes every 5 minutes from one internet address. The school shares one address. If whole-class sign-in errors happen, raise **Authentication → Rate Limits → Token refreshes** (e.g. to 600).
- **The Google sign-in screen.** If Google asks for the app to be verified, or students see *access_not_configured*, check in Google Cloud that **Google Auth Platform → Audience** still says **Internal**. Internal apps for your own school don't need Google's verification. The school's Google admin can also allow it under **Security → API controls → Manage third-party app access**, using the Client ID in PLAN.md.
- **Supabase's sign-in settings** (not stored in the code; check them if sign-in behaves oddly): **Authentication → Sign In / Providers**: Google on, Email off. **Authentication → URL Configuration**: Site URL `https://bleedingrobot.github.io/school-games-hub/`. **Authentication → Auth Hooks**: *Before User Created* on, pointing at `public.hook_before_user_created`.
- **If Supabase or GitHub ever stopped being free:** the code doesn't depend on anything special. The website can move to any static host, and the database to another Supabase project (paid or free) by running the migrations in order.

## Licences

- **Stockfish** (the chess engine) is GPL version 3. Its licence and a link to its source code sit next to it in [public/stockfish/](public/stockfish/NOTICE.md). Keep them there if Stockfish is updated.
- **chess.js** is BSD-2-Clause. The checkers rules and bots are our own code. **Chess piece pictures** are Colin M.L. Burnett's "cburnett" set, GPL ([notice](src/games/chess/pieces/NOTICE.md)).

## Privacy and safety

The one-page version for the school is [docs/PRIVACY-SUMMARY.md](docs/PRIVACY-SUMMARY.md). In short:

- No tracking, analytics, ads or outside fonts. Everything the site loads comes from this repo.
- The browser saves the sign-in session and whether sound is on (sound starts off). Signing out clears the session.
- Names come from word lists, avatars from a fixed set of parts. There's no free typing and no photo uploads.
- Each saved bot game stores the student's random ID, the bot level, the moves, the result and the time. Nothing else. Deleting a student deletes their bot games.
- Points, ratings and achievements store only the student's random ID, the game, the result and the numbers. Leaderboards show only player names, avatars and badges, never emails, IDs, real names or classes.
- Each game against a friend stores the two players' random IDs, the game code, the moves, the result and the times. Each player sees the other's player name and avatar, nothing more. There's no chat. If a student is deleted, their opponents keep the game in their history, but nothing in it points back to the deleted student.
- The chess and checkers bots run on the student's own device. Nothing about their games goes anywhere except our Supabase database.
- Supabase's own sign-in records keep each student's school email, Google name, Google photo link and account number, last sign-in, and each signed-in device's internet address and browser type. Its request logs (internet address, rough location, browser) are kept for 1 day. Deleting a student removes their sign-in record.
- The code is public, so **no passwords or secret keys ever go in it**. Only Supabase's public "publishable" key goes in the website (in `src/config.ts`). It's safe to share because the database rules do the protecting.
