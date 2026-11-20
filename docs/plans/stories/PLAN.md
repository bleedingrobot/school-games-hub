# Story pictures for the older-pupil games

21 Nov 2026. James: "What other games could do with story pictures? Make a plan like Clans and Lord, draw all the art, and start adding. Make sure they are skippable: intro stories for each Goblin Storm hero, opening stories for Star Trader, Clans and Dragon Maths, a story-based challenge in games like Gem Keep. What other games could have stories that then progress as a playable narrative? Not the Foundational games."

**Status:** plan written (ST.0). Next: ST.1, the shared story book.

## 1. What we have now

- **Clan Quest** has the only real story: five painted pages when a clan first beats the season monster (`MonsterStory.tsx`, words in `monsterStoryPages.ts`). It has Back and Next but no Skip button, and is only for that one moment.
- **Dragon Maths** has two lines of story inside How to play, and a one-line intro for every monster and master.
- **Clan Quest daily quests** and **Maths Monsters quests** have story words but no story pages.
- Every other older-pupil game has no story at all.

## 2. The rules for every story

1. **Always skippable.** A **Skip** button is on screen from the first page (and Escape). Skipping counts as seen. A story never stands between a pupil and play for more than one tap.
2. **Shown by itself once per pupil**, at the right moment (first open, first time a hero is picked, first time a level is reached). Remembered **on the server**, so it does not come back on another Chromebook.
3. **Always there to watch again:** every game with stories gets a **📖 Stories** shelf listing the stories the pupil has unlocked, greyed "?" for ones still to come. Reaching a new one is a small reward in itself.
4. **Short pages.** 3 to 6 pages a story, at most about 35 words a page, one painting a page. Ages 8 to 11: brave, funny, warm. New Zealand flavour where it fits.
5. **Kept out, as in Dragon Maths (James, 18 Oct):** romance and orphans. Monsters are driven off, tricked or made friends with, never killed on the page.
6. **Read to me:** a 🔊 button reads each page in Bella's voice (clips made on the Mac; the browser's voice until then). Off by default.
7. **Reduced motion:** no slow zoom or page slide.
8. **Never in the way of the maths:** stories never hide or delay a question, and a pupil's maths is never mentioned in a story.
9. **Pictures:** one 16:9 painting a page (1536 × 864, an 800 px copy), painted in ComfyUI on James's gaming PC through `scripts/game_art.py`, one config a game in `docs/stories-art/<game>.json`. Each page has a drawn stand-in (a sky and emoji), so every story goes live before its paintings.

## 3. The shared parts (ST.1)

