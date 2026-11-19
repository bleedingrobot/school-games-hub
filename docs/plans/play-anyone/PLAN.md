# Play anyone: friends across the whole school, and a new Lobby

**Asked by James, 20 Nov 2026.** Kids should be able to play anyone in their school, not only their own class. The Lobby should offer every way to play with someone.

**Decided 20 Nov:**
- Both classes' switches must be on.
- Show class names.
- Sky Isles is one whole-school sky.
- The Banners board is whole school.
- Star Forge is not in the Lobby.

**Status:** stage 1 built 20 Nov 2026 (migration `20261120000300_play_other_classes.sql`); stage 2 built 20 Nov 2026 (migration `20261120000500_hub_here.sql`); stage 3 built 20 Nov 2026 (migration `20261120000700_lobby_here.sql`); see the "Stage results" sections at the end. Stages 4 to 7 not started.

## Where things are now

| Game | Who you can play now | Where you find them |
|---|---|---|
| Chess, Checkers | anyone at school | Lobby (open games, codes) |
| 101 | anyone at school | Lobby |
| Wormholes & Black Holes | anyone at school | Lobby |
| Power Clash | anyone at school | Lobby |
| Archery Challenge fights | own class only | inside Archery ("Classmates") |
| Dragon Maths live clashes | own class only (saved-hero arena fights are already whole school) | inside Dragon Maths |
| Clan Quest live duels | own class only | inside Clan Quest (Duel Arena) |
| Clan Quest Village Raids | own class only, list cut off at 100 | inside Clan Quest |
| Sky Isles races and gifts | own class only | inside Sky Isles (class sky) |
| Star Forge gallery and stickers | own class only | inside Star Trader |

The Lobby covers only the first five. Nothing anywhere shows who is online across the hub.

## What changes

### A. One teacher switch: "Play other classes"

- A new class setting, **on by default** (new things go live switched on).
- Two kids from different classes can play only if **both** classes have it on. If either teacher turns it off, that class plays only within itself. The game's own switches still apply too.
- Kids in the same class are not affected by it.
- On the teacher's settings, next to the other multiplayer switches.

### B. Widen each class-only game to the whole school

Everything is in one migration, and every game keeps its same-school and hidden-pupil checks.

1. **Archery fights.** Lift the class check from the challenge and from the "who's here" list. Also check the other kid's "Classmate fights" switch at challenge time. Today only their Archery switch is checked, which was fine while both kids were always in the same class.
2. **Dragon Maths live clashes.** Lift the class check from the challenge and the list. Both kids' switches are already checked.
3. **Clan live duels.** Same as Dragon Maths.
4. **Village Raids.**
   - Lift the class check from the targets, the raid and the save.
   - Check the defender's raid switch too, not only the raider's.
   - Replace the cut-off at 100 with "my class first, then search".
   - The weekly Banners board becomes one board for the whole school (James chose this, 20 Nov).
5. **Sky Isles: the whole school in one sky** (James chose this, 20 Nov).
   - Every island at school is in the sky, with your class's islands nearest yours.
   - To stay quick, the sky first loads a short card per island (name, size, picture). The whole island loads only when you visit it, with more of the sky loading as you scroll.
   - The game's pace still uses the class's middle island size. That is a hidden number that only sets the pace, so it stays per class.
   - The news board shows the whole school.
   - Races and gifts work with any island. Races check the defender's "Sky Races" switch too.
   - The 3-challenges-a-day cap on each island stays, so popular islands aren't swamped.
6. **Star Forge gallery and stickers.**
   - The gallery shows my class first, then a "Whole school" tab with search and pages. Picture links are made only for the page on screen.
   - Stickers work on any system at school.
   - The owner's Forge switch is checked too.
7. **Wording.** Change "You can only challenge classmates in your own class" to something like "That player's class isn't playing other classes right now."

### C. "Who's here" across the hub

- A new small table records who has the hub open. The page checks in every 30 seconds, and a pupil counts as "here" for 75 seconds after their last check-in, the same rule the duel games use.
- Each game's "who's here" list counts a kid who is in that game **or** in the Lobby. A friend waiting in the Lobby can then be challenged to Archery or Dragon Maths straight away.
- Hidden pupils are never listed.
- Lists show **my class first**, then everyone else at school. There is a name search, and each kid from another class shows their class name, so kids can find their friends.

### D. The new Lobby

One page, "🤝 Play a friend", laid out top to bottom:

1. **Challenges for you.** Asks waiting for you from any game (Archery, Dragon Maths, Clan duel), each with Yes and No. These also pop up as a small banner anywhere in the hub, so a kid doesn't miss one while they're in another game.
2. **Your games.** Every game you are in, from every game type, with Carry on. The chess, 101, space and Power Clash rows stay as they are, and open fights, clashes and duels are added.
3. **Pick a game.** A grid of tiles, one for each way to play:
   - **Chess, Checkers, 101, Wormholes & Black Holes, Power Clash:** start a game (code for a friend, or open to anyone), plus the open games list.
   - **Archery fight, Dragon Maths clash, Clan duel:** pick someone who's here and send a challenge.
   - **Sky race, Village Raid:** pick an island or a village, then go straight to that screen in the game.
   - Star Forge is **not** in the Lobby (James, 20 Nov): you look at and sticker other systems, you don't play anyone. Its gallery still goes whole school in stage 7.
   - **A tile you can't use yet is greyed out** and says why, with a button to fix it:
     - "Make your hero first to battle your friends" (Dragon Maths, takes you to make your hero).
     - "Start your clan first" (Clan Quest).
     - "Build your island first" (Sky Isles).
     - "Choose your archer first" (Archery).
   - A tile for a game the teacher has switched off is greyed out with "Your teacher has paused this." A non-maths game during maths-only time works the same way.
