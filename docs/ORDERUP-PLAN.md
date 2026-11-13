# Order Up!: plan (the first Activity)

**Status: stage 1 (Activities page, hidden behind `ACTIVITIES_ON = false`) merged in PR #492; stage 2 (step engine, `shared/orderup/`) built 13 Nov 2026. Art style: James's "quirky" painted caricature look (13 Nov).** Migration number when building starts: `20261113000700` (free on 13 Nov; check again with `node scripts/migration-numbers.mjs`).

Source: James's Google Doc "bedmas" (id `1hDLgfY7ewHxfCooOiXqWvUYEX6RivhBYc9JQPzwCYtg`). Game id `orderup`. Thread: "Plan the order of operations activity".

## The short version
- The first **Activity**: calm practice of one skill, not a game. Activities have their **own page** in the top menu, and the home page stays games only.
- Pupils work an expression on a take-away bag. They **tap the two numbers that go together first**, then **type that step's answer**, and the bag **collapses** (4 + 3 × 5 → 4 + 15 → 19). A number with an exponent is a step on its own.
- An **order card** (brackets purple, exponents orange, × ÷ blue, + − green), with the same colours through the expression, lights the rule each step used.
- A **ticket** writes every step line by line, so pupils end with the written working they'd put in a notebook.
- **Hints** go after real misconceptions, and **help for kids who need it** follows each child's results (below).
- **7 levels:** left to right, × ÷ first, brackets, exponents, all together, place the brackets, diner word problems. Each level makes new problems every time.
- **Game layer after the activity** (James: "the game should follow the activity"): customers, chef's special, grow your diner, fix the cook's mistakes, and an optional Busy night. None of it changes how a step is picked, solved or hinted.
- **Teacher:** an on/off switch, a column on the Progress tab ("level passed", of 7), the hardest steps and the common mistakes. Every step counts on the order-of-operations row of the Skill map.

## Decisions
| Question | Recommendation | James chose |
|---|---|---|
| Where Activities sit for pupils | A section on the home page | **A separate Activities page** in the top menu (13 Nov) |
| Rewards | The same points as games | **Achievements only:** no points, no leaderboard (13 Nov) |
| Game layer | Diner, cook's mistakes, chef's special | **All four, with Busy night** (13 Nov). It follows the activity and is built after levels 1 to 7 |
| Help for kids who need it | The help ladder below | James asked for it (13 Nov); below |

