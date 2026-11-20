# Clan Quest: the end of a season (Season 1 → Season 2)

Asked for by James, 20 Nov 2026: "plan similar for clans", the same shape as the Dragon Maths season end
(`docs/plans/dragon-season-end/PLAN.md`, on branch `claude/dragon-season-end`). Branch `claude/clans-season-end`.
Migration numbers from `20261120001900` (check again: Dragon Maths took `...001800`).

**Status:** plan written 20 Nov 2026 (#659). Stage 1 built 20 Nov. Stage 2 next (before Sat night).

## When it happens

Clan Quest's season clock reads Dragon Maths' school date (`clan_school_season`), so **both games end on the same night**.
Live on 20 Nov: school 1, `lord_season_start` 18 Oct, `clans_clock_from` 30 Oct, clock on, season 1, day 34, 1 day left.

| NZ time | What happens |
| --- | --- |
| Fri 20 Nov (day 34) | Last school day of season 1. Monster week (Grimmor) |
| Sat 21 Nov (day 35) | Last day of season 1 |
| Sun 22 Nov, 00:00 | `clan_nightly` (cron 11:00 UTC) sets **every clan's fame to 0** and moves the school to season 2 |
| Sun 22 Nov, first visit | The server's `newSeasonSave` resets the clan: members back to level 1, gold, buildings, gear |
| Mon 23 Nov | Most pupils see season 2 for the first time, at school |

**Hard deadline: stage 2 (saving each clan's season) is live before Sun 22 Nov 00:00 NZ.** Fame goes first, at midnight,
inside `clan_nightly`; the member levels, buildings and gold go on the pupil's first request after that. Today only
`clan_hall` keeps anything about a season (village finished, monster beaten, tries), so the fame table, member levels and the
"who was top" story are lost unless they are saved first.

## Season 1 so far (live, 20 Nov)

- 44 clans, 41 pupils played in the last 14 days, 26 clans with fame.
- Grimmor beaten by **one clan, a teacher's** (Iron Shields). Five pupil clans have had one try each, none won yet.
- One village finished (the same teacher clan). Top pupil clans by fame: Swift Falcons 321, Clever Rangers 210, Bold Foxes 133.
- So the honour roll can't only be "monster beaters": it would be empty of pupils. It is the **fame table** (below), with
  monster beaters and finished villages marked.

## James's answers (20 Nov 2026)

He chose the recommended answer each time, and to build stages 1 and 2 now. Holidays: "just push on" (no clock change).

1. **Keepsake:** a **Clan Veteran** trophy for every clan that played the season, and a gold "Season 1 Clan" line on the
   profile. No effect on the game.
2. **Honour roll:** the whole school's **top 10 clans by fame** at the season's end (pupils only, no teacher accounts, no
   hidden pupils), with 🦷 by any clan that beat Grimmor and 🏰 by any that finished its village. The top clan gets a
   gold "Season 1 Champions" banner on the scroll.
3. **Last chance:** yes, a red "last chance" ribbon today and tomorrow.
4. **Art:** 2–3 new paintings on the gaming PC; the game's own paintings stand in until they're done. Plus Craghold (below).

## What stays and what starts again (the facts the screens show)

From `newSeasonSave` (`shared/clans/season.ts`) and `clan_nightly`:

| Stays forever | Starts again |
| --- | --- |
| 🛡️ Your clan's name, banner and members' names and looks | Every member back to level 1, tier 1 gear |
| 🏆 Achievements (from all-season counts, the `stats` column) | Gold (back to the starting purse), followers |
| 🏛️ The Hall of Legends (season 1 is kept for good) | Fame (everyone back to 0, a fresh table) |
| 🦷 Trophies: Monster Tooth, Clan Banner | Buildings: Training Hall, Smithy, Church and the village walls |
| 👑 Quest rewards: titles, frames, rename scrolls | Monster supplies and monster tries |
| 🎖️ New: the Clan Veteran trophy | Your members' race and class (you may pick again, until you play) |

**New in season 2:** a new monster, **Old Craghold the Stone Golem** (`monsterOf(2)`), from day 29 (Sun 20 Dec, probably after
school breaks up: see "Not doing"); a fresh fame table; Monster Tooth and Clan Banner can be won again.

(Every line above is checked against the code when stage 3 is built; anything that isn't true is dropped, not reworded.)

## Stages

### Stage 1: last-chance ribbon (today, Fri 20 Nov)

- **Clan Quest season road** (`seasonRoad` in `shared/clans/season.ts`): day 34 and 35 headlines say it straight:
  "**Last chance!** Season 1 ends Saturday night. One more try at Grimmor today." Day 35 already reads "Last day of the season!"
  Add a small "What happens next" link that opens the stays/starts-again table.
- **Home page** (`SeasonStrip`): the same red "Last chance" ribbon as Dragon Maths on days 33–35.
- **What's new box:** "🛡️ Clan Quest Season 1 ends Saturday! Last chance to beat Grimmor. On Sunday every clan starts again,
  and your trophies, achievements and the Hall of Legends stay forever."
- Pure text in `shared/clans/season.ts` (`lastChance(clock)`), with tests. Website only, no migration.

### Stage 2: save every clan's season (live before Sun 00:00 NZ)

- Migration: table `clan_season_results (player, season, school_id, clan_name, fame, fame_rank, gold, followers, members
  jsonb [name, race, class, level], village jsonb, monster_beaten, village_done, saved_at)`, primary key `(player, season)`,
  RLS on, no direct access.
- **The save:** a `before update of fame` trigger on `clans`. When `clan_nightly` zeroes fame for a new season, the school's
  `clan_school_seasons.season` is still the old one and `clan_school_season(school).number` is the new one; then the trigger
  saves that clan's row for the old season (`on conflict do nothing`), reading the members from `clan_members` and buildings
  from `clan_empires`, which are not reset until the pupil's next request. **No change to `clan_nightly` or the server
  function**, so the order inside the nightly job doesn't matter. `fame_rank` is filled afterwards by the same migration's
  `clan_season_rank(school, season)`, called from an `after update` statement trigger on `clan_school_seasons`.
- **Clan Veteran** trophy (`clan-veteran`, kind `trophy`, scope `season`: bronze for the first season, silver for the second,
  gold after) for any clan that did something that season: fame above 0, or a member above level 1. Teachers and hidden pupils
  get it too; it's not a race.
- `clan_season_summary()` for the signed-in pupil: their clan's last finished season, the trophies won in it, and the school's
  top 10 by fame (pupils only, hub name, clan name, banner, fame, 🦷/🏰 marks).
- **Fallback if stage 2 misses midnight:** member levels are still there until each pupil's first visit, and `clan_hall` has
  the monster and village; only fame is lost. A one-off `clan_news`/`clan_scores` check can rebuild it if they hold it. Don't
  count on it.
- Database test on a scratch copy (see the local-db note: build from all migrations, colima first): a nightly season move writes one
  row per clan and gives the trophy; running the nightly again writes nothing; a clan with 0 fame and level-1 members gets no
  trophy; teachers and hidden pupils are left off the top 10; the existing `clan_nightly` still resets fame.
- Merge and check live **before Saturday night**: the table exists, the trigger is on, `clan_season_summary()` answers.

### Stage 3: the ceremony (live by Mon 23 Nov, 8:45)

On the first visit of a new season (the response has `newSeason: true`, or the clan has `repick === season` and a
`clan_season_results` row for the season before), Clan Quest opens a full-window ceremony before the town map. Five pages,
Next and Back, Bella reads each page (Kokoro af_bella clips), "Skip" on every page:

1. **"Season 1 is over!"** Banners over the town. "35 days. 44 clans. Grimmor the Storm Giant came, and here's what happened."
2. **The Hall of Legends.** The school's top 10 clans by fame on a scroll, one by one with their banners; the top clan crowned
   "Season 1 Champions"; 🦷 and 🏰 marks. "Your clan could be here in Season 2."
3. **Your clan's Season 1.** Their four members with the level each reached, the clan's fame and place, buildings built, monster
   tries and win, with the new **Clan Veteran** trophy landing in the middle. A clan that never played sees
   "Season 2 is your clan's chance."
4. **What stays, what starts again.** The two-column table above, with icons.
5. **Season 2 begins!** Craghold the Stone Golem is coming in monster week. Then the big button "Pick your clan again" into the
   existing Repick screen (or "Keep my clan").

Then, the same day:
- **Home page:** the season strip says "🛡️ Clan Quest Season 2 has begun! Every clan starts again." for days 1–3.
- **What's new box:** one line for both games: "🌅 Season 2 has begun in Dragon Maths and Clan Quest! See who made the Season 1
  Halls."
- **Profile:** gold "Season 1 Clan" line from the `clan-veteran` trophy (no new data).
- **The Hall of Legends** (`Hall.tsx`) gets a "Season 1" section with the fame top 10 under the monster and village winners,
  and "Watch the Season 1 ceremony".
- Preview: `preview/clans?ceremony=1` with made-up results, screenshots at phone, iPad and laptop sizes.
- **Both ceremonies on the same morning:** they're separate games, so each opens only inside its own game. Keep each short
  (five pages, Skip on every page).

### Stage 4: painted scenes and Craghold (when the gaming PC is free)

Three ComfyUI paintings in the Clan Quest style, stand-ins swapped out with the same file names:
- **The town square with clan banners**, for pages 1–2.
- **Grimmor walking away over the hills at dusk**, for page 4.
- **Dawn over the village, a rumbling hill in the distance** (Craghold coming), for page 5.

**Craghold's own art is needed before season 2's day 22 (Sun 13 Dec), when supplies go on sale and the road shows his portrait:**
`art/season-monsters/` has only the giant today (`stone-golem.webp` in `art/monsters` is a small mines monster). Paint his arena,
full figure, boulder and 5 story pages with `python3 scripts/game_art.py clans-monster paint ...`, like Grimmor (#510).

## Not doing

- No head start or carried-over gold (same as Dragon Maths: keepsake only).
- No change to season length or dates. Season 2's monster week (20–26 Dec) probably falls after school breaks up; whether to pause the
  clock over the holidays is a separate question for James.
- No teacher-page changes.
