# Teacher controls review: turning things on and off

*Review only, 11 November 2026, from `main` at d56c7e3, a teacher preview with a made-up class ("Room 12"), and read-only
queries on the live database. No code was changed. Screenshots and mock-ups are in the project files folder
`teacher-controls/`. The step-by-step plan with copy-ready prompts is also on the "Teacher Controls Plan" artifact page:
https://claude.ai/artifact/R6ymA5r5baTrTtZG2aCxyZ*

## Summary for James

- **The server side is solid.** Every save is checked: only a teacher of that class (or a school admin) can change it, pupils
  can only read their own class's row, and every game with a switch checks it on the server on every request, so a pupil can't
  get round a switch by keeping a page open.
- **But a teacher can't see what's on at a glance.** The game switches are a 30-row table on the Games tab, with no count, no
  filter and no way to switch a whole section. "Unlimited turns today", "Non-maths games" and "Training before games" live on
  the Today tab instead, and season resets sit at the bottom of the Students tab.
- **Some rows tell the teacher the wrong thing.** Chess, checkers, 101 and Power Clash say "always" but are switched by
  "Non-maths games" on Today. Kingdom Keeper has a working switch, but pupils can't see the game at all. Gem Keep, Marble Rush and
  Wormholes can't be switched off.
- **Changes are slow to reach pupils.** A pupil's home page remembers the class settings for up to 5 minutes, so a game the
  teacher just turned on may not appear until the pupil reloads. Nothing tells the teacher that.
- **Two quiet risks.** A save with no class named changes *every* class the teacher has (for a school admin: every class in the
  school plus the defaults for new classes). Today's pages always name the class, but nothing stops it. And bot games of chess
  and checkers still save and score while "Non-maths games" is off.
- **Missing:** a section on/off, saved "game sets", who changed what, school defaults for new classes, and games for one group or
  pupil. The plan below is 9 cards, C1 to C9, small fixes first.

## 1. What teachers can control now

The teacher area is `/teacher/:classId` with tabs **Today, Progress, Students, Maths, Games, Class set-up** (plus **Admin** for
school admins). Every switch saves the moment it changes, shows "Saved ✓" for 2 seconds, and goes back if the save fails
(`src/teacher/Settings.tsx`). All class settings are one row per class in `app_settings` (72 columns); a new class copies the
school's default row (`give_class_settings`).

**How fast a change shows:** the server sees it at once, so the next request from a pupil is checked against the new value
(a game turned off refuses the next save or turn). The pupil's *screen* reads the settings once and remembers them for 5 minutes
(`src/data/settingsMemory.ts`), so a card appears or disappears on the pupil's home page within 5 minutes, or straight away if
they reload. A teacher's own screen re-reads the class's row each time.

### Today tab

| Control | What it changes for pupils |
|---|---|
| Games against friends | Off stops new games between pupils; bot games carry on. |
| Emoji reactions | Reactions in Wormholes games with classmates (also in the Wormholes drawer). |
| Non-maths games | Hides chess, checkers, 101 and Power Clash; games already going wait. |
| Training before games | One Basic facts session before any game opens, then games stay open for some hours. |
| Skip button | Whether pupils can skip a maths question (on / limited / off). |
| Unlimited turns today (6 switches) | Lifts the daily limit until NZ midnight for Dragon Maths, Clan Quest, Maths Monsters, Diamond Drop, Star Trader, Sky Isles. Extra turns earn no hub points. |
| Maths focus ("This week") | Sets a maths focus for the class, a group or some pupils, for a length of time. |

### Games tab (one row per game, grouped like the pupils' home page)

- **On column:** 23 games have an on/off switch for the class: Dragon Maths, Clan Quest, Maths Monsters, Bond Match, Mine
  Runner, Archery, Kingdom Keeper, Royal Decree, Star Trader, Diamond Drop, Sky Isles, Toon Flap and all 11 Foundational games.
  7 say "always": chess, checkers, 101, Power Clash (really switched by Non-maths games), Wormholes, Gem Keep and Marble Rush.
- **Maths column:** a 3-way maths switch (Off / Students choose / On for everyone) for Wormholes, Marble Rush, Mine Runner and
  Star Trader; a one-line summary for the rest.
- **Settings ›** opens a drawer (laptop) or page (iPad portrait, phone) with the game's own settings and class report:

