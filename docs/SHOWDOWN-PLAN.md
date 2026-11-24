# Class Showdown: plan

**Status: Stage 1 (rules and simulator) and Stage 2 (server, tables, live updates, join pop-up, `?pretend=30` test page) merged 23 Nov 2026; the code switch is off, so no pupil or teacher sees it. Stage 3 (the real projector and controller screens, sounds and announcer) merged 23 Nov 2026, with the River Titan painted. Stage 4 (2 teams, 4 teams, solo, team picker, the real pages) merged 23 Nov 2026. Stage 5 (rewards, achievements, the 4-boss roster, "Again?") merged 24 Nov 2026 and **on for every class**. Stage 6 (Gold Rush, the second arena, every mode) merged 24 Nov 2026. Stage 7 (more arenas, one PR each, prompt in `docs/prompts/showdown-s7.md`) under way: Sky Climb merged 24 Nov 2026 (#783); Shrinking Island merged (#785); King of the Hill and Auction House built, with more narration.** James liked the "live class boss" idea from the list of missing game types (23 Nov 2026) and asked for one game where everyone in the room plays at once: the whole class against a boss, 2 teams, 4 teams, or everyone for themselves. Working name **Class Showdown**, game id `showdown`. Next free migration number when written: `20261123000900` on 23 Nov (check again: `node scripts/migration-numbers.mjs`).

**Class Showdown** is a live game for the whole room. The **teacher's screen goes on the projector** and shows the big painted battle, the scores and the drama, with all the sound. **Every pupil's iPad is their controller**: their own maths question at their own level, their choices, and their own score. A round lasts 5, 10 or 15 minutes. The teacher picks **how** the class plays (the mode) and **what** they play (the arena).

## The short version

- **Two screens, two jobs.** The projector is the show: painted scene, hits flying, team bars, countdowns, big events, all the sound, and the recap. It never shows a question, so nobody copies off the big screen. The iPad is the controller: one question at a time, big answer buttons, choices (role, team power, where to dig, a bid), and a little personal feedback. iPads stay silent.
- **Four modes, one game.** The same arena works as **Whole class vs the boss**, **2 teams**, **4 teams** or **Everyone for themselves**. Only the scoring and the projector's scoreboard change.
- **Arenas, added one by one.** Start with **Boss Bounty** (a giant painted boss, works in every mode). Then **Gold Rush** (a map of gold seams). Later: **Sky Climb**, **Shrinking Island**, **King of the Hill** and **Auction House** (section 4).
- **Fair for every child.** Every pupil gets questions from **their own maths focus and ladder place** (way A, made and marked on the server), so a pupil working on bonds to 10 hits as hard as one on percentages. **No speed bonus** (same rule as Dragon Maths): each pupil can land one answer every few seconds, so the fastest typist can't carry the room. Teams are mixed by ladder place.
- **Nobody is knocked out.** Fall, get hit or lose your spot and you keep playing, just a bit slower for a moment. Everybody plays the whole round.
- **Lots of winners.** The recap gives 6 to 8 shout-outs (winner, best comeback, longest streak, most careful, best healer, last hit...), so lots of kids get a moment on the projector.
- **Built on what we have.** Live play copies the Realtime pattern from Dragon Maths' arena and Clan Duels; the "Showdown is starting, join!" pop-up rides on the hub's challenge pop-ups (`src/data/hubAsks.ts`); maths copies Marble Rush (way A); full window from the start.
- **Art-first and flashy from stage 1.** Painted bosses with phases, team banners, hit effects, screen shake, a booming announcer voice (Kokoro on the gaming PC) and a painted recap (section 7).

## Decisions (question cards for James, with my recommendations)

| Question | Recommendation | James chose |
|---|---|---|
| Name | **Class Showdown** (others: Boss Rush, Titan Day, Clash of the Class) | Class Showdown |
| Who starts a round | **Only the teacher**, from their screen. Pupils can't start one themselves | only the teacher |
| How pupils join | A pop-up on every pupil's screen, anywhere in the hub: "Class Showdown is starting! Join". One tap. No codes (they're already signed in to the class) | pop-up anywhere |
| First arena | **Boss Bounty** (works in all four modes, great projector picture) | Boss Bounty |
| Round length | teacher picks **5, 10 or 15 minutes** (default 10) | teacher picks 5, 10 or 15 |
| Names on the projector | **First names** on hits and the leaderboard; a teacher switch to hide names (shows avatars only) | first names + hide switch |
| Answer pace | **one marked answer every 4 seconds per pupil** at most (a ring fills on the iPad); same hit for every correct answer | one every 4 seconds |
| Wrong answers | shows the right answer with the reason (QuestionModal's show-why), a 2-second wait, no damage taken, no points lost | show answer, 2-second wait |
| Rewards | **hub points like any maths game**, plus a small "Showdown chest" of gold or gems to the pupil's own favourite game. Every round pays | hub points + Showdown chest, **no daily cap** (every round pays) |
| Daily limit | **none for the teacher**; rewards cap after 2 rounds, play stays unlimited | none (and no reward cap) |
| Boss roster | **4 bosses** to start, each with 3 painted phases: the **River Titan** (Riverstone), the **Storm Kraken**, the **Clockwork Colossus**, the **Comet Wyrm**. Our own creatures, painted new | the 4 recommended |
| Teams | **auto-mixed by ladder place**, teacher can drag a pupil to another team or reshuffle with one tap; team colours red, blue, gold, green | auto-mixed, teacher can move |
| Without a projector | the teacher screen works on any laptop; if there's none, a pupil iPad can show a **mini scoreboard** (later stage) | **a laptop is fine; no iPad scoreboard** (stage 8 dropped) |

## 1. A round, start to finish

1. **Teacher opens it.** Teacher menu > Class Showdown. Their screen goes full window: the arena painting, a slim teacher bar on top (mode, arena, length, Start). Big "Join now!" banner, with the class name.
2. **Pupils join.** Every signed-in pupil in the class gets the pop-up wherever they are in the hub. Tapping it opens the controller. On the projector each name **flies into place** (onto a team corner, or around the boss). Late joiners can join at any time during the round.
3. **Teams form** (team modes). Auto-mixed by ladder place as people join; the teacher can drag names or tap Reshuffle before Start.
4. **Countdown 3, 2, 1.** The boss wakes with a roar on the projector; the first question pops on every iPad.
5. **The round.** Answer, hit, choose, react to big events (section 3). The projector carries the story: health bars, team bars, "Mia: 5 in a row!", "BOSS IS WINDING UP! 15 seconds to SHIELD!".
6. **Final seconds.** The last 30 seconds get a drumroll, a slow-motion final hit, a big finish.
7. **The recap.** A painted victory (or "So close!") scene on the projector, then the shout-outs one by one with a fanfare. Each iPad shows the pupil's own results: answers right, best streak, their award (if any), reward earned.
8. **Again?** One button for the teacher: same mode, same teams, new boss.

## 2. The four modes

All four use the same arena, the same controller and the same marking. What changes is who you're working for and what the scoreboard shows.

| Mode | Who's against who | Win | Projector shows |
|---|---|---|---|
| **Whole class vs boss** | everyone together against the boss | beat the boss before time runs out | one huge class health bar, the boss, "Class shield" meter, everyone's names around the edge |
| **2 teams** | red vs blue | your team does more (Boss Bounty: most damage; or knock the boss onto the other team's side, see 4.1) | two big team bars, two banners |
| **4 teams** | four corners | most team points | four corner banners and bars |
| **Everyone for themselves** | each pupil for themselves | most points | a live top-10 leaderboard plus "big move" pop-ups for anyone |

**The shared goal stays in every mode.** Even in team or solo modes the boss must be beaten before time is up, or **everyone** gets a smaller reward. That keeps the room working together while racing each other. (James asked for both, 23 Nov 2026.)

### 2.1 Roles (whole class and team modes)

Each pupil picks a role on their iPad at the start (can change between boss phases):

| Role | A correct answer... | Why it matters |
|---|---|---|
| **Striker** | hits the boss | damage |
| **Guard** | adds to the shield | blocks the boss's big attack (3.1) |
| **Healer** | revives a dazed classmate (3.2) or heals the team | keeps the team going |

Every role scores the same points per correct answer, so no role is the "bad" one. The projector shows the role mix ("Need more Guards!") so pupils talk to each other.

## 3. Big events (what makes it exciting)

Events are on a **schedule made from the round's seed** (so the server knows exactly when each happens) with some randomness, about one every 60 to 90 seconds.

### 3.1 Boss wind-up (shield check)
"BOSS IS WINDING UP!" with a 15-second countdown on the projector and a red pulse on every iPad. If enough correct answers come in (Guards count double), the shield holds with a huge clang. If not, the boss hits: every pupil is **dazed** for a few seconds (3.2) and the boss heals 10%.
Enough = 60% of the pupils playing (whole class), or per team in team modes. Whoever's team fails gets hit; others are safe.

### 3.2 Dazed (not out)
A dazed pupil's iPad shows stars spinning for 5 seconds, then they're back. A Healer's correct answer wakes them at once ("Leo woke up Aroha!"). Never longer than 5 seconds.

### 3.3 Weak spot
A glowing weak spot opens on the boss for 10 seconds. Hits during it count double.

### 3.4 Phase change
At 66% and 33% health the boss changes form: a new painting, a roar, a screen shake. Pupils can swap roles.

### 3.5 Golden question
Once a round, every iPad gets a golden question at the pupil's **easiest** current skill (`boxes: [3, 4]`). Every right answer is a big hit. Makes a great "everyone at once" moment.

### 3.6 Final 30 seconds
Drumroll, health bars glow, last-hit camera. In team and solo modes the **last hit** gets its own shout-out.

### 3.7 Teacher's enrage button
The teacher can make the boss angry for 20 seconds (faster wind-ups, bigger weak spots). Pure fun, for when the room needs a jolt.

## 4. The arenas

Each arena is a different picture and a different thing to do with a correct answer. Every arena works in all four modes.

### 4.1 Boss Bounty (stage 1 arena)
The giant boss in the middle of the projector. Correct answers are hits (or shield, or heals, by role). In **2 teams** there's an extra twist: the boss sits on a bridge, and team damage **pushes it toward the other team's side**, like a tug of war. In **4 teams** the boss turns to attack whichever team is **in front** (catch-up help without anyone noticing). In **everyone for themselves**, bounties: most damage, last hit, longest streak, best comeback.

### 4.2 Gold Rush
A painted map full of gold seams. Each correct answer digs. Each pupil chooses **where** to dig on their iPad: rich seams are faster but when several pupils share a seam they split the gold. Seams run dry and new ones glitter elsewhere. Teams dig for the team's pile. Strategy as well as maths, so a careful thinker can win. Big event: the **cave-in** (shield check), the **mother lode** (weak spot).

### 4.3 Sky Climb
Every pupil (or team) climbs a beanstalk, mountain or tower shown side by side. A correct answer = a step; 3 in a row = a jump. Storms knock back anyone who isn't answering. Highest when time runs out wins.

### 4.4 Shrinking Island
A big island shrinks slowly. Correct answers move you, build rafts or grab power-ups. Caught by the water? You wash up on a small rock and keep scoring, slower, until you swim back. No knockouts.

### 4.5 King of the Hill
One crown on the projector. Most points in the last 30 seconds wears it. Points come from how long you held it, so the lead keeps swinging.

### 4.6 Auction House
Correct answers earn coins. Every minute a treasure appears on the projector and everyone bids from their iPad. Highest treasure value at the end wins. Saving versus spending is sneaky money maths.

## 5. Fair and kind

- **Own-level questions.** Every pupil gets their own focus pack (`makeFocusPack`), 60% focus, 30% review, 10% stretch. The class's multiple-choice switch is followed.
- **No speed bonus.** One marked answer every 4 seconds per pupil (the iPad shows a filling ring). A correct answer is worth the same for everyone.
- **Streaks are small.** 3 in a row = 1.5x, 5 in a row = 2x, capped there, and a wrong answer only resets the streak.
- **Catch-up help.** The bottom quarter of the leaderboard (or the trailing team) gets a little boost: a lucky chest, a bigger weak spot. Never shown as "help".
- **Mixed teams.** Auto-teams are balanced by ladder place and by number of players; a late joiner goes to the smallest team.
- **No knockouts, no losing anything.** Dazed is 5 seconds at most. Nobody loses gold, points or items.
- **Lots of awards.** The recap picks 6 to 8 different pupils when it can (one award each before anyone gets a second).
- **Gentle on the projector.** A wrong answer is never shown on the big screen. Names only appear for good things.

## 6. How it works (tech)

- **Rules in `shared/showdown/`**, pure and tested: modes, scoring, streaks, the event schedule from a seed, the bounty and award picker, team balancing. Same idea as `shared/lord/clash.ts`.
- **Server: one function `supabase/functions/showdown/`** with actions:
  `open` (teacher: makes a room for the class, mode, arena, length), `join` (pupil), `teams` (teacher: move/reshuffle), `start`, `ask` (pupil: next question, way A), `answer` (pupil: marks it, applies the hit), `choose` (pupil: role, seam, bid), `tick` (projector, once a second: resolves any event whose time has passed), `pause`, `end`.
  **The server holds the truth.** Health, scores and events are worked out on the server from stored times; the projector's `tick` only asks "is it time yet?", so a slow or refreshed projector can't change anything.
- **Tables** (migration `<next>_showdown.sql`): `showdown_rooms` (class, mode, arena, seed, state, boss health, team scores, times), `showdown_players` (room, pupil, team, role, score, streak, last answer time, dazed until), `showdown_questions` (hidden, pupils can't read; like `marble_questions`), `showdown_feed` (recent hits and events for the projector, kept 1 hour). All need RLS, and every pupil-readable table, pupil-callable function and Realtime table goes in the allow-lists in `supabase/tests/database/security.test.sql` (Clan Duels gotcha).
- **Live updates through Supabase Realtime:** the projector listens to the room row and the feed; each iPad listens to its own player row and the room row. About 30 pupils answering every 4 to 8 seconds is roughly 5 to 8 writes a second for one class: comfortable.
- **The join pop-up** goes through `hub_here()` / `src/data/hubAsks.ts` (add `showdown` to the live games), so it reaches pupils anywhere in the hub.
- **Maths:** way A, copy Marble Rush: questions stored server-side, `publicQuestion()` to the iPad, `<game>_claim_answer` so each slot counts once, `recordMathsAnswers(..., 'showdown')` so answers count toward the ladder, Skill map and focus results. Add Showdown to `LADDER_GAMES`.
- **Wi-fi hiccups:** the controller re-joins on its own, the projector reloads straight back into the round. A pupil who drops out is simply idle.
- **Teacher pages:** the projector screen is `src/pages/TeacherShowdown.tsx` (full window, teacher bar folds away). Settings (on/off, names on projector, reward cap) on the usual teacher settings.
- **Test page:** `?pretend=30` fills a room with 30 pretend pupils who answer at real speeds (some fast, some slow, some wrong), so the projector can be tried with no class. Copy `pretendDuels.ts`.

## 7. Art, animation and sound (planned in from the start)

Painted on the gaming PC with ComfyUI. Style: *bold storybook fantasy, rich colour, dramatic light, painterly digital art, no text*. Full list and prompts in `docs/SHOWDOWN-ART-PLAN.md` and `docs/showdown-art/config.json` at the art stage.

| Picture | Size | Used for |
|---|---|---|
| 4 bosses x 3 phases | 1536 x 1536 cut | the bosses on the projector (12 paintings) |
| 4 battle backdrops | 1536 x 864 | behind each boss (river valley, stormy sea, clock tower, night sky) |
| Lobby painting | 1536 x 864 | "Join now!" screen |
| 4 team banners | 768 x 1024 cut | red, blue, gold, green corners |
| 3 role portraits | 768 x 768 cut | Striker, Guard, Healer on the iPad |
| Victory + "So close!" | 1536 x 864 | recap |
| 8 award badges | 512 x 512 cut | recap shout-outs |
| Gold Rush map + seams | 1536 x 864 + cuts | arena 2 |
| Fx sprites | 512 x 512 | hits, shield clang, heal sparkles, weak spot glow, daze stars (copy Goblin Storm's painted fx) |
| iPad controller frame | 1024 x 1536 | painted frame around the question |
| Home card | 1600 x 900 | hub home page |

**Animation:** names flying in, hit numbers bursting off the boss, screen shake on big hits, boss breathing and flinching, phase-change transform, shield dome with a crack, confetti finish, award cards flipping in. Every iPad hit gets a small burst and a team-coloured flash.
**Sound (projector only):** boss roars and hits per boss, shield clang, heal chime, countdown drums, crowd cheer, victory fanfare. **Announcer voice** with Kokoro ("Shield up!", "Weak spot!", "Thirty seconds!", "And the last hit goes to... Team Gold!") without saying pupils' names (names shown, not spoken).

## 8. Design checklist (docs/game-guide/1-design.md)

1. **Big goal:** beat all 4 bosses as a class; every boss beaten unlocks the next in the roster; later, "hard mode" bosses.
2. **Season game?** No.
3. **Play a day:** teacher-run, no limit; every round gives rewards (James: no cap).
4. **Progress:** class boss roster on the teacher screen (bosses beaten, best time).
5. **Achievements:**

   | Name | For (pupil words) | Measure | Number | Who gets it |
   |---|---|---|---|---|
   | First Showdown | Play your first Class Showdown | rounds | 1 | everyone |
   | Titan Slayer | Help your class beat a boss | bosses_beaten | 1 | most |
   | Last Hit | Land the final blow on a boss | last_hits | 1 | some |
   | Shield Wall | Help hold 10 shields as a Guard | shields | 10 | many |
   | Lifesaver | Wake up 10 dazed classmates | revives | 10 | many |
   | On Fire | Get 10 answers in a row in one round | best_streak | 10 | some |
   | Boss Hunter | Beat all 4 bosses | bosses_beaten_unique | 4 | the whole class, over weeks |

6. **Home card:** the four bosses looming over a crowd of tiny heroes with team banners.
7. **Guide:** the first round has a 20-second "how to play" on the projector (big pictures, the announcer) and on each iPad (tap answer, pick a role).
8. **Learning design:** right answer always shown with the reason; no speed bonus; no wrong answers on the projector; questions only from the pupil's pack.

**Lesson fit:** set up in under a minute, a round is 5 to 15 minutes, great as a Friday finish or a warm-up.

## 9. Stages

Each stage is its own PR, carried to live, with the teacher switch **off** until stage 4.

| Stage | What | Done when |
|---|---|---|
| **1. Rules** | `shared/showdown/`: modes, scoring, streaks, caps, event schedule, team balancing, awards; a simulator with 30 bot pupils to tune boss health per class size and length | tests pass; the simulator shows a typical class beats a boss in about 80% of rounds |
| **2. Server and live** | migration, `showdown` function, Realtime, join pop-up, way-A maths, `?pretend=30` | a pretend class of 30 plays a full round on the server |
| **3. Boss Bounty, whole class** | projector screen and iPad controller, full window, roles, shield, daze, weak spot, phases, recap. **First boss painted with all 3 phases, fx, sounds and announcer in this stage** | James plays it with pretend pupils and it looks and sounds the part |
| **4. Teams and solo** | 2 teams (tug of war), 4 teams (boss chases the leader), everyone for themselves (bounties, leaderboard), team picker and reshuffle; switched **on** for James's class | a real class round in every mode |
| **5. Rewards and the roster** | hub points, Showdown chest, achievements, remaining 3 bosses painted, boss roster, "Again?" | live for every class |
| **6. Gold Rush** | arena 2 with its map, seams, cave-ins | live |
| **7. More arenas** | Sky Climb, Shrinking Island, King of the Hill, Auction House, one PR each | live, one by one |
| ~~8. No projector~~ | dropped: James said any laptop is fine as the big screen | - |

## Stage 1 results (23 Nov 2026)

The rules are in `shared/showdown/` (see `shared/README.md`), with 4 tests (budget 12) and the simulator `npm run showdown:sim` (`-- --write` re-tunes `bossHealth.ts`).

- **Every call returns events to animate** (`ShowdownEvent` in `types.ts`): `join`, `team_move`, `role`, `start`, `boss_grows`, `hit` (points, damage, streak, multiplier, weak spot, golden), `wrong` (iPad only), `streak` (3, 5, 10...), `lucky_chest`, `revive`, `wind_up`, `shield_progress`, `shield_held`, `shield_broke`, `boss_heals`, `weak_spot`(`_end`), `phase`, `golden`(`_end`), `final`, `enrage`(`_end`), `tug`, `boss_turns`, `boss_beaten`, `time_up`. Stage 3 animates these; James wants flashy, immersive graphics and animation (23 Nov 2026).
- **Boss health** is tuned per mode, length (5, 10, 15 min) and class size (8 to 32) with typical classes of pretend pupils (25% fast, 40% steady, 20% slow, 15% wobbly, a new mix each round): about 80% of rounds are won in every mode (cells 73% to 87%, average 80%). A late joiner makes the boss bigger by their share of the time left.
- **Calls made while building (James can change any):**
  - Shield check counts **right answers, not pupils**: 2 per pupil playing within the 15 seconds (a Guard's counts 2). "60% of pupils" was held almost every time in the simulator. Now a typical class holds about 2 in 3 (team modes a little less, big classes more).
  - **Healers aren't dazed** when a shield breaks, so they can wake everyone. With nobody to wake, a Healer's answer hits at half strength, like a Guard's.
  - **Guards** bank a little shield between wind-ups (at most 10% of the next target).
  - **Enrage**: a 10-second wind-up straight away, then a 15-second weak spot; once a minute at most, not in the last 30 seconds.
  - **4 teams**: the boss turns only to a team 20+ points in front, at most every 15 seconds (it was flicking about 60 times a round). Its wind-ups hit only that team.
  - **Catch-up**: the trailing team gets 2.5x in weak spots instead of 2x; the trailing team (or the bottom quarter in whole class and solo) gets a lucky chest (+10) on about 1 right answer in 6.
  - **2 teams** are won on damage (the tug of war); 4 teams and solo on points.
  - **Golden question**: worth 3x, one per pupil, in a 20-second window.
  - **Shout-outs** (in this order, up to 8, different pupils first): top score, last hit, longest streak, most damage, best comeback, shield wall, best healer, golden moment, most careful, hard worker. A class of 30 gets 8 different pupils.

## Stage 2 results (23 Nov 2026)

- **Server steps in `shared/showdown/server.ts`** (`showdownStep`), shared by the edge function (`supabase/functions/showdown/`), its tests and the test page. Teacher: `open`, `view`, `teams` (move one / `reshuffle`), `start`, `tick`, `enrage`, `pause` (`resume: true` carries the clock on), `end`. Pupil: `join` (finds the class's open room), `choose`, `ask`, `answer` (marks it, applies the hit and returns the next question in one reply).
- **Locking:** Supabase's API can't hold `select ... for update` across calls, so every save is a **compare-and-swap** on the room's `version` (`showdown_save`), with the answer's claim in the same transaction; a refused save re-runs the step on the newer round (up to 8 tries, with a small random wait).
- **Tables** (`20261123000900_showdown.sql`): `showdown_rooms` (the class's pupils and teachers read it: `view` = `RoomView`, no names or maths), `showdown_state` (the whole round, hidden), `showdown_players` (`view` = `PlayerView`: a pupil reads only their own; the teacher the room's), `showdown_questions` (hidden), `showdown_feed` (teachers of the class only, since it names pupils; cleared after 1 hour, questions after 1 day). All three readable tables are in Realtime.
- **Feed:** every engine event the moment it's saved, with `names` for every pupil it mentions, plus `recap` (when the round ends), `pause`, `resume` and `ended`. Wrong answers are never in the feed (only the pupil's own reply has them).
- **Switches:** `showdown_enabled` (on for every class, held back by the code switch `src/games/showdown/switch.ts`) and `showdown_names` (first names on the projector), saved by `teacher_set_showdown()`.
- **Join pop-up:** `hub_here()` lists `showdown` while a room in the pupil's class is open and they haven't joined (`showdown_waiting`); `showdown_here()` gives the room; the hub banner says "Class Showdown is starting! Join in!" and opens `/showdown?room=…` (read by Bella when read-aloud is on, 24 Nov 2026).
- **Pretend class:** `shared/showdown/pretendClass.ts` (30 pupils from `bots.ts` at real speeds through the real steps on `memoryServices.ts`). Test page: `npx vite --config vite.showdown-preview.config.ts` (`?pretend=30&mode=teams2`), with bare projector and controller screens (`src/games/showdown/TestScreens.tsx`).
- **Calls made:** the pretend class runs in the page on the real server code (as Clan Duels' and Circuit's test pages do), not as 30 sign-ins on the live server; ladder place for team mixing is the pupil's count of secure ladder skills; the request limit is 120 a minute per person (the projector ticks every second).

## Stage 3 results (23 Nov 2026)

- **Projector** `src/games/showdown/Projector.tsx` (state from the feed in `projectorState.ts`, drawn stand-in `BossStandIn.tsx` until the painting is there): full window, teacher bar that folds away, lobby with names flying in, 3-2-1, the battle (hit bursts sized by `times`, shake, flinch, weak-spot glow, shield dome with clang or shatter, daze stars, heal sparkles, phase transform, golden sweep, final-30 drumroll, beaten explosion, confetti) and the recap (victory or "So close!", award cards flipping in). Picks up a running round from `?room=` or the tab's memory.
- **Controller** `src/games/showdown/Controller.tsx`: join (auto from `?room=`), role cards that fold to a chip, `QuestionModal` inline (keyboard typing works on a MacBook), the 4-second ring, daze, golden frame, wind-up pulse, burst on every hit, own results. Re-joins by itself.
- **Sound** `audio.ts`: every sound made with Web Audio (no files), hits rate-limited; announcer lines in `voiceLines.ts`, all read by Bella (clips in `public/voice/showdown/`, checked by `voiceLines.test.ts`, 24 Nov 2026; Gold Rush and the boss roars too).
- **Test page:** `npx vite --config vite.showdown-preview.config.ts`; the yellow button swaps between the big screen and "your" iPad; `?view=test` keeps the bare stage 2 screens.
- Tests: 10 of 12 used.

## Stage 4 results (23 Nov 2026)

- **Projector, team modes** (`Projector.tsx`, `projectorState.ts`, `projector.css`): waving team banners with damage or points and a bar (painted `banners/banner-<team>` when there), the 2-team bridge with the boss slid along by `view.tug` and shaking on each `tug`, "RED is pushing!", the 4-team boss turn (tilt, eyes, roar rings, "The boss turns on GOLD!", the faced team's flag pulsing), one shield dome per team in wind-ups, the team recap with confetti in the winner's colour.
- **Solo:** a live top 10 whose rows slide as places change, "Noah jumps to 5th!" for a climb of 3 or more into the top 10, bounties (most damage, last hit, longest streak), the podium recap. Names follow the names switch ("Hero" when off).
- **Team picker:** team columns in the lobby; tap a name then a team, or drag it (`teams` with `pupil` + `team`); Reshuffle as before.
- **Controller:** team colour on the edge glow, ring and clock; solo shows "You're in the top 10!" only (`PlayerView.topTen`, worked out on the server; a pupil is never told a place).
- **Questions:** the ladder's untimed skills (`shared/maths/untimed.ts`: rounding, order of operations, number lines, arrays...) are left out of every Showdown question (James, 23 Nov 2026), so a round is quick recall; a pupil whose focus is only untimed skills gets times tables.
- **Pages:** `src/games/showdown/index.tsx` (group complex-maths, teacher switch, settings drawer with the names switch), `ShowdownPage.tsx` (the controller at `/#/showdown?room=`), `src/pages/TeacherShowdown.tsx` (the projector at `/teacher/<class>/showdown`, a "Class Showdown" tab in the teacher header), `src/data/showdown.ts`.
- **Switched on:** `SHOWDOWN_ON = true`; migration `20261123001000_showdown_riley_only.sql` turns `showdown_enabled` off for every class and the school defaults except James's class (Riley). Teachers can still switch it on from the Games tab.
- **Left for later:** the "best comeback" bounty (needs a place history); the home card picture (painted, comes with the art); iPad-size screen check of the team screens.
- Tests: 12 of 12 used (team picker + solo top 10; untimed skills left out).

## Stage 5 results (24 Nov 2026)

- **Rewards:** when a round ends, every pupil's row gets a `reward` in the same save (`shared/showdown/bosses.ts` `rewardFor`): hub points (1 for playing, 3 with a right answer, 5 when the boss is beaten; inside the shared daily cap) and a **Showdown chest** for their own favourite game that has coins: Goblin Storm gold (20, 30 if beaten) or Archery coins (5, 8), whichever they played last and is on for them (`showdown_chest_games`). The server then calls `showdown_finish(room, done)` (migration `20261124000500_showdown_rewards.sql`), which pays once per round (`showdown_finished`, room + seed), even if the projector's `view` asks again.
- **Achievements:** First Showdown, Titan Slayer, Last Hit, Shield Wall, Lifesaver, On Fire, Showdown Veteran, Boss Hunter (`showdown_stats`, `showdown_counts`).
- **Boss roster:** River Titan, Storm Kraken, Clockwork Colossus, Comet Wyrm (`bosses.ts`), each beaten in turn unlocks the next (`showdown_roster`, best time per class). `RoomView.bossId`; `open` takes an optional `boss` (only an unlocked one); the projector shows the roster in the lobby.
- **"Again?":** teacher action `again` resets the same room to the lobby with the same pupils, mode, length and teams and the next boss, so iPads carry straight on.
- **On for every class:** the migration sets `showdown_enabled = true` everywhere.
- Tests: 13 (budget raised by 1 for rewards and the roster).

## Stage 6 results (24 Nov 2026)

- **Rules** (`shared/showdown/goldrush.ts`): the engine's round with the boss's health standing in for the mountain's gold. 5 seams open at once on 14 map spots: gold (1x, room for 4), gems (1.5x, room for 3), rich vein (2.5x, room for 2); room grows by 1 lot per 12 pupils. Past its room a seam's pay is split among its diggers (never below 0.4x), and only pupils who answered in the last 15 seconds count as digging. A seam holds about 12% of the mountain, so several run dry each round and a new one opens at a free spot (`seam_dry`, `seam_new`). A pupil with no seam (or a dry one) digs at the one with most room. Points scale with the seam's pay. Cave-in = the wind-up (shield check), mother lode = the weak spot. The mountain is 1.17x to 1.23x the boss's health by mode, so the simulator wins about 80% of rounds like Boss Bounty.
- **Server:** `open` takes `arena: 'goldrush'`; a pupil's `choose` with `seam` (refused `dry` for a closed seam); `RoomView.seams` (where, kind, gold left, diggers) and `PlayerView.seam`. Rewards and "Again?" are as Boss Bounty; a Gold Rush round puts no boss on the roster and doesn't count as a boss beaten for achievements (`done.roster = false`, migration `20261124000600_showdown_goldrush.sql`).
- **Projector:** the painted mine with seams glittering at their spots (gold-left gauge, digger count, "GEMS"/"RICH" tags, a shiver when nearly dry), gold nuggets arcing to the pupil's chip or team banner, dry seams cracking and crumbling, the cave-in (rumble, dust, falling rocks, the "prop up the roof" dome), the mother lode (rays, golden pulse, "DOUBLE!"), gold piles under team banners instead of the bridge, and a gold-heap recap. The teacher bar has an Arena picker; the boss picker and roster are hidden in Gold Rush and Enrage reads "Rumble".
- **Controller:** a seam button by the question (pay meter, "Move seam"), the seam picker (`SeamPicker.tsx`: big cards with pay, "N digging · room for M", gold left, "best pay", "you are here"; it never takes keyboard focus, so typing carries on), the picker opening by itself at the start and when your seam runs dry, a coin burst on every right answer, the cave-in warning.
- **Left for later:** the dry-seam crack wasn't seen in a screenshot; cave-in dust can cover some name chips for a moment.
- Tests: 14 (budget raised by 1 for the Gold Rush rules).

## Stage 7 results: Sky Climb (24 Nov 2026)

- **Rules** (`shared/showdown/skyclimb.ts`): the engine's round with the boss's health standing in for the climb. Every 3rd right answer in a row is a **jump** (double height, `jump` event). The wind-up is a **storm** (shield check); when it passes, anyone who hasn't answered for 15 seconds is **blown back** 3 steps (`blown_back`, the climb loses that height). The weak spot is an **updraft** (double height). The summit is 1.31x to 1.33x the boss's health, tuned with the simulator to about 80% of rounds won (class 82%, 2 teams 80%, 4 teams 82%, solo 81%, Boss Bounty 82% to 86%).
- **Arena words** (`src/games/showdown/arenaWords.ts`): every arena's words for the same moments (roles, shield check, banners, iPad notices, awards, recap, announcer lines) in one table, read by the projector, the iPad and the announcer. Gold Rush moved onto it too, so a new arena is one entry.
- **Server:** `open` takes `arena: 'skyclimb'`. One migration (`20261124000900_showdown_more_arenas.sql`) lets a room be any of the four stage 7 arenas. Pays like Gold Rush (no roster row, no boss beaten).
- **Projector:** the mountain with the summit flag, every pupil's climber side by side on their rope (grouped and coloured by team), height growing with the square root of the climb so early steps show; steps bounce, jumps leap with "JUMP!" and puffs, the storm darkens the sky with rain, gusts and lightning while climbers sway, blown-back climbers spin down; the updraft sends white streams up; an altimeter on the left; team banners count metres; the recap plants the flag on the peak.
- **Controller:** the climb on the right (rope, flag, my climber stepping and leaping), climbing words for roles (Climber, Anchor, Medic) and notices, storm rain on the iPad too.
- **Voice:** 8 Bella lines (join, start, storm, held on, blown back, updraft, above the clouds, summit).
- **Art to paint** (placeholders now): `art/paint/back/sky-climb.webp` (the cliff backdrop), `art/paint/skyclimb/climber.webp`, `summit-flag.webp`, `summit.webp`, `cloud.webp`.
- Tests: 15 (budget raised by 1 for the Sky Climb rules).

## Stage 7 results: Shrinking Island (24 Nov 2026)

- **Rules** (`shared/showdown/island.ts`): the engine's round with the boss's health standing in for the rescue raft (every right answer adds planks). Everyone has a spot on an island whose shoreline shrinks steadily to 0.2 of its size by the end. A right answer moves you a small step inland. Whoever the water reaches washes up on a rock (`washed_up`): no knockouts, but answers there build half as much until 2 right answers swim you back (`swam_back`). The wind-up is the **big wave** (shield check): where it breaks it sweeps everyone on the outer half of the beach back towards the water, and anywhere it pushes back pupils who weren't answering (`wave`). The weak spot is a **crate washing ashore** (double planks). Raft 1.0x to 1.04x the boss's health: class 82%, 2 teams about 80%, 4 teams 80%, solo 81% won in the simulator.
- **Server:** `open` takes `arena: 'island'`; `RoomView.island` carries the shoreline and every pupil's spot by id (angle, distance, rock and swim strokes), no names. The migration from Sky Climb already allows it.
- **Projector:** the sea, the island (sand, grass, swaying palms, foam) shrinking with the clock, every pupil standing on it with their role portrait in team colours, rocks bobbing out in the water with "0/2" swim counters, planks spinning from each pupil to the raft, the raft's planks laid one by one with a mast and sail near the end, SPLASH! when the water gets someone, "Swam back!", the crate floating in, the big wave rising with foam and spray and sweeping the beach when it breaks, and a recap where the boat sails away.
- **Controller:** the island from above (everyone as dots, me as a star, the raft), a "You're on a rock! (1/2)" notice, building words for roles (Builder, Wave-breaker, Medic).
- **Voice:** 8 Bella lines.
- **Art to paint:** `back/shrinking-island.webp`, `island/palm.webp`, `island/rock.webp` (placeholders now; painting under way on the PC).
- Tests: 16 (budget +1 for the Shrinking Island rules).

## Stage 7 results: King of the Hill (24 Nov 2026)

- **Rules** (`shared/showdown/hill.ts`): the engine's round with the boss's health standing in for the castle on the hilltop (every right answer adds stones). There is one **crown**: every 5 seconds it goes to whoever scored the most points in the last 30 seconds (a pupil; a team in team modes; at least 10 points, and a tie keeps it where it is), and whoever wears it earns 5 crown points each check (`crown`, `crown_paid`). The wind-up is a **challenger charging the hill** (shield check): if it breaks, the crown is knocked off and the 30-second race starts again. The weak spot is **double crown** (double stones, the crown pays double). In 2 teams the winner is the team with the most points (crown points count), not the most damage. Castle 1.01x to 1.05x the boss's health: about 80% won in the simulator in every mode.
- **Server:** `open` takes `arena: 'hill'`; `RoomView.crown` carries the holder, since when, the next check, the top 3 contenders by recent points and how long each holder has worn it. The migration from Sky Climb already allows it.
- **Projector:** a green hill with the castle rising stone by stone, the throne on top with the crown on the holder's name ("wearing it 8s"), the Crown race panel (top 3 in the last 30 seconds with a countdown ring to the next check), "👑 RUBY TAKES THE CROWN!" with a fanfare, crown points popping, the crew chip of the holder glowing, horses charging up the hill during the wind-up, "×2" double crown, and a recap with the finished castle and the longest reign.
- **Controller:** the hilltop (castle, throne, the crown dropping on to it, spinning when it's up for grabs, glowing when it's mine), a bar showing how close I am to the leader, notices "👑 You wear the crown!" / "Red wears the crown!" / "The crown is up for grabs!", building words for roles (Mason, Guard, Medic).
- **Voice:** 13 Bella lines (new king, each team takes the crown, charge, held, broke, double, phase, done).
- **Art to paint:** `back/king-hill.webp`, `hill/crown.webp`, `hill/throne.webp` (placeholders now; painting under way on the PC).
- Tests: 17 (budget +1 for the King of the Hill rules).

## Stage 7 results: Auction House (24 Nov 2026)

- **Rules** (`shared/showdown/auction.ts`): the engine's round with the boss's health standing in for the royal treasury. Right answers also give each pupil coins to spend. From 30 seconds in, a treasure goes up every minute and bidding stays open 20 seconds; the leading bid when the hammer falls buys it. A pupil's fortune (their score) is coins plus treasure, so a bargain grows it and overpaying shrinks it. Treasures get dearer through the round, every third is a mystery box (value hidden until sold) and the last is always the golden dragon. The wind-up is **thieves** (shield check): if any group breaks (in solo, fewer than 60% hold) the treasure on sale is stolen and nobody pays. The weak spot is the golden hour (double coins). In team modes a pupil can't outbid their own team, and treasures count for the team. Treasury 1.02x to 1.05x the boss's health: about 80% won in the simulator in every mode.
- **Server:** `open` takes `arena: 'auction'`; `choose` takes a bid (refusals in plain words: too low, not enough coins, your team is already winning); `RoomView.auction` carries the lot on sale, the next one, what's sold and the 5 biggest fortunes; `PlayerView` gives coins and treasure.
- **Projector:** the curtain-opening entrance, the treasury pile, the treasure on a lit plinth, the bidding card (leading bid, who, countdown, bids), "SOLD!" with the gavel, the thieves running off with it, the shelf of sold treasures, the Biggest fortunes panel (hidden in team modes and solo, where the flags and top 10 show the same), and a recap of the best buys.
- **Controller:** the bid panel (purse, "Bid N" buttons for +10, +25, +50), notices for a new treasure, being outbid and winning.
- **Voice:** 13 Bella lines. **Art to paint:** `back/auction-house.webp` and the treasures in `auction/`.
- Tests: 18 (budget +1 for the Auction House rules).

## Narration and sound variety (24 Nov 2026)

After the first real class round James asked for more Bella and less sameness. 59 new lines: the round's milestones (halfway, nearly there, one minute left), streaks of 5 and 10, the lucky chest, a revive, pause and resume, a new solo leader, team pushes, the boss turning on each team, and each arena's own role calls ("We need more Anchors!", "We need a Medic!") said every 25 seconds while a role is short. Common lines have alternate takes, picked at random but never the same twice running. Every sound plays at a slightly different pitch, and each arena adds its own touch to a hit (pickaxe ping, splash, coin, stone thud, gust). The gap rules from #787 still apply, so it never piles up.

## Tuning after the first real rounds (24 Nov 2026)

The first real 5-minute rounds (about 19 pupils) beat the boss at 192 s (class) and 210 s (solo) of 300, and dug out Gold Rush (teams4) at 151 s. James found it a little easy. The pretend pupils now think at 0.6x their first guessed times, which reproduces about 210 s at the old health, and every boss health table value is scaled by `REAL_CLASS_PACE` = 1.3 (`bossHealth.ts`). With 19 pupils the simulator then wins about 78% of rounds, with a won round ending about 30 to 40 seconds before the bell; the other arenas scale with it.

## 10. Risks

- **School wi-fi with 30 iPads at once.** Tiny messages only (a hit is a few bytes); the iPad never waits on the projector. Try it in a real class in stage 4 before switching on for everyone.
- **One class's projector refreshing or sleeping** — the round lives on the server and carries on; the projector picks up where it was.
- **Kids tapping wildly in multiple choice** — the 4-second answer pace and the 2-second wait after a wrong answer make guessing slower than thinking.
- **Teams feeling unfair** — teams balanced by ladder place, not by score, and a visible Reshuffle.
- **Noise.** Sound only from the projector, and the teacher bar has a mute.
