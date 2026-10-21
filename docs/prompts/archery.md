# Prompt: start Archery Challenge (a Scorched Earth–style archery game)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub`.

---

You are starting a new game for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). James is designing it **with one of his students**, who drew the screens. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

**The game:** Archery Challenge, short id `archery`
**The idea:** Scorched Earth, but with **archers instead of tanks**. Archers stand on hills you can blow apart, take turns aiming (angle and power, with wind), and shoot at each other. Between rounds you earn money from a **maths speed round** and spend it in the **Armory** on shields and over-the-top arrows.
**What James has already decided:**
- Archers, not tanks.
- Big, over-the-top weapons and shields to buy, like the original game.
- **The speed round:** questions with a shrinking timer. The first question gets 10 seconds, the second 9, then 8, 7 and so on. **How many you answer is how much money you get to spend.**

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Set up your own branch and worktree as in the guide's section 6 (branch `archery`, folder `~/projects/school-games-hub-archery`). Work only there. Never commit to `main`, never `supabase db reset`, never a bare `git push`.
3. `git fetch`, then `node scripts/migration-numbers.mjs`. Write the next free number in your plan.
4. Read Marble Rush on `main` (`docs/MARBLE-PLAN.md`, `shared/marble/`, `supabase/functions/marble/`). It's the closest example of a game built the approved way: server-made and server-marked questions, and a pure shared engine the server can replay. Also read Mine Runner (`shared/mine/`, `supabase/functions/mine/`): it's the newest game and also uses the focus system. For turn-taking against bots, look at how Wormholes & Black Holes and Power Clash do it.

## The student's drawing
It's at `~/projects/archery-reference/student-drawing.jpg`. Look at it with the Read tool. The photo is **sideways**: the right edge of the photo is the top of the page. **Don't copy it into the repo.** The repo is public, and it's a pupil's work. What's on it:
- **Home screen:** the title "Archery Challenge", an archer standing on a rock drawing a big bow, and a **Play** button. There are four world buttons, **Forest, Desert, Snow and City**, and three more buttons: **Armory**, **More Bows** and **"Times tables to get better"**.
- **Four level screens, one per world:** an archer on a ledge on the left. Targets stand on posts, rocks, ice blocks and buildings, labelled **5 m, 10 m, 20 m, 30 m and 50 m**. Some sit on stacked boxes that look as if they could be knocked down. The boxes on screen show **Arrows 10**, **Score** and **High score**. There's also a target icon and a small settings icon.

So the drawing shows a **target challenge**: 10 arrows, targets at set distances, beat your high score. James's idea is a **Scorched Earth battle**: archer against archer, blowing the land apart. Both are good, and they share almost everything: the same aiming, arrows, wind, land and Armory. Plan for both. Recommend which to build first, and how the drawing's ideas (the four worlds, the distances, More Bows, the practice button) fit in. Keep the student's names and ideas wherever you can. James will show the student your plan.

## The inspiration code
The code is at https://github.com/DigitalCyberSoft/scorchedearth-html5, a TypeScript copy of Scorched Earth (1995). Clone it into your scratchpad (not the repo) and read it. The gameplay is in `src/weapons.ts`, `weapon_behaviors.ts`, `physics.ts`, `damage.ts`, `terrain.ts`, `economy.ts`, `ai.ts`, `guidance.ts` and `game.ts`.

**Ideas only. Don't copy code, art, sounds, terrain files or names.** The repo has no licence, and Scorched Earth itself belongs to Wendell Hicken. Write our own engine in `shared/archery/`, and give the weapons our own archery names.

Ideas worth borrowing (described here in our words):
- **Shots:** angle plus power, gravity and wind, stepped with a **fixed small time step** so the same shot always lands in the same place. The server needs that to replay shots. Wind changes a bit each round.
- **Land:** made by midpoint displacement (a random hilly line). It's a grid of pixels that blasts carve away and some weapons add to. Loose dirt falls down after a blast. An archer with nothing under them falls and takes fall damage, unless they have a parachute.
- **Damage:** biggest at the centre of a blast and fading to nothing at its edge. A shield soaks up damage first, and anything left over hits health.
- **The weapon families:**
  - plain blasts in several sizes, from small to huge
  - ones that split into many at the top of their arc
  - ones that roll downhill and go off in the dip
  - ones that tunnel down
  - ones that dump a hill of dirt on someone
  - fire that pools in low ground
  - a straight beam
  - homing ones
  - shields of different strengths, including one that bounces shots away and one that pushes them up
  - parachutes