| Game | Its own settings |
|---|---|
| Dragon Maths | Forest fights a day, topics on, season start and holiday pause (whole school, admin only) |
| Clan Quest | Made-up hero names, year band, topics, times tables, mine fights a day, raids on classmates |
| Maths Monsters | Topics on |
| Gem Keep | Question kind, times tables, missing numbers, division, how pupils answer, Level Key pass mark |
| Star Trader | Jumps a day, Bank, pupils can type names in the Forge |
| Sky Isles | Sky Races |
| Archery | Classmate fights |
| Marble Rush | Rescue questions |
| Toon Flap | Maths in flight, read time at answer signs |
| Wormholes | Emoji reactions |
| 8 Foundational games | Help: Fades / Always on / Off (called Picture, Mat, Branch, Counting or Garden help) |
| Pipi, Hop, Kiwi's Beanstalk | One on/off help: Help in the sand, Step labels, Dots on the leaves |
| Diamond Drop, Bond Match, Mine Runner, Royal Decree | Report only (Diamond Drop can send a pupil back to level 1) |

### Other tabs

- **Maths:** maths focus, pupils choose their own focus, auto maths for pupils with no focus, skipped questions, hardest
  questions, Foundational skills.
- **Students:** hide real names (this computer only), pupil pages (rename, hide, move class, make teacher, delete), badge sheet,
  and "Seasons and end of year" (season resets for Dragon Maths and Clan Quest).
- **Class set-up:** class name, Class Warp code and whether it is open / asks first / off, join requests, groups and their codes,
  members, teachers, end of year (archive).
- **Admin** (school admins): overview, classes, students, teachers and roles, end of year.

Pictures: `now-today-laptop.jpg`, `now-today-ipad.jpg`, `now-games-laptop.jpg`, `now-games-ipad.jpg`, `now-drawer-laptop.jpg`,
`now-drawer-clans-laptop.jpg`, `now-setup-laptop.jpg`.

## 2. Is it easy?

The test: a busy teacher switches a game on or off for their class in a few taps, and sees at a glance what is on right now.

- **Switching one game: good.** Games tab, find the row, one tap. 2 taps from Today.
- **Seeing what's on: poor.** 30 rows, about 3 laptop screens or 5 iPad screens, with no "17 of 30 on" and no way to show only
  the games that are on. A teacher who wants "only Foundational games today" makes up to 23 taps.
- **Scattered.** Game on/off is on Games, but "Unlimited turns", "Non-maths games" and "Training before games" are on Today,
  season resets are on Students, and Emoji reactions is in two places. A teacher looking for "can my class play chess?" finds
  "always" on the chess row, which is wrong when Non-maths games is off.
