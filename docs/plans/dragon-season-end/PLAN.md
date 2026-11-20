# Dragon Maths: the end of a season (Season 1 → Season 2)

Asked for by James, 20 Nov 2026: "it should be epic and tell them all the details about what is happening, what is staying,
and what is resetting." Branch `claude/dragon-season-end`. Migration numbers from `20261120001800` (check again).

**Status:** plan written 20 Nov 2026. Nothing built yet.

## When it happens

Every class started season 1 on 18 Oct 2026 (the per-class dates are all the same; the whole-school date migration
`20261028000400` is not live and isn't needed for this). Seasons are 35 days long.

| NZ time | What happens |
| --- | --- |
| Fri 20 Nov (day 34) | Last school day of season 1 |
| Sat 21 Nov (day 35) | Last day of season 1 |
| Sun 22 Nov, 00:00 | Season 2 day 1. A hero resets on the pupil's first request after this |
| Mon 23 Nov | Most pupils see season 2 for the first time, at school |

**Hard deadline: stage 2 (saving each hero's season results) is live before Sun 22 Nov 00:00 NZ.** The reset (`shared/lord/server.ts`,
"A new season starts the hero again") overwrites the hero, and nothing else keeps this season's level, gold or masters.
`stats.bestLevel` is the best level over all seasons, so for season 1 only it would serve as a fallback, but masters,
forest wins and gear would be lost.

## James's answers (20 Nov 2026)

1. **Keepsake:** a Season Veteran trophy for everyone who played the season, and a gold "Season 1 Hero" line on their
   profile. No effect on the game.
2. **Art:** paint 2–3 new scenes on the gaming PC (ComfyUI). The game's own paintings stand in until they're done.
3. **Last chance:** yes, a "last chance" banner from today until the season ends.
4. **Slayer list:** whole school, pupils only (no teacher accounts, no hidden pupils), the double slayer crowned at the top.

## What stays and what starts again (the facts the screens show)

From `newHero` (`shared/lord/engine.ts`) and the reset in `server.ts`:

| Stays forever | Starts again |
| --- | --- |
| ⭐ Dragon stars (dragon kills over all seasons) | Level (back to 1) and experience |
| 🏆 Achievements (worked out from all-season counts) | Gold and the bank |
| 🏛️ The Hall of Heroes (season 1 is kept for good) | Gems |
| 🗡️ Trophies: Slayer's Sword, Dragon Head, Dragon Slayer's Crown | Sword and armour |
| 👑 Titles, including 🐲 Ultimate Dragon Slayer | Your hero class (you can pick a new one) |
| 🎨 Your hero's look | |
| 🎖️ New: the Season Veteran trophy | |

**New in season 2:** five more Dragon Head places for the first five pupils to slay the dragon; Slayer's Sword again (season 1
winners go up to silver); the Crown and Ultimate Dragon Slayer title again for two kills in one season; a fresh Warriors list.

## Stages

### Stage 1: last-chance banner (today, Fri 20 Nov)

- **Home page:** the Dragon Maths season strip (`DragonSeasonStrip`) gets a red "Last chance" ribbon on days 33–35:
  "Season 1 ends Saturday night! Last chance to slay the Red Dragon." Day 35: "Last day of Season 1! The season ends tonight."
- **In the game:** the season road's headline on day 35 says the same, plus a short "What happens next" link
  that opens the stays/starts-again table above, so nobody is surprised.
- **What's new box:** a line now: "🐉 Season 1 ends Saturday! Last chance to slay the Red Dragon. On Sunday every hero starts
  again, and your stars, trophies and Hall of Heroes stay forever."
- Pure text in `shared/lord/seasonRoad.ts` (`lastChance(clock)`), with tests. Website only, no migration.

### Stage 2: save every hero's season (live before Sun 00:00 NZ)

- Migration: table `lord_season_results (player, season, level, exp, gold, masters, forest_wins, arena_wins, dragons, class,
  saved_at)`, primary key `(player, season)`, RLS on, no direct access.
- A `before update` trigger on `lord_heroes`: when `new.season > old.season`, insert the old hero's results for `old.season`
  (`on conflict do nothing`). **No server function change or redeploy**, so it can't miss a reset however the function is
  deployed. It also catches a pupil who comes back several seasons later.
- The same trigger gives the **Season Veteran** trophy (`dm-veteran`, kind `trophy`, scope `season`: bronze for the first
  season played, silver for the second, gold after) to anyone whose old hero did something that season (at least one forest win
  or level 2). Hidden pupils and teachers get it too; it's not a race.
- `lord_season_summary()` for the signed-in pupil: their last finished season's row, which trophies they won in it, and
  the whole-school slayer list for that season (hub name, avatar, kills, pupils only, the most kills first, then the earliest).
- Database test on a scratch copy: a reset writes one row and gives the trophy; a second save in the same season writes
  nothing; a pupil with no forest wins gets no trophy; teachers and hidden pupils are left off the slayer list.
- Merge and check live **before Saturday night**: the table exists, the trigger is on, `lord_season_summary()` answers.

### Stage 3: the ceremony (live by Mon 23 Nov, 8:45)

On the first visit of a new season (the hero has `classOpen`, no forest wins and no experience, and a
`lord_season_results` row exists for the season before), the game opens a full-window ceremony before the village. Five
pages, Next and Back buttons, Bella reads each page (Kokoro af_bella clips), and "Skip" on every page:

1. **"Season 1 is over!"** Banners and a fanfare. "35 days. 8 dragon slayings. Here are the heroes of Season 1."
2. **The Hall of Heroes.** The whole school's slayers on a scroll, one by one, with avatars. The double slayer crowned at the
   top with "🐲 Ultimate Dragon Slayer". "Your name could be here in Season 2."
3. **Your Season 1.** The pupil's own card: class, the level they reached, masters beaten, forest wins, dragons slain, and the
   trophies they won this season, with the new **Season Veteran** trophy landing in the middle. A pupil who never played sees
   "Season 2 is your chance to start your story."
4. **What stays, what starts again.** The two-column table above, with icons, and "Your stars stay forever."
5. **Season 2 begins!** What's new in season 2 (five new Dragon Head places, Sword, Crown), then the big button "Pick your
   hero" into the class choice.

Then, the same day:
- **Home page:** the season strip says "⚔️ Season 2 has begun! Everyone starts again at level 1." for days 1–3, with
  "Open Dragon Maths".
- **What's new box:** "🌅 Season 2 has begun! Every hero starts again. See the Season 1 Hall of Heroes in Dragon Maths."
- **Profile:** the gold "Season 1 Hero" line for veterans, from their `dm-veteran` trophy (no new data).
- **The Hall of Heroes page** gets a "Season 1" heading and the crown beside the double slayer.
- The ceremony can be seen again from the Hall of Heroes ("Watch the Season 1 ceremony").
- Preview: `preview/lord?ceremony=1` with made-up results, for screenshots at phone, iPad and laptop sizes.

### Stage 4: painted scenes (when the gaming PC is free)

Three ComfyUI paintings in the game's style, the stand-ins swapped out with the same file names:
- **Hall of Heroes with banners**, for pages 1–2 (Season 1 slayers).
- **Scorchtail asleep in the lair** as the season turns, for page 4.
- **Dawn over the village**, for page 5 ("Season 2 begins").

## Not doing

- No head start or carried-over gold (James chose the badge only).
- No change to season length or the whole-school season date.
- No teacher-page changes. A one-line note on the teacher's Dragon Maths drawer could come later.