- **The shop:** items come in bundles at set prices, stronger items unlock later, and you can sell things back for less than you paid.
- **Bots:** of different skill. The easiest fires at random. Better ones work out the power for an angle and then check it by simulating the shot. The best also allow for wind. Bots must sometimes miss on purpose, so a 9-year-old can win.

Make it cartoon and kind. Archers get knocked out or "pop" with stars. No blood, and no nukes; invent fun archery versions instead, such as a giant arrow or a rain of arrows. Keep words short, kind and plain.

## The maths: the speed round
- Questions **only** from the shared maths focus (`makeFocusPack` with the server's focus), **made and marked by the server** (the guide's way A), and recorded with `recordMathsAnswers`. Show them with `QuestionModal` or handle every kind of ladder question (guide section 4). The drawing's button says "Times tables", but the focus decides the skill. Don't make a times-tables-only mode.
- **The shrinking timer must be checked by the server**, not just shown in the browser. One way is for the server to note when it sent each question and to refuse a late answer, with a small allowance for slow school wi-fi. Work out the best way and how many requests it costs, because the guide asks for few requests.
- A ladder question can be much harder than a times table, so think about whether the timer should allow for that. Follow the class's multiple-choice switch.
- Money only buys things in this game. It is **not** hub points.

## Questions for James (with your recommended answer for each)
Include at least these:
- Battle first, target challenge first, or both in the first version?
- Against bots only at first, or classmates too?
- Speed round: does it stop at the first wrong or late answer, or keep going? What happens after the 1-second question (stop, or stay at a minimum)? How much is each right answer worth? Is it once per round or once per game?
- Does bought stuff last one game only, or carry over between games (the drawing's "More Bows")? Carrying over means saving it on the server.
- Do the four worlds change how the game plays (slippery snow, buildings in the city), or only the look?
- What does the "Times tables to get better" button do? Recommendation: a practice speed round that earns nothing.
- Does the game give hub points? If so, use the `hub_games` hooks (guide section 5).

## Stage 0: the plan (no code yet)
Write `docs/ARCHERY-PLAN.md`:
- what the game is in plain words, and what pupils see first, following the drawing
- the rules as pure functions in `shared/archery/` (same seed and same inputs give the same result), and what the server replays or checks: shots, damage, money and the speed round
- the speed round in detail, including how the server enforces the timer
- the Armory list: our own names, what each does, prices, and when it unlocks
- the bots
- the tables, the server function, the switches (code switch and teacher switch), and any teacher settings
- how many server requests a class makes per lesson
- performance on slow Chromebooks: canvas size, pixel land, frame rate. Touch and keyboard aiming, with targets at least 44 px.
- every shared file it will touch (the guide's section 3) and when
- stages, each small and tested and ending with a "results" section, then a go-live stage
- the questions above, plus any others

Also make a **quick look-and-feel mock-up**: one private Artifact page showing the home screen and one battle screen, drawn from the student's drawing, for James to show the student. No game code yet.

Then **stop** and show James the short version. Don't start Stage 1 until he says so.

## Every stage after that
- Merge `origin/main` into your branch first.
- Build only in your own folders. Shared files get their one-line edits at the end, as the guide says.
- Tests: write your own as you go. Before saying a stage is done, run `npm run typecheck`, `npm run test:all`, `npm run build`, and your database tests on a scratch copy (`scripts/scratch-db.sh`). Say plainly if anything fails.
- Write the stage's results in the plan (what you built, decisions, tests, what's untested, the go-live list), commit, run `git push origin archery`, and stop for James.
- Nothing goes live (migration, function deploy, merge to `main`, switching on) unless James says so in words in this session, one step at a time.

When you stop, tell James in plain words what's ready, what he can try (a preview link if there is one), and what he needs to decide.