- **Inconsistent words.** The same 3-way help choice has five names (Picture, Mat, Branch, Counting, Garden help); three games
  have a plain on/off help instead. Some "?" texts are a 150-word paragraph (Pipi's), others one line.
- **Can't tell what a switch did.** "Saved ✓" doesn't say pupils may not see it for 5 minutes, and nobody can see who changed a
  switch or when (two teachers on one class, or a school admin, can change it without the other knowing). A school admin looking
  at another teacher's class sees "(not mine)" in the header, but the switches give no warning.

## 3. Is it right and safe?

Checked on the live database (functions and policies) and in the code.

| Check | Result |
|---|---|
| Pupils can't change settings | **Yes.** `app_settings` has only a read policy, for the pupil's own row. Every `teacher_set_*` function starts with `require_teacher()`. |
| One teacher can't change another's class | **Yes.** `settings_to_change(target_class)` only returns a class the caller teaches (`teaches_class`), and `require_settings_target` refuses otherwise. School admins can change every class, on purpose. |
| A save with no class named | **Risk.** `target_class` null changes every class the teacher teaches, and for a school admin every class in the school plus the school's defaults row. No page sends null today (all 43 save functions pass the class), but the default `classId ?? null` would. |
| Each switch is checked on the server | **Yes** for all 23 game switches: 20 in their edge functions (via `settings_of`), Dragon Maths, Clan Quest and Maths Monsters in their SQL load functions. Non-maths games is checked in the friend, card and Power Clash functions. |
| Non-maths games covers bot games | **No.** `save-bot-game` doesn't read `non_maths_games`, so chess and checkers against a bot still save and score points while it is off (the page is hidden, but an open tab still saves). |
| Achievements and points hide with the switch | **Mostly.** `hub_games.switch_column` is set for the 20 newer games; Dragon Maths, Clan Quest and Maths Monsters do it in `progress_rules`. Chess, checkers, 101 and Power Clash have no switch column, so their achievements still show while Non-maths games is off. |
| A switch for every game | **Kingdom Keeper**: switch works, but the game's code switch is off, so pupils never see it. **Gem Keep, Marble Rush, Wormholes**: no way to switch them off. |
| Leftovers | `trader_forge` (Star Forge on/off) has a save function but no switch on any page. `unlimited_days` keeps old dates (harmless, ignored). |
| New games get a sensible default | **Unclear rule.** The guide says a new game's switches start **off**, but the 15 newest games' columns default to **on** and the school's defaults row is all on, so a new game goes on for every class the day it ships. Older columns default off. New classes copy the school row, which no page can change. |
| Unlimited turns list | Kept in two places by hand (`shared/unlimited.ts` and the list inside `teacher_set_unlimited_today()`); they match today. |

## 4. What's missing

| Control | Worth it? |
|---|---|
| Whole section on or off (all Foundational games, all No maths) | **Yes, soon.** The biggest saving in taps. |
| "What's on" count and filter on the Games tab | **Yes, soon.** |
| Unlimited turns in the game's row, not only on Today | **Yes**, with a shortcut kept on Today. |
| Who changed a switch, and when | **Yes.** Two teachers on a class, or an admin, need it. |
| School defaults for new classes, and the rule for a new game | **Yes.** It was already next on the teacher view plan. |
| Saved "game sets" (Maths only, Foundational, Everything) with one tap | **Yes**, once sections exist. |
| Games for one group or some pupils | **Later, maybe.** Groups exist (Class set-up, maths focus), but every game's server check would change. Large. |
| Timed switches ("on until 3 pm", "school hours only") | **Not now.** Unlimited turns already ends at midnight; a timed switch touches every game's server check. |
| A starting step for a pupil in a Foundational game | **Not here.** The games move pupils on from their maths records; it belongs with the Progress tab. |
| Controls that could go | The Kingdom Keeper row (until it comes back), the second Emoji reactions switch, and the unused `trader_forge` save function (or give it a switch: C1 does). |

## 5. The plan, in priority order

The full cards (steps, files, tests, prompt) are in [docs/plans/teacher-controls/](plans/teacher-controls/HANDOVER.md) and on
the plan page.

| # | Card | What it gives the teacher | Size |
|---|---|---|---|
| C1 | Fix the rows that say the wrong thing | Chess, checkers, 101 and Power Clash show the real Non-maths switch; Kingdom Keeper's row goes; Star Forge gets a switch; bot games stop scoring while Non-maths is off | S, database |
| C2 | Safer saves | A save must name its class; nothing can change every class by mistake | S, database |
| C3 | Pupils see changes straight away | Home page re-reads switches when opened; "Saved ✓ Pupils see it now" | S |
| C4 | Games tab: what's on at a glance, whole sections | "17 of 30 on", Show All / On / Off, a switch per section, Unlimited today in the row (`mock-games-on-now-*.jpg`) | M, database |
| C5 | Same words everywhere | One name for help ("Help: Fades / Always on / Off"), one-line "?" with "More", Emoji reactions in one place | S |
| C6 | Who changed it | "Changed by you, 9:12am" under each switch and a Recent changes list on Class set-up | M, database |
| C7 | School defaults and new games | Admin → New class settings; a new game's switch starts on for every class (James's choice) | M, database |
| C8 | Game sets | Saved sets on Today, "Use now" in one tap (`mock-game-sets-laptop.jpg`) | M, database |
| C9 | Guide and close | The game development guide says what a new game's switch needs; check live and close | S |

Later, only if James wants it: **Who can play** (games for some groups or pupils, `mock-who-plays-laptop.jpg`), size L.

## Decisions for James

Answered on question cards in the review thread:

1. **A new game's switch:** James chose **on for every class** (11 Nov 2026), as now. C7 makes every switch column default on
   and changes the guide to say so.
2. **Who can play (groups or pupils):** James chose **later** (11 Nov 2026). It stays off the plan; the mock-up and notes stay here.

## After (12 Nov 2026 NZ): all nine cards live

| Card | PR | What teachers have now |
|---|---|---|
| C1 | #420 | Chess, checkers, 101 and Power Clash rows use the Non-maths games switch; Kingdom Keeper's leftover switch gone; Star Forge has a switch; bot games refuse while Non-maths games is off |
| C2 | #421 | Every save names a class; a save with no class is refused ("Pick a class first.") |
| C3 | #423 | Pupils' home page re-reads settings after 30 seconds away; "Saved ✓" says when pupils see it |
| C4 | #424 | Games tab: "On for <class>: N of M games", Show All/On/Off, section All on / All off in one save, Unlimited today column |
| C5 | #422 | Same words for the same thing; long About text folds behind "More" |
| C6 | #425 | "Changed by you, 9:12am" under switches; Recent changes on Class set-up (table read only through its function) |
| C7 | #426 | Admin → New class settings edits the school's defaults; Copy to every class; every game switch column defaults on |
| C8 | #427 | Game sets on Today: Maths only, Foundational, Everything and the teacher's own sets, one tap |
| C9 | this PR | One "teacher switch" rule list in [docs/game-guide/3-files-and-clashes.md](game-guide/3-files-and-clashes.md) |

Live check (database, 12 Nov 2026): migrations 20261112000200 to 600 applied; the new functions exist; every `hub_games.switch_column`
defaults to true; one school defaults row. Not checked live in a teacher's browser: nobody signed in as a teacher here, so James's
first look at the Games and Today tabs is the browser check.

