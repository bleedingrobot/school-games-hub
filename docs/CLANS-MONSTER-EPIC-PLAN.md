# Clan Quest: the season monster, made epic

16 Nov 2026. Monster week (Grimmor the Storm Giant this season) was live but:

1. **Clans could fight many times a day.** The season keys (`season`, `monster`, `bossWins`, ...) were never saved, so
   `lastDay` was always 0. Fixed by #504: `clans.extras` and `clan_fights.monster` columns, saved and loaded by
   `save_clan` / `load_clan`. Live 16 Nov.
2. **A loss didn't say what happened.** `MonsterResult` now says "You fought Grimmor off! But Grimmor is not beaten yet",
   shows his strength left (`MonsterOutcome.left`, new), how much weaker he'll be tomorrow, and the days of monster week left.
3. **The fight looked like any mine fight.** `BossStage.tsx`:
   - an entrance (sky darkens, the giant rises, his name slams in, "{clan}, to battle!");
   - a long strength bar across the top (siege damage shown as already knocked off, a trail that catches up after hits);
   - a tall arena with the battlefield painting, rain and lightning (dust for the golem, snow for the troll);
   - the monster huge in the middle, shaking when hit, glowing red before the big move, lunging when it lands;
   - the boulder flying in and the screen shaking on the big move.
   Reduced motion: no shaking, flashing or flying.
4. **No reward story.** `MonsterStory.tsx`: five painted pages clicked through, opened the first time a clan wins, and
   again from the result and the Monster screen. Words in `monsterStoryPages.ts` for all three monsters.

## Art (painted on the gaming PC, docs/clans-monster-art/config.json)

Each picture has a drawn stand-in, so the code works before the paintings exist.

- `season-monsters/<kind>-full` (cut-out), `arena-<kind>` (battlefield, no monster in it), `boulder`,
  `story-<kind>-1..5`. Golem and troll also get a portrait and siege picture.
- Giant first (this season). Golem and troll before their seasons.

## Status

- [x] #504 one fight a day + season keys saved (live 16 Nov)
- [x] Big fight, lose message, story (code)
- [ ] Giant paintings
- [ ] Golem and troll paintings
