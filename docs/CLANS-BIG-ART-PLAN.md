# Clan Quest: big art, a town map, and ladder maths

Written 16 November 2026 (NZ) for James. **Status: plan agreed 16 Nov (James's cards: drop the bill maths, quest asks 2 ladder questions, map first with the clan below). Town map painted 16 Nov (`scenes/town`, try 1 of 4). Part A LIVE 16 Nov (#512). Part B built 16 Nov: `ask` + `askCheck` (each question marked as it is answered, like the Battle Cry).**

## Why

Clan Quest has more painted art than any other game (20 place paintings, 6 kingdoms, 10 quests, 792 member pictures, 209 items, 38 monsters, every building level), but most of it shows as a 190px strip, 40 to 112px icons and small portraits. And its maths is still its own year-band system (`shared/maths/practical.ts`) for everything except the Battle Cry.

## Part A: show the art big

| Stage | What | Files |
|---|---|---|
| A1 | **Town map home.** A painted bird's-eye town (`scenes/town`) with tappable places, like Dragon Maths' map: Mines (cave), Market (tents), Great Hall (My Village), Training yard, Church, Tavern (Quest), Herald's tower (News), Hall of Heroes (Scoreboard), the lair (Monster, only in monster week). Labels always shown; a place you can't use today is faded with why. The text list stays under it for keyboards and screen readers. | `TownMap.tsx`, `ClanQuest.tsx`, `clans.css` |
| A1 | **Big place paintings.** Every place's painting shows whole (16:9, up to about half the screen tall) with its name on it, instead of a 190px crop. The same painting dimmed behind the whole screen. | `ClanQuest.tsx` (`Scene`), `clans.css` |
| A1 | **Bigger pictures.** The clan line-up uses the full 416x720 member art, about twice as tall. Market shelf items 40 to 96px, chosen building in My Village 52 to 180px, fight monsters 60 to 140px. | `MemberCard.tsx`, `Sprite.tsx`, `clans.css` |
| A2 | Tidy what A1 shows up: phone and iPad sizes, anything that now feels crowded. | |

Painting: `docs/clans-town-art/config.json` (`python3 scripts/game_art.py clans-town paint ...`).

## Part B: maths from the ladder only

James chose (16 Nov):
- **Battle Cry** (mine fights and the monster fight): ladder only. Every new fight is a ladder fight; the old year-band path is kept only to finish a fight already open.
- **Shop 10% discount, monster siege:** one ladder question each, made and kept by the server, marked on the server.
- **Daily quest:** the story and painting stay; the puzzle becomes **2 ladder questions**. Both right wins the big prize, one right the small prize.
- **Bill checks dropped:** building upgrades (area and fence), troops, Training Hall, Church and the raid loot share become one tap, no maths.
- **Teacher page:** the year band, topics and times tables go (the focus is set on the shared Set focus page); fights per day stay. The old Clan maths tables stay readable for old answers, nothing is deleted.
- Answers go through `recordMathsAnswers`, so they count on the ladder, the Skill map and focus results.

How (server): a new `ask` action makes ladder questions from `space_maths_context` (`makeRunQuestions`, seeded), keeps them in the saved clan (stripped from what pupils are sent, as fight questions are) and returns only what to show. `buy`, `quest` and `monsterStart` then send `{ answer, ms }` and the server marks against the kept question, once.

| Stage | What |
|---|---|
| B1 | Server: `ask`, marking in `buy` / `quest` / `monsterStart`, ladder always on for fights, `monsterStart` loads the maths. Tests. |
| B2 | Browser: `QuestionModal` for the shop, quest and siege; bill moments removed; teacher page trimmed. |