4. **Who's here.** Kids online now: my class first, a search box, class names on others. Tap a kid and you see the games you can play together (greyed ones say why, for example "Mia hasn't made a Dragon Maths hero yet"). Tap one and the challenge or invite is sent.
5. **Join with a code** stays, smaller, at the bottom.

The open-games list stays a 20-second refresh. Challenges arrive live, as they do now.

**Inviting someone by name to chess, checkers, 101, space or Power Clash.** This is new. You tap a kid and choose "Chess", and they get an ask like the duel games. The server makes a private game for just the two of you, with no code to type.

### E. Small things to check

- Trophies for beating classmates (for example Archery's): still fine school-wide? Rename "classmate" to "friend" where kids see it.
- Season resets (Archery New Season, Clan Fame) clear per pupil, not per class, so nothing changes.
- "What's new" line for pupils when it goes live.
- Players tracker: no change.

## Stages

Each stage is its own PR, merged when green, and goes live switched on.

| Stage | What | Depends on |
|---|---|---|
| **1** | Teacher switch "Play other classes" + widen Archery, Dragon Maths clashes and Clan duels (B1–B3, B7). The lists inside each game show class first, plus a search. | – |
| **2** | Hub-wide "who's here" and the challenge banner (C, D1). | 1 |
| **3** | The new Lobby (D2–D5): game tiles with greyed "make your hero first" states, who's here, challenge from the Lobby. | 2 |
| **4** | Name invites for chess, checkers, 101, space and Power Clash. | 3 |
| **5** | Village Raids school-wide (B4). | 1 |
| **6** | Sky Isles: whole school in one sky (B5). | 1 |
| **7** | Star Forge whole-school gallery (B6). | 1 |

Stages 5, 6 and 7 touch only their own game, so they can run in parallel once stage 1 is live.

## Tests

- **Database tests for each widened function:**
  - two kids in different classes at one school can play;
  - kids at different schools can't;
  - a hidden kid can't be found;
  - either class with "Play other classes" off stops it.
- **Lobby screen tests:** greyed tiles with the right words; challenge Yes and No; search.
- Screens checked at phone, iPad and laptop sizes.


## Stage 1 results (20 Nov 2026)

Built on branch `claude/play-anyone-1`, migration `20261120000300_play_other_classes.sql` (create or replace only, plus one new column).

- **Teacher switch.** `app_settings.play_other_classes`, on by default (school default and every class). "Play other classes" sits under "Games against friends" on the teacher's Today page; `teacher_set_play_other_classes(enabled, target_class)`; a school admin can set the school default; changes show in Recent changes.
- **Rule.** `plays_other_classes(a, b)`: same school, and either the same class or both classes have the switch on. `play_other_classes_on(player)` reads one side; `class_card_of(player)` gives the class id and name.
- **Games.** Archery (`archery_here`, `archery_duel_challenge`), Dragon Maths (`lord_here`, `lord_clash_challenge`) and Clan duels (`clan_duel_here`, `clan_duel_challenge`). "Who's here" lists my class first, then the rest of the school, each row with `sameClass` and `className`. Archery's challenge now also refuses when the other class has Classmate fights off. Village Raids, Sky Isles and Star Forge untouched.
- **Lists.** One shared component, `src/components/SchoolPlayerList.tsx`: "Your class" then "Rest of the school", a name search (it also finds class names) once there are more than 6, the class name tag beside kids from other classes, and the rest of the school 20 at a time with "Show more". Checked with 120 pretend kids at phone, iPad and laptop sizes; in Dragon Maths and Clan duels the class tag sits under the name so long names never hide it.
- **Words.** "That player's class isn't playing other classes right now." replaces "You can only challenge classmates in your own class". Kids now see "friend" or "player" instead of "classmate" in these three games (teacher labels unchanged).
- **Trophies.** No change needed: the classmate-win trophies are only for Chess, Checkers, 101, Power Clash and Wormholes, none of which this stage touches.
- **Tests.** New `supabase/tests/database/play_anyone.test.sql` (31 checks: cross-class challenge in all three games, other schools never, hidden kids never listed, either class off stops it, same class unaffected). The older class-only tests (`archery_classmates`, `clans_live_duels`, `lord_live_arena`) now switch the setting off so they still test one class on its own; `security.test.sql` lists the new teacher function.

## Stage 2 results (20 Nov 2026)

Built on branch `claude/play-anyone-2`, migration `20261120000500_hub_here.sql` (one new table, create or replace for the rest).

- **Who has the hub open.** New table `hub_here (player, seen_at)`, no pupil access. `hub_here()` records "I'm here" for a school pupil who isn't hidden, and returns only which of my games have a challenge waiting for me (`{waiting: [...]}`), nothing about anyone else. `hub_seen(player)` is the 75-second check. `tidy-hub-here` cron (03:29 daily) clears rows older than a day.
- **Game lists count the hub.** `archery_here`, `lord_here` and `clan_duel_here` list a kid who is in that game or has the hub open; the three challenge functions accept them the same way. Because a hub-only kid never runs the game's own "here", the lists now check each listed kid's own game switches (Archery on + Classmate fights on, Dragon Maths live arena on, Clan duels on). Every stage 1 rule kept.
- **Check-in.** `src/multiplayer/useHubAsks.ts`: every 30 s (plus up to 10 % at random so a class doesn't ask in step) while the page shows, and again when it comes back into view. Only games with something waiting get asked for their challenges, through each game's own "here". New challenges also arrive live by Realtime (`seat_b = me` on the three challenge tables), because a challenge only waits 30 to 60 s.
- **Banner (D1).** `src/components/ChallengeBanner.tsx`, in the hub shell (`Layout.tsx`), pupils only. Yes opens `/<game>?ask=<id>`, and the game says yes with its own step (`src/multiplayer/useAskFromHub.ts`, wired into ArcheryGame, LordPlay and ClanQuest). No goes through that game's own server step. Not now hides every challenge known then; the next new one shows. Never shows inside the game it's from. On hub pages it sits at the bottom; inside another game it sits at the top between the corner buttons, and on a phone it starts as a small "⚔️ Challenge!" tab. Read aloud with Kokoro af_bella clips (`public/voice/challenge/`, no names spoken).
- **Tests.** `supabase/tests/database/play_anyone_hub.test.sql` (32 checks: check-in rules, hidden and teacher not recorded, 75-second window, hub-only kids listed and challengeable in all three games, other schools and switched-off classes still refused, waiting list). `src/components/ChallengeBanner.test.tsx` (3 screen tests: shows + Yes, No + hidden in its own game, Not now until the next one) and the voice-lines test. Checked at phone, iPad and laptop sizes.

## Stage 3 results (20 Nov 2026)

Built on branch `claude/play-anyone-3`, migration `20261120000700_lobby_here.sql` (one new function, nothing changed).

- **One read.** `lobby_here()` (pupils only; hidden pupils and teachers get nothing back) gives `me` (my state in Archery fights, Dragon Maths clashes, Clan duels, Sky race and Village Raid: `ready`, `none` when there's no archer, hero, clan or island yet, or `off` when paused), `going` (my own fight, clash or duel that's waiting for a yes or being played) and `online` (kids with the hub or one of the three games open in the last 75 s, my class first; every stage 1 rule kept). Each kid gives only id, name, avatar, class flag and name, their clan's public id (only if I have a clan), and for each game I can play: `ok`, `none`, `off` (their class paused it) or `busy` (in a game, or snoozed my challenges). It records nothing; the Lobby reads it with the open games every 20 s.
- **The page** (`src/pages/Lobby.tsx`, parts in `LobbyFriends.tsx`), top to bottom: Challenges for you (Yes / No, from `useHubAsks`; the hub banner hides on `/lobby`); Your games (open board games plus my live fights with Carry on); Pick a game (tiles for Chess, Checkers, Wormholes, 101, Power Clash, Archery fight, Dragon Maths clash, Clan duel, Sky race, Village Raid; Star Forge not included); Start a game (shows under the tiles once a board game's tile is tapped); Open games; Who's here (search and class names from `SchoolPlayerList`; tap Play on a kid to see what you can play together, greyed ones say why); Join with a code (smaller, at the bottom).
- **Greyed tiles.** "Choose your archer first", "Make your hero first to battle your friends", "Start your clan first", "Build your island first", each with its fix button; "Your teacher has paused this." when a teacher switched it off, and for non-maths games in maths-only time. A live game I can't play myself shows only on its tile, not on every kid.
- **Challenging from the Lobby.** Goes through each game's own server step (`src/data/lobbyHere.ts` `sendChallenge`), so refusals show in the Lobby. Then it opens the game at its live screen: Archery opens its duel screen itself; Dragon Maths and Clan Quest take a new `?open=live` (and Clan Quest `?open=raid`, Sky Isles `?open=race`) through `useOpenFromHub` in `src/multiplayer/useAskFromHub.ts`.
- **Tests.** `supabase/tests/database/lobby_here.test.sql` (20 checks: who's listed and in what order, other schools / teachers / hidden never, "Play other classes" off, 75-second window, nothing private, my states, each kid's states, waiting challenge). Screen tests: greyed tiles with the right words and fix (`LobbyNonMaths.test.tsx`), challenge Yes and No, search and send (`LobbyFriends.test.tsx`). `LobbyPower` and `LobbyRequests` tests removed to stay within the `src/pages` budget (their bits are covered by the other Lobby tests and each game's own tests). Checked at phone, iPad and laptop sizes on made-up data.

