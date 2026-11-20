# Ultimate Dragon Slayer

**Status:** LIVE 20 Nov 2026 (#653, migration `20261120001700_ultimate_dragon_slayer.sql`). Crown painted 20 Nov 2026 (try 1 of each metal, from the second set of prompts).

James, 20 Nov 2026: "add this as a new achievable title, achievement and trophy, if you manage to kill the dragon twice in
one season." The title started as a one-off, hand-given special title for Bubbly Bear 1 (#652).

## What a pupil wins

Slaying the Red Dragon in Dragon Maths a **second time in the same dragon season** gives, in the same save:

| Reward | What | Notes |
|---|---|---|
| Achievement | 🐲 **Ultimate Dragon Slayer**: "Beat the Red Dragon twice in one season." | tier 3; measure `lord_season_kills` (most kills in any one season) |
| Trophy | **Dragon Slayer's Crown**: "Slay the dragon twice in one season." | won each dragon season: bronze, then silver, then gold, like the Slayer's Sword |
| Hero Title | 🐲 **Ultimate Dragon Slayer** (gold) | owned for good; worn straight away the first time; never on the quest-reward list |

Teachers and hidden pupils win them too (no race, unlike the Dragon Head). Seasons are the dragon's own (`lord_hall.season`).

Already earned on 20 Nov 2026: Bubbly Bear 1 (2 kills in season 1), back-awarded by the migration.

## How it works

- `lord_hall.kills` already counts dragon wins per player per season; `lord_commit` updates it on every win.
- A second trigger on `lord_hall` (`lord_hall_double`) calls `lord_give_double(player, season)` when kills reach 2.
- The achievement counts come through the game hooks: `hub_games.counts_fn = dragon_maths_counts(uuid)`.
- The title is in `SPECIAL_TITLES` (`shared/quests/titles.ts`) and `special_title_ids()` (`20261120001600`).

## Art (paint later on the gaming PC)

Only the trophy needs painting; the achievement and title use the 🐲 emoji.

- **Dragon Slayer's Crown**, three metals: `dragon-crown-bronze`, `-silver`, `-gold` in `docs/profile-art/config.json`
  (folder `trophies`, 512 px plus a 160 px `-small`), the same metal wording as the Slayer's Sword so they sit together
  on the shelf. Shape: a crown of curved dragon horns and scales, a dragon's head on the front breathing a little flame,
  on a small cushion.
- Painted 20 Nov 2026. The first prompts put a dark figure inside the crown; "an empty royal crown ... nobody wearing it" fixed it.
- When painted: drop the six files in `src/avatar/art/trophies/`, add `'dm-crown': 'dragon-crown'` to `TROPHY_ART` in
  `src/avatar/paintedArt.ts`, and record the picks in `docs/profile-art/picks.json`.
