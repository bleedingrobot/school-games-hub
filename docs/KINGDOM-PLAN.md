# Kingdom Keeper: plan

*A Hamurabi-style city game for School Games Hub. Asked for by James on 26 October 2026 ("plan this, Hamurabi-style city game, graphics that match the quality of Dragon Maths, questions from the question server, follow the rules for building a new game, plan carefully then start building"). Top pick in [GAME-IDEAS.md](https://github.com/bleedingrobot/school-games-hub/blob/game-ideas/docs/GAME-IDEAS.md) (branch `game-ideas`). Branch `city`, worktree `~/projects/school-games-hub-city`, made from `origin/main` 650cde9. Built by following [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md).*

**James was away while this was planned and said to go as far as possible.** Every choice below marked **(chosen)** was made for him and is easy to change. Nothing goes live without his word: applying the migration, deploying the function, merging and switching the game on are separate yeses.

---

## 1. The short version

- You rule **Riverstone**, a small river city, for **10 years**. Each year your steward reports what happened, three advisers ask you a maths question each, and then you decide: buy or sell land, how much grain to feed the people, and how many acres to plant.
- **The maths:** every council question comes from the pupil's own maths focus, made and marked by the server (way A, like Marble Rush). A right answer gives a **boon** for the year (a better harvest, no rats, cheaper land, no sickness, more newcomers). A wrong answer just means no boon. The planning (grain × price, people × 20, acres ÷ 2) is real maths too, and the screen shows the sums as you go.
- **The look:** the same gritty painted style as Dragon Maths, painted with the same prompt style on the same image AI: a parchment map of the valley with labelled places, painted scenes for every place and event, six painted advisers, eight rulers to pick from, and four painted endings. Same dark-wood frame, parchment panels and IM Fell heading font.
- **The server is in charge:** the whole reign lives on the server. The browser sends the year's decisions; the server checks them, rolls the year from the reign's seed and sends back the next year.
- Points through the hub hooks (3 to 5 a finished reign), 6 achievements, a teacher on/off switch (off to start), a code switch (off to start), a preview James can try without signing in.

## 2. The rules (from *Hamurabi*, 1968–73, public domain)

Every number lives in `shared/kingdom/config.ts`, so How to play and the simulator read the same numbers.

| | Original | Kingdom Keeper |
|---|---|---|
| Start | 95 people (+5 arriving), 2,800 bushels, 1,000 acres, harvest 3 an acre, rats ate 200 | Same (year 1's report says 100 people) |
| Land price | 17–26 bushels an acre each year | Same. The trader's boon takes 2 off when buying and adds 2 when selling. |
| Food | 20 bushels a person a year | Same |
| Seed | 1 bushel plants 2 acres | Same |
| Workers | 1 person can farm 10 acres | Same |
| Harvest | 1–5 bushels an acre | Same, +1 with the reeve's boon |
| Rats | 40% of years they eat a fifth to half of the store (shown in the original as 1/C of the store, C = 1–5 even) | Same, none with the rat catcher's boon |
| Newcomers | `int(C × (20 × land + store) / people / 100 + 1)`, C = 1–5 | Same, ×1.5 with the builder's boon |
| Plague | 15% of years, half the people | **"Sickness":** same chance; half the people **leave to stay with family until it passes** (they don't come back in the count). None with the healer's boon. |
| Starving | People not fed die. Over 45% in one year: impeached | People not fed **go hungry and leave the city**. Over 45% in one year: **the people ask for a new ruler**, and the reign ends early (kindly worded). |
| End rating | Uses the average % starved a year (P) and acres a person (L): fantastic (P ≤ 3, L ≥ 10), not too bad (P ≤ 10, L ≥ 9), heavy-handed (P ≤ 33, L ≥ 7), impeached (else) | **Legendary ruler**, **Good ruler**, **Fair ruler**, **Hard times**, with the same lines, kind words and a painted ending each |

Kid-friendly words throughout: nobody dies on screen; people "go hungry and leave", "leave until the sickness passes", "come to live here". The original's rude end lines are gone.

Within a year, in this order (same as the original): report → **council** (new) → buy **or** sell land → feed → plant → the year turns (harvest, rats, newcomers, hungry, sickness) → next report.

## 3. The maths (GAME_DEVELOPMENT_GUIDE section 4, way A)

- **Council questions.** At the start of each year the server reads `space_maths_context(player)`, makes **3 questions** with `makeRunQuestions` (shared/maths/serverQuestions.ts) from a fresh random, keeps them in `kingdom_councils` (pupils can't read it) and sends only `publicQuestion`s. Each one is asked by a different adviser. The pupil answers with `QuestionModal`. The server marks it (`markQuestion`, `sameAnswer`), claims the slot once, records it with `recordMathsAnswers(…, 'kingdom')` and replies `{ right, answer }`.
- **Which advisers.** Three of the five, picked by the reign's seed each year, so every year feels different:
  | Adviser | Boon for a right answer (this year) |
  |---|---|
  | Marigold the reeve | +1 bushel an acre at harvest |
  | Nettle the rat catcher | Rats stay out of the granary |
  | Quince the trader | Land costs 2 less to buy, and sells for 2 more |
  | Rowan the healer | No sickness |
  | Bram the builder | Half as many again come to live here |
- **Wrong or skipped:** no boon, nothing lost. The class's skip switch works as in every game (QuestionModal).
- **No maths can be read** (the records can't be reached): the council is empty that year and the game goes on without boons.
- The boons used when the year turns come only from answers the server marked right, never from the browser.
- **Counts for the ladder and focus results** (the one approved way), like Marble, Mine and Archery.
- Every kind of ladder question shows: QuestionModal does it all. A test runs every `LADDER` skill through a council.

## 4. Screens and pictures

Same frame as Dragon Maths, with the game's own CSS (`.kk-`) and its own copy of IM Fell English SC (OFL).

| Screen | Picture |
|---|---|
| **Start**: pick your ruler (8 looks), then "Begin your reign" | Riverstone at dawn (`title`) |
| **The valley**: the parchment map with labels: Council Hall, Market, Granary, Fields, City Gate. Year, people, grain, land and land price in a bar on top | `map` |
| **Steward's report** for the year, line by line with small icons, the city picture changing size as it grows | `city-1` … `city-4` (village, town, city, great city), steward portrait |
| **Council**: each adviser stands in the hall and asks their question | `council` hall + adviser portrait |
| **Market**: buy or sell land, with − / + buttons and typing, "costs 23 × 40 = 920 bushels" | `market` + Quince |
| **Granary**: feed the people, "95 people × 20 = 1,900 bushels feeds everyone" | `granary` |
| **Fields**: plant, "300 acres need 150 bushels of seed and 30 farmers" | `fields` + Marigold |
| **The year turns**: a short run of painted cards for what happened (good/poor harvest, rats, newcomers, people leaving, sickness) | `harvest-good`, `harvest-poor`, `rats`, `newcomers`, `leaving`, `sickness` |
| **End of reign**: rating, ten-year story, points | `end-legendary`, `end-good`, `end-fair`, `end-hard` |

The planner never says what's "right": it shows the sums and warns kindly ("Only 80 of 95 people will be fed").

**Art list (32 pictures).** Painted in the Dragon Maths gritty style (the same opening sentence as every Dragon Maths prompt, kept in `docs/kingdom-art/PROMPTS.md`) on James's ComfyUI with Z-Image Turbo, 2–3 tries each. Claude picks, checks every picture is right for 8–11 year olds (fully clothed, shirts buttoned up, no writing), tidies them into WebP with `scripts/kingdom-art.py` (scenes 1600 + 800 wide; people cut out, 720 high). Raw PNGs stay in `~/dragon-art-inbox/kingdom-art` (not in the repo).

- Scenes (16): title, map, city-1…4, council, market, granary, fields, harvest-good, harvest-poor, rats, newcomers, leaving, sickness. Endings (4): end-legendary, end-good, end-fair, end-hard.
- People (6): steward Hale, Marigold, Nettle (with her terrier), Quince, Rowan, Bram.
- Rulers (8, chosen): 4 girls and 4 boys about 11, crowned, from New Zealand's mix of backgrounds, fully clothed in royal robes.

## 5. Server and database

**Function `kingdom`** (`supabase/functions/kingdom/`: handler.ts with the logic, entry.ts the plumbing, index.ts built with `npm run build:functions -- kingdom`), deployed `--no-verify-jwt`, sign-in by `userIdFromToken`. Refuses everything while the teacher's switch is off.

| Action | What it does |
|---|---|
| `load` | The open reign (if any), this year's council (public questions + answers so far), the pupil's record (reigns, best) |
| `start { look }` | Ends any open reign, starts a new one with a fresh seed, makes year 1's council |
| `answer { reign, year, slot, value, ms }` | Marks one council answer once, records it |
| `decide { reign, year, buy, sell, feed, plant }` | Checks the decisions against the rules, turns the year with `seededRandom(seed + year)` and the boons the server marked, saves, makes next year's council. At the end of year 10 (or an early end) works out the rating and gives points. Sent twice: the second finds the year already turned and gets the current state back |

**Migration** `20261026000100_kingdom.sql` (the next free number on 26 Oct 2026; check again at go-live):
- `kingdom_reigns` (one row a reign: player, seed, look, year, status `playing|done|ended|left`, state jsonb, rating, people at the end, created/finished). RLS on, no policy, no grant.
- `kingdom_councils` (reign, year, questions, answered). RLS on, no policy, no grant.
- Server-only functions: `kingdom_load`, `kingdom_start`, `kingdom_council_store`, `kingdom_council_load`, `kingdom_answer` (claims a slot once), `kingdom_turn` (saves a turned year only if `year` still matches: sent twice counts once).
- `app_settings.kingdom_enabled boolean not null default false`, `teacher_set_kingdom()`.
- Hooks: one `hub_games` row with counts, point rules, players, season (New Season clears reigns and councils) and last played.
- Measures and 6 achievements.
- Locks every new function (revoke from public, anon, authenticated; grant to service_role, and `teacher_set_kingdom` to authenticated).

**Requests:** a year is 1 decide + up to 3 answers; a reign about 42. A class of 30 playing two reigns in a lesson is about 2,500; three lessons a week about 7,500, small next to the free plan's 500,000 a month.

## 6. Points and achievements

- Finish a reign: **3 points**; +1 for Good ruler or better; +1 more for Legendary (at most 5). A reign that ends early: **1 point**. Only the first **3 reigns a day** give points (the hub's 40-a-day cap still applies). Given with `add_game_points(player, 'kingdom', n, reign id)` so a retry earns once.
- Achievements (chosen): **First crown** (finish a reign), **Seasoned ruler** (finish 5), **Legendary ruler** (a Legendary reign), **Great city** (end a reign with 200 people or more), **Wise council** (30 council answers right), **Golden age** (3 Legendary reigns).

## 7. Teacher

On/off switch per class (`TeacherKingdom.tsx`, copied from the Archery panel). The maths focus is set on the shared Set focus page as usual.

## 8. Stages

| Stage | What | Status |
|---|---|---|
| K.1 | Rules engine (`shared/kingdom/`: config, engine, advisers, rating, points), tests, simulator `scripts/kingdom-sim.mjs` | |
| K.2 | Art: prompts, paint 2–3 tries of each, pick, safety check, tidy to WebP, CREDITS | |
| K.3 | Screens (`src/games/kingdom/`), trial backend running the same server rules in the browser, preview `preview/kingdom/` | |
| K.4 | Server: migration, `kingdom` function, `src/data/kingdom.ts`, handler tests, database tests on a scratch copy | |
| K.5 | Hub: code switch (off), teacher switch, GameDefinition, teacher panel, How to play, accessibility test, registry line | |
| K.6 | Checks: browser screenshots at 1366 × 640 and 844 × 390, typecheck, tests, build; private preview Artifact for James | |
| K.7 | Go-live prompt `docs/prompts/kingdom-golive.md`. **Then stop: going live is James's call, one step at a time.** | |

## 9. Decisions made for James (easy to change)

1. **Name:** "Kingdom Keeper", the city is Riverstone (id `kingdom`, CSS `.kk-`).
2. **Three council questions a year**, each tied to a boon; wrong never hurts.
3. **Kind words** for starving and plague (people leave rather than die).
4. **A reign is 10 years and can be played in one go** (about 15 minutes), and saves between visits. Not one year a day: Dragon Maths and Clan Quest already have daily turns.
5. **Points** 3–5 a finished reign, the first 3 reigns a day.
6. **No class leaderboard yet** (could be a "Hall of Rulers" later, own school only).
7. **Group:** `complex-maths` on the dashboard.

## 10. Stage results

*(filled in after each stage)*