- **`StoryBook`** in `src/kit/` (lifted from Clans' `MonsterStory`, with Skip added): full-window pages; painting, title, words; Back, dots, Next / "The end"; **Skip** top right; 🔊 Read to me; arrow keys, Enter, Escape. Takes `pages: { title, text, art?, standIn: { emoji, sky } }[]`, a `label`, and the game's clip folder. No game words in it.
- **`StoryShelf`** in `src/kit/`: the 📖 Stories list (unlocked, seen, still to come), opens a `StoryBook`.
- **`useStories(game)`**: loads which stories this pupil has seen, `markSeen(id)` (saved at once, play never waits), `shouldShow(id)`.
- **Database:** `story_seen` table (pupil, story id like `trader-opening`, when); `my_stories_seen()` and `mark_story_seen(story)` for signed-in school pupils on their own row only (the same way as `mark_chess_looks_seen`). Nothing here counts towards points or rewards, so the browser may say "seen".
- Clans' `MonsterStory` moves onto `StoryBook` (gets Skip) when Clans is next touched (ST.2).

## 4. Opening stories (ST.2): Clans, Dragon Maths, Star Trader

Shown the first time a pupil opens the game, before anything else; then on the Stories shelf and from How to play.

**Clan Quest: "The Valley of Clans"** (6 pages). The valley's old clans have scattered; the empty village waits; you gather four heroes; the mines glow with treasure; the six kingdoms watch from their hills; and every season, something big wakes in the mountains. "Build. Train. Be ready."

**Dragon Maths: "The Night the Lights Went Out"** (6 pages). A village of lanterns; Scorchtail the Red Dragon swoops down and steals the treasure, the food and every light; the village sits in the dark; Old Fern finds the masters' old training hall; a young hero (you) picks up a wooden sword; the long road through the forest to the lair.

**Star Trader: "A Moon of Your Own"** (6 pages). You're given a tiny, rattly ship called the Flea; Bolt the robot clanks aboard as your helper; 24 planets, each with its own rulers and prices; buy low, sell high; pirates lurk between the stars; somewhere out there is a moon for sale, 20,000 credits, yours if you can earn it. The pupil's chosen captain's face appears in a corner of pages 1 and 6.

**Clan Quest monster arrivals** (3 pages each, Grimmor, Craghold, Frostjaw): shown when monster week starts ("The ground shakes… the giant wakes"). The win stories already exist.

## 5. Goblin Storm (ST.3)

- **Opening, "The Goblin Storm"** (4 pages): a green storm rolls over Castle Fields; goblins pour out of it; the castle bell rings for heroes; "How long can you last?"
- **A story for each of the 8 heroes** (3 pages each, 24 in all), shown the first time a pupil picks (or unlocks) that hero. Each tells who they are and why they fight, and ends on their weapon:
  - **Knight**: the castle's last guard, too stubborn to run; her blades were her grandmother's.
  - **Ranger**: grew up in the Dark Forest; the forest itself (leaves, hawks, wasps) fights with him.
  - **Wizard**: a junior wizard who set the library on fire once; now the fireballs go where she points.
  - **Barbarian**: from the Frozen Peaks; gets stronger the crosser he gets, and goblins make him very cross.
  - **Cleric**: tends the graveyard chapel; heals every hero she passes.
  - **Rogue**: stole a goblin king's crown for a joke; now the goblins are after her, and she's too fast to catch.
  - **Frost Witch**: lives alone on the peaks with her snow owls; anything near her slows to a shiver.
  - **Dragon Kid** (secret): a small dragon who wants to be a hero, not a monster.
- **Map arrivals** (1 page each, 5): the first run on each map. **Boss beaten** (1 page each, 5): the boss runs off with its tail between its legs; the next map opens.

## 6. Playable narratives: stories you play your way through

A story is told in chapters, and **playing is how you turn the page**. Each chapter opens when the pupil reaches the part of the game it belongs to, using the progress the game already saves, so nothing new decides who gets what.

### Gem Keep: "The Keeper's Tale" (ST.4), the story challenge

The Keep holds the last of the valley's magic gems. Warlord Mudtooth's Grey Horde wants them.

- **Opening** (3 pages) the first time a pupil opens the campaign map.
- **Ten chapters**, one a level. Before a level for the first time: a chapter page (where you are, what Mudtooth is up to).
- **A Tale challenge for each level:** an extra goal with a story reason, shown on the chapter page, tried on any go of that level. Examples: *the bridge is weak, build no more than 4 towers*; *the villagers are hiding in the east, don't let a single runner reach the Keep*; *Mudtooth's brute is immune to fire, win with no red gems*; *the Keep's wall is cracked, finish with the Keep above half*.
- **Winning a Tale challenge** gives that chapter's **Tale page** (a second painting, the story's next beat) and a Tale star on the map. All ten Tale stars give the **ending** (3 pages, Mudtooth's horde gives up and goes home) and the **Keeper's Tale trophy**.
- The game checks the goal from the go's own result, the same way it gives level stars now. No maths change; stars only, no coins, so nothing to replay on the server.

### Maths Monsters (ST.6)

The 7 quests already have people and a story. Add an **opening** (4 pages: arriving at Harbour Town, the Teacher's big question, six areas, six badges) and **a start page and a finish page for each quest** (14), painted with the quest's own person (Hermit, Hine, Old Kui, Ranger Fern, Glow Gran, Captain Tui, the Teacher).

### Dragon Maths, more (ST.5)

- **Meeting each master** (11 pages, one each): shown the first time a pupil meets a master; the master's one-line intro becomes a painted scene.
- **Scorchtail's lair** (2 pages) before the first dragon fight, and **the victory story** (5 pages) after the first dragon win, like Clans: the lights come back on, the treasure comes home, the village cheers your hero.

### Diamond Drop: "Nugget's Journey" (ST.7)

Nugget the claw-bot hears of the Heart Diamond, deep under the hills. **Opening** (3), **a page each time a new level is reached** (10: the soil, the old well, the crystal caves, the underground river, the sleeping worms, the ice seam, the lava river, the fossil hall, the glowing deep, the heart), **ending** (3) at the Heart Diamond. Starts again each season, like the levels.

### Toon Flap: "The Ink Thief" (ST.8)

A grinning ink blot has stolen the colour from the Toon worlds. **Opening** (3), **a page as each of the 10 worlds is first reached** (each world gets its colour back as you fly through), **finale** (3) in Cosmic Storm: the Ink Thief gets splashed back into a bottle.

### Mine Runner (ST.9)

Old Prospector Pete's map of the six mines. **Opening** (2), **a page per mine** (6), **ending** (2).

### Royal Decree (ST.10)

**Coronation** (4 pages: the old ruler retires, the crown, Hale the steward, Riverstone waiting), **a year-end page** for each of the 6 years (what the town remembers about that year, chosen from the meters), and a **farewell** (2) at the end of year 6.

### Chess and Checkers (ST.11)

**Checkers, "The Pirate Crew"**: the chick, the robot and the kea captain each get a page before the first game against them and a page when first beaten (6). **Chess, "The Bots' Tournament"**: the same for each chess bot. Beating every bot gives the ending page.

### Sky Isles (ST.12)

**Opening, "The Falling Isles"** (3 pages with Pip), and a page at each island milestone (5).

## 7. Not in this plan

- **Foundational games** (James's rule).
- **Marble Rush** (real NZ courses, already painted; a story would get in the way of a race), **Archery**, **Wormholes & Black Holes**, **101**, **Power Clash**, **Order Up!** (short games, no characters), **Kingdom Keeper** (switched off).

## 8. Art

About 230 paintings. Each stage's pictures go in `docs/stories-art/<game>.json`; one painting a page, the same style words as the game's own art so the stories match the screens.

| Stage | Story | Paintings |
|---|---|---|
| ST.2 | Clans opening 6, Dragon Maths opening 6, Star Trader opening 6, Clans arrivals 9 | 27 |
| ST.3 | Goblin Storm opening 4, heroes 24, maps 5, bosses 5 | 38 |
| ST.4 | Gem Keep opening 3, chapters 10, Tale pages 10, ending 3 | 26 |
| ST.5 | Dragon Maths masters 11, lair 2, victory 5 | 18 |
| ST.6 | Maths Monsters opening 4, quests 14 | 18 |
| ST.7 | Diamond Drop 16 | 16 |
| ST.8 | Toon Flap 16 | 16 |
| ST.9 | Mine Runner 10 | 10 |
| ST.10 | Royal Decree 12 | 12 |
| ST.11 | Checkers 6, Chess about 12, ending 1 | 19 |
| ST.12 | Sky Isles 8 | 8 |

Painting: `python3 scripts/game_art.py docs/stories-art/<game>.json paint ~/story-art --tries 3` when the gaming PC is on; picks in `docs/stories-art/<game>-picks.json`; then `tidy` into `src/games/<id>/art/story/`.

## 9. Stages

Each stage is its own PR, goes live switched on, and adds a "What's new" line.

- [ ] **ST.0** This plan.
- [ ] **ST.1** `StoryBook`, `StoryShelf`, `useStories`, the `story_seen` table and its two functions, tests.
- [ ] **ST.2** Opening stories for Clans, Dragon Maths and Star Trader; Clans arrivals; Clans' win story onto `StoryBook`.
- [ ] **ST.3** Goblin Storm: opening, 8 hero stories, maps, bosses.
- [ ] **ST.4** Gem Keep: The Keeper's Tale, Tale challenges, ending, trophy.
- [ ] **ST.5** Dragon Maths: masters, lair, victory.
- [ ] **ST.6** Maths Monsters: opening and quest pages.
- [ ] **ST.7** Diamond Drop: Nugget's Journey.
- [ ] **ST.8** Toon Flap: The Ink Thief.
- [ ] **ST.9** Mine Runner.
- [ ] **ST.10** Royal Decree.
- [ ] **ST.11** Chess and Checkers.
- [ ] **ST.12** Sky Isles.
- [ ] **Art** for each stage, painted when the gaming PC is on.
- [ ] **Voice** clips for every page.