## What an Activity is (the new section)
- `activity: true` on the `GameDefinition`, with **no `group`**, so it never gets a home card. The new page `/activities` (`src/activities/ActivitiesPage.tsx`) lists every activity whose teacher switch is on, using `ActivityCard` and `useClassSwitches`.
- The top menu gets "📝 Activities" behind a code switch (`ACTIVITIES_ON`, off until Order Up's levels 1 to 3 are live), so pupils never see an empty page.
- No points: an activity never calls `add_game_points`, so there's nothing on the points, Hard workers or homework boards.
- Achievements use measures ending `_step`, which the Leaderboard's "most achievements" board leaves out (game guide 1-design question 5), so there's no leaderboard, as James chose.
- Everything else is a normal game: teacher switch, `teacher` contract, server function, own tables, and the Skill map.
- Shared files touched (each its own small PR, as 3-files-and-clashes.md says): `src/games/types.ts` (the `activity` field), `src/components/Layout.tsx` (menu link), `src/App.tsx` (route), and `src/activities/ActivitiesPage.tsx` (new).

## Design (game-guide/1-design.md)
1. **Big goal:** pass all 7 levels; with the game layer, a full diner and a full loyalty card. With 10 to 15 minutes, 3 days a week, levels 1 to 3 take about 2 weeks and all 7 about a term.
2. **Season game?** No: nothing piles up that late joiners would miss.
3. **Play a day:** no limit. It's practice, with no points to farm, so there's no `UNLIMITED_GAMES` entry.
4. **Progress bars:** a level road of 7 bags on the activity's own home screen, and inside a level a bar of 8 bags (passing = 7 of the last 8 solved with no more than one wrong tap, below).
5. **Achievements** (measures end `_step`, so they stay off the board; kept at New Season):

   | Name | For (pupil words) | Measure | Number | Who gets it |
   |---|---|---|---|---|
   | First order | Finish your first bag | `orderup_level_step` | 1 | nearly everyone, day one |
   | Left to right | Pass level 1 | `orderup_level_step` | 1 | most |
   | Times first | Pass level 2 | `orderup_level_step` | 2 | most |
   | Bracket boss | Pass level 3 | `orderup_level_step` | 3 | many |
   | Power up | Pass level 4 | `orderup_level_step` | 4 | some |
   | Head chef | Pass level 5 | `orderup_level_step` | 5 | some |
   | Bracket builder | Pass level 6 | `orderup_level_step` | 6 | few |
   | Diner master | Pass level 7 | `orderup_level_step` | 7 | few |

6. **Home card scene:** a bright take-away counter at night, a paper bag with a sum on it in coloured signs, a ticket curling off a printer. Painted by James in ComfyUI; drawn stand-ins until then.
7. **Guide for new players:** the doc's worked example *is* the guided first go. On a level's first open it plays line by line (each line does one step, the step marked, one short sentence on the rule), then gives one bag where the right pair is lit and the answer is easy, so the first go can't fail. "Show me again" stays on the level screen. Who has seen it is saved on the server.

   | Moment | What it does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First bag | worked example, then a guided bag | doesn't know you tap numbers, not signs | pointing hand on the first number; the line "Tap the two numbers that go together first" |
   | Picked a pair | number pad opens | expects a choice to tap | pad with a big "Check"; the line "What is 3 × 5?" |
   | Bag collapses | the step slides onto the ticket | misses what changed | the new number pulses in its rule's colour |
   | Exponent (level 4) | demo of 3² = 3 × 3 the first time | thinks 3² is 3 × 2 | the demo, plus the hint below |
   | Place the brackets (level 6) | demo: tap the first and last number | the task is turned around | one demo bag; the target shown big |

8. **Learning design:** see the next two sections and the mistakes table.

## Help for kids who need it
The doc's hints are rung 1. Every child gets the same rules of the help ladder (LEARNING-DESIGN rules 4, 5 and 7); what changes is how far up it goes for them.

**The help ladder, per step:**
1. **Always there:** the order card with colours, and colour under every sign in the expression.
2. **After a wrong pick:** the doc's hint for that mistake, read aloud by Bella, and the rule lights up on the order card.
3. **After a second wrong pick on the same step: "Let's look together".** The order card works down the rules one by one ("Any brackets? No. Any powers? No. Any × or ÷? Yes, here."), and the sign that goes next glows. The child then taps the pair.
4. **After a third:** the pair glows and the child taps it. The step still has to be solved, so the child still does the maths.

**Help with the arithmetic** (the step's answer), because a child who knows the order can still trip on 7 × 8:
- A wrong answer gets a "why" line on the step itself: for 3 × 5 = 8, "3 × 5 is three fives, not 3 + 5", with three groups of five dots.
- A second wrong answer shows the step worked (5 + 5 + 5 = 15) and they type it. The step counts as helped, not right.
- Levels 1 to 3 keep the numbers small (times tables up to 5 × 10 unless the class's tables setting says more), so the arithmetic doesn't hide the order.

**Help that follows the child** (LEARNING-DESIGN rule 5, the same numbers as Weka and Tūī):
- A level starts on **full help** (the order card points to the rule for each new step before the child taps).
- After **two good sets on different days** (7 of 8 bags with no more than one wrong pick), it steps down to the plain ladder above.
- A **hard set** (4 or fewer of 8) steps help back up one; **3 bags in a row with a wrong first pick** gives full help for the rest of the set.
- **Shorter bags first:** a child on full help gets two-step bags before the level's three- and four-step ones.
- **Reading support:** Bella reads every hint, and in level 7 every word problem, with a "Read it again" button. No timer anywhere (Busy night is optional and never needed to pass).
- **Sister bags** after "Let's look together": the same shape with the numbers changed, never the same bag again.
- The server saves the help level with each set, so it follows the child to any device.
- **Teacher override** on the activity's settings: help fades (default), always full help, or hints only.

**The teacher sees who needs help:** the Progress column shows the level, plus a "stuck" mark when a child has had 3 hard sets on one level. The class report names the most common mistake ("starts outside the brackets: 6 pupils"), and Today's "Needs you" lists pupils stuck for a week.

## Mistakes table
| Mistake | How it shows up | "Why" line (Bella) | What the picture does |
|---|---|---|---|
| Left to right ignoring rank | taps 4 and 3 in 4 + 3 × 5 | "Multiply and divide before you add and subtract. Do 3 × 5 first." | × ÷ rule lights on the card; × glows blue |
| × before an earlier ÷ | taps 3 × 2 in 12 ÷ 3 × 2 | "× and ÷ are a team. Go left to right: 12 ÷ 3 first." | arrow left to right under the blue signs |
| Outside the brackets first | taps 2 × 4 in 2 × (4 + 1) | "Brackets first. Work inside them before anything else." | brackets glow purple |
| Not in the same step | taps 4 and 5 in 4 + 3 × 5 | "Those numbers aren't next to the same sign. Pick two numbers joined by one sign." | the signs between them flash |
| 3² read as 3 × 2 | types 6 | "3² means 3 × 3, not 3 × 2." | 3² opens out to 3 × 3 |
| + − before an earlier − | taps 4 + 2 in 10 − 4 + 2 | "+ and − are a team. Go left to right: 10 − 4 first." | arrow left to right under the green signs |
| Word problem counted once | picks 3 × 5 + 2 | the doc's line ("Each meal is a burger and fries…") | the 3 meals drawn as 3 trays |

## Maths and evidence
- **This activity teaches one skill**, so it doesn't follow the pupil's maths focus (like Basic facts training has its own). The server makes every problem from a seeded engine and marks every pick and answer (game guide rule: the browser decides nothing).
- **Recorded on the Skill map:** every finished bag is one answer under the existing order-of-operations keys (`bedmas:left-to-right`, `mul-first`, `div-first`, `brackets-first`, `brackets-div`, `mixed`, `mixed-brackets`), right only when solved with no help past rung 2, through `recordMathsAnswers` with the `generated` pack's quick time. Exponents and the level 6 and 7 bags need new keys in `shared/maths/skillPacks/bedmas.ts`: a shared maths PR of its own at stage 4.
- **Saved per bag:** level, expression, each pick (right, or the kind of mistake), each answer given, help rung reached, time.

## Steps and the Progress tab
| Step | Name | Moves up when |
|---|---|---|
| 1 | Left to right | a passed set (7 of 8, at most one wrong pick each) |
| 2 | × ÷ first | the same |
| 3 | Brackets | the same |
| 4 | Exponents | the same |
| 5 | All together | the same |
| 6 | Place the brackets | the same |
| 7 | Word problems | the same |

Any passed level can be played again; replays never move the level. `progressColumns`: "level passed", of 7, with "zz" and "stuck".

## Server, data and cost
Function `orderup` (`start` a set: makes 8 bags from a seed and stores them; `pick`; `answer`; `finish`). Tables `orderup_players` (level, help level, guide seen), `orderup_sets`, `orderup_steps`. Migration `20261113000700_orderup.sql`. About 30 requests per pupil per lesson (one per pick and answer); a class of 30 is about 900 small requests.

## Stages
| Stage | What | Live? |
|---|---|---|
| 1 | Activities section: `activity` field, `/activities` page, menu link behind `ACTIVITIES_ON` | no |
| 2 | Expression engine in `shared/orderup/`: parse, next allowed steps, mistake kinds, problem makers per level, tests | no |
| 3 | Levels 1 to 3: bag, order card, ticket, worked example, help ladder, server, tables, teacher part. Turn `ACTIVITIES_ON` on | no |
| 4 | Levels 4 and 5: exponents, all together (plus the new skill keys PR) | no |
| 5 | Level 6: place the brackets | no |
| 6 | Level 7: word problems at the diner, read aloud | no |
| 7 | Game layer: customers, chef's special, grow your diner + loyalty card, fix the cook's mistakes, Busy night | no |
| 8 | Art and voice: James paints in ComfyUI; Bella records the hints | no |
