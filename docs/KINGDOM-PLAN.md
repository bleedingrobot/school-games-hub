# Kingdom Keeper: plan

*A Hamurabi-style city game for School Games Hub. Asked for by James on 26 October 2026 ("plan this, Hamurabi-style city game, graphics that match the quality of Dragon Maths, questions from the question server, follow the rules for building a new game, plan carefully then start building"). Top pick in [GAME-IDEAS.md](https://github.com/bleedingrobot/school-games-hub/blob/game-ideas/docs/GAME-IDEAS.md) (branch `game-ideas`). Branch `city`, worktree `~/projects/school-games-hub-city`, made from `origin/main` 650cde9. Built by following [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md).*

**James was away while this was planned and said to go as far as possible.** Every choice below marked **(chosen)** was made for him and is easy to change. Nothing goes live without his word: applying the migration, deploying the function, merging and switching the game on are separate yeses.

---

## 1. The short version

- You rule **Riverstone**, a small river city, for **10 years**. Each year your steward reports what happened, three advisers ask you a maths question each, and then you decide: buy or sell land, how much grain to feed the people, and how many acres to plant.
- **The maths:** every council question comes from the pupil's own maths focus, made and marked by the server (way A, like Marble Rush). A right answer gives a **boon** for the year (a better harvest, no rats, cheaper land, no sickness, more newcomers). A wrong answer just means no boon. The planning (grain × price, people × 20, acres ÷ 2) is real maths too, and the screen shows the sums as you go.
- **The look:** the same gritty painted style as Dragon Maths, painted with the same prompt style on the same image AI: a parchment map of the valley with labelled places, painted scenes for every place and event, six painted advisers, eight rulers to pick from, and four painted endings. **Look changed 27 Oct 2026 (James chose "animated-film painting" from five mock-ups):** a bright hand-painted animated-film style, sky-blue frame, white rounded panels, Baloo 2 and Mulish fonts (bundled, OFL).
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
| Rats | 40% of years they eat a half or a quarter of the store (1/C of the store when a roll C of 1–5 is even) | Same, none with the rat catcher's boon |
| Newcomers | `int(C × (20 × land + store) / people / 100 + 1)`, C = 1–5 | Same, ×1.5 with the builder's boon |
| Plague | 15% of years, half the people | **"Sickness":** same chance; half the people **leave to stay with family until it passes** (they don't come back in the count). None with the healer's boon. |
| Starving | People not fed die. Over 45% in one year: impeached | People not fed **go hungry and leave the city**. Over 45% in one year: the first time **the people warn the ruler**; the second time **they ask for a new ruler**, and the reign ends early (kindly worded). |
| End rating | Uses the average % starved a year (P) and acres a person (L): fantastic (P ≤ 3, L ≥ 10), not too bad (P ≤ 10, L ≥ 9), heavy-handed (P ≤ 33, L ≥ 7), impeached (else) | Same P thresholds, but the second test is **people at the end** (Legendary 150+, Good 100+, Fair 60+), with kind words and a painted ending each. Changed because the simulator showed acres a person punishing the council's boons (section 10). |

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

The game's own CSS (`.kk-`), in the animated-film look (see section 1); the first gritty Dragon Maths-style set is in git history.

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
| K.1 | Rules engine (`shared/kingdom/`: config, engine, advisers, rating, points), tests, simulator `scripts/kingdom-sim.mjs` | Done |
| K.2 | Art: prompts, paint 2–3 tries of each, pick, safety check, tidy to WebP, CREDITS | Done |
| K.3 | Screens (`src/games/kingdom/`), trial backend running the same server rules in the browser, preview `preview/kingdom/` | Done |
| K.4 | Server: migration, `kingdom` function, `src/data/kingdom.ts`, handler tests, database tests on a scratch copy | Done (not live) |
| K.5 | Hub: code switch (off), teacher switch, GameDefinition, teacher panel, How to play, accessibility test, registry line | Done |
| K.6 | Checks: browser screenshots at 1366 × 640 and 844 × 390, typecheck, tests, build; private preview Artifact for James | Done |
| K.7 | Go-live prompt `docs/prompts/kingdom-golive.md`. **Then stop: going live is James's call, one step at a time.** | Prompt written; waiting for James |

## 9. Decisions made for James (easy to change)

1. **Name:** "Kingdom Keeper", the city is Riverstone (id `kingdom`, CSS `.kk-`).
2. **Three council questions a year**, each tied to a boon; wrong never hurts.
3. **Kind words** for starving and plague (people leave rather than die).
4. **A reign is 10 years and can be played in one go** (about 15 minutes), and saves between visits. Not one year a day: Dragon Maths and Clan Quest already have daily turns.
5. **Points** 3–5 a finished reign, the first 3 reigns a day.
6. **No class leaderboard yet** (could be a "Hall of Rulers" later, own school only).
7. **Group:** `complex-maths` on the dashboard.

## 10. Stage results

### K.1 results (rules engine), 26–27 Oct 2026

- `shared/kingdom/`: `config.ts` (every number), `engine.ts` (start, council, prices, plan sums, checks, turning a year, rating, points), `reign.ts` (looks, seeds, councils), `server.ts` (the four actions, shared by the function and the preview), `memoryServices.ts` (the database jobs in memory, for the preview and tests).
- **Test budget** (`docs/TESTING.md`: a new game gets at most 8 tests): 3 rule tests, 3 server tests; 2 left for the screens.
- **Simulator** `scripts/kingdom-sim.mjs` (2,000 reigns per line; three pretend rulers × council right 0/50/80/100%). Two findings changed the rules:
  1. **Hamurabi's rating (acres a person) made right answers count against you**: the careful ruler was Legendary 29% of the time with no right answers and 10% with all right, because the healer's and builder's boons grow the city. Now rated by people at the end: Legendary rises from 7% (no right answers) to 42% (all right). Maths clearly helps.
  2. **Early endings**: a ruler who feeds everyone and plants every last bushel (nothing kept in store) ended early in about 70% of reigns. Rats eating less barely helped; a **first warning** before the reign ends helped a little (to 47–68%), and the careful ruler never ends early. The rest is Hamurabi's real lesson (keep a reserve), so the steward says so on the planting step. **For James:** if pupils find it too hard, the next lever is a smaller hungry limit penalty or a starting reserve.
- Final simulator table (Legendary / Good / Fair / Hard / ended early):
  | Ruler | Right | Leg. | Good | Fair | Hard | Early |
  |---|---|---|---|---|---|---|
  | careful | 0% | 7% | 29% | 44% | 20% | 0% |
  | careful | 100% | 42% | 35% | 20% | 3% | 0% |
  | simple (no reserve) | 0% | 2% | 12% | 11% | 75% | 68% |
  | simple (no reserve) | 100% | 28% | 17% | 6% | 49% | 47% |
  | thrifty (feeds 80%) | 100% | 0% | 0% | 81% | 19% | 4% |

### K.4 results (server) so far

- Migration `20261026000100_kingdom.sql` (one table, four server-only functions, switch, hooks, 6 achievements), function `kingdom` built (`npm run build:functions -- kingdom`), database test `supabase/tests/database/kingdom.test.sql` (27 checks) written; **not yet run on a scratch copy** (the local database was stopped and the machine is short of memory).
- Later the same night: run on a scratch copy (`npx supabase db start` only, then `scripts/scratch-db.sh kingdom`): `kingdom.test.sql` 27/27. Every other database test file passes too, apart from the two that fail on any scratch copy (`clans_fights` midnight, `maths_focus_results` day counting). `security.test.sql` (signed-in list gains `teacher_set_kingdom`) and `progress_access.test.sql` (achievements 93 → 99) updated, as every new game does.

### K.2 results (art), 27 Oct 2026

- 34 pictures painted on James's ComfyUI in the Dragon Maths gritty style (same opening sentence, same model and sizes, made from a Dragon Maths picture's own settings), 2–5 tries each, picks in `docs/kingdom-art/picks.json`, prompts in `docs/kingdom-art/PROMPTS.md`. 3.2 MB in the game.
- Safety check of every pick (ages 8–11): all fully clothed, collars closed, no writing, nothing scary, no lookalikes. Repainted: the poor harvest and the leaving family (modern streets and a skyline crept in), the builder, reeve and trader (open shirts), ruler girl 2 (barcode-like marks on her map; now a telescope). Rejected: a map with fake handwriting, a cross-shaped candlestick, a grave-like post, a palm tree.
- Known: the model always drew the leaving family walking *towards* a gate; the card's words say they leave. Could be repainted later.
- Map label spots in `docs/kingdom-art/map-spots.json`, used by `MAP_SPOTS` in `src/games/kingdom/art.ts`. Raw tries in `~/dragon-art-inbox/kingdom-art/` (not in the repo).

### K.3, K.5, K.6 results (screens, hub, checks), 27 Oct 2026

- Screens: start (pick a ruler), steward's report, council (each adviser in the hall; QuestionModal; "Not this year" skips), Market → Granary → Fields → Check (the valley map with labels), the year's painted cards (harvest, rats, newcomers, hungry families, sickness, the people's warning), the end (rating, ten-year summary, points, Rule again). How to play reads `config.ts`.
- Hub: `kingdomOn()` (code switch, **off**), `useKingdomEnabled`, the definition (`complex-maths`), `TeacherKingdom.tsx`, registry line behind the switch, `kingdom:sim` and `kingdom:preview` scripts. `kingdom` is **not yet** in `FUNCTIONS` in `scripts/build-functions.mjs` (the merge step).
- Tests: 8 in all (3 rules, 3 server, 2 screens: a play-through smoke test and an accessibility test reading `kingdom.css`). Type check clean; `shared/kingdom`, `src/games/kingdom`, `supabase/functions/kingdom`, `scripts`, `src/pages` and `App.test.tsx` all pass; `npm run build` clean. `test:all` in one go wasn't run (the machine runs short of memory; folder by folder instead).
- Browser: played whole reigns in the preview at 1366 × 640, 844 × 390 and 390 × 844 with no page errors.
- **Preview for James (private Artifact): https://claude.ai/artifact/Cvvd8FmJS7jbHXG7Lzv7ta** (saves in that browser only, never calls the school's server).


### Look changed to animated-film painting, 27 Oct 2026

- James asked to move away from the gritty look (too like Dragon Maths and Clan Quest). Five non-gritty looks were mocked up (watercolour, toy-town miniature, animated-film painting, papercut, mid-century gouache: https://claude.ai/artifact/PdBtTjynXRctAhpXwSkHmY) and James chose **animated-film painting**.
- All 34 pictures repainted in that style (one try each, James's call; one repaint round for six rulers, which first came with a grown-up beside the child, and the map). Safety checked; the leaving family now walk out through the gate. Weak spots: the map is a bright bird's-eye view rather than a flat map; the sickness street is sunny. Picks and prompts in `docs/kingdom-art/`, raw tries in `~/dragon-art-inbox/kingdom-anim/`, generator `~/dragon-art-inbox/tools/kingdom-anim.py`.
- Screens restyled to match (sky frame, white panels, orange buttons, Baloo 2 + Mulish bundled with their OFL licences; IM Fell removed). The accessibility test checks the new colours at 4.5:1. 8 tests pass, type check clean, a whole reign played in the preview with no errors. The preview link above shows the new look.

### Going live, 27 Oct 2026

- **Step 1 pre-flight (nothing live):** `origin/main` unchanged since branching (650cde9); migration number free. Type check clean; every test folder passes (about 5,000 tests, the usual 1 skipped); build clean. Live database read-only: every dependency there, `kingdom_reigns` absent; 927 scored games, 12 hub games; no `kingdom` function.
- **Step 2 (James's yes): migration applied live** with `supabase db query`. Checked: `kingdom_reigns` exists, empty, RLS on; switch off in all 4 settings rows; one `hub_games` row (13 in all); 6 achievements; pupils and anon can't read the table or call the server-only functions; scored games 935 (grew from play, not smaller). Added to the migration-repair note in `docs/PLAN.md`.
- **Step 3 (James's yes): `kingdom` function deployed** (`npm run build:functions -- kingdom`, unchanged from the branch; `npx supabase functions deploy kingdom --no-verify-jwt --use-api`). Checked from outside: no sign-in and a fake token both get 401 "Please sign in again."; the browser's pre-check gets 204. No other function deployed.
