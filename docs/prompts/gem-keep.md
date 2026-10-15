# Gem Keep — Build Plan (for Claude Code)

A GemCraft-style tower defence game for the School Games Hub, where times tables power the game. Students answer maths facts to earn mana, forge and combine gems, break through wave gates and unlock new levels.

"Gem Keep" is a working title. Do **not** use the name "GemCraft" anywhere (it is another studio's trademark).

---

## 0. How to use this file (instructions for Claude Code)

1. Read this whole file before writing any code.
2. Do **Phase 0** first and write your findings to `docs/gem-keep/RECON.md`. Where this plan's assumptions about the hub disagree with what you find in the repo, the repo wins: adapt the plan and note the change in RECON.md.
3. Work one phase at a time. At the end of each phase, run the tests, summarise what was built against the phase's acceptance criteria, and **stop for James to review** before starting the next phase.
4. Don't change the existing Chess or Checkers games. Reuse shared components (layout, sound, auth, points, leaderboard) rather than duplicating them. If a shared component needs changing, explain why first.
5. Keep all tuning numbers (mana, damage, HP, question rewards) in one config file so they can be balanced without hunting through code.
6. Use NZ English in all student-facing text (colour, defence, maths).

---

## 1. What we know about the hub (verify in Phase 0)

From inspecting the live build at `bleedingrobot.github.io/school-games-hub`:

- React single-page app built with Vite, hosted on GitHub Pages, hash-based routing (`#/...`).
- Routes include `/lobby`, `/leaderboard`, `/points`, `/profile`, `/sign-in`, `/teacher`.
- Backend is Supabase: tables such as `profiles`, `mp_games`, `bot_games`, `app_settings`; RPCs such as `leaderboard`, `my_progress`, `progress_rules`, `teacher_students`, `teacher_student_detail`, `teacher_new_season`, `teacher_set_multiplayer`; edge functions `multiplayer` and `save-bot-game`.
- Existing games (Chess, Checkers) are lazy-loaded chunks with bot and friend modes, a shared sound module, and a points/levels/badges system.
- Font stack is rounded system UI (`ui-rounded, SF Pro Rounded, Nunito, …`).

Gem Keep should feel like a sibling of those games: same shell, same sign-in, same points system, same teacher dashboard.

---

## 2. Reference game and what we're borrowing

Reference: https://github.com/ndongmo/Gemcraft-game (Java + libGDX, MIT licence). It can't be reused directly because it's a Java desktop game. We are **rebuilding the ideas in TypeScript for the browser**, not porting the code.

Borrow these mechanics:
- Enemies walk a path towards your base (the "Keep", their "Nexus").
- You spend mana to build towers and create gems; gems go into towers and decide what the tower does.
- Gems come in colours with different effects and can be combined into stronger gems.
- Towers can be upgraded and have targeting strategies.
- Player has a Keep health bar and a mana bar.
- Campaign mode with high scores.

Do **not** copy: their images ("Images: Internet", licence unknown), their soundtrack, or the GemCraft name. All art is drawn in code (Canvas shapes, gradients) or created fresh.

### Scope cut for kids and for v1

| Reference feature | Gem Keep v1 | Later |
|---|---|---|
| 8 gem colours | 4 colours: Red (area damage), Blue (slow), Green (poison), Yellow (critical hits) | Cyan (freeze), Purple (weaken) |
| Towers + traps | Towers only | Traps on the path |
| 4 targeting strategies | 2: "First in line" (closest to Keep) and "Strongest" | Fastest, weakest |
| Tower levels | 3 tower levels | — |
| Mana drained by enemies | No | Maybe |
| Free level mode / load level | No | Sandbox mode |
| Multi-language | English only, strings in one file | Te reo Māori UI strings |

Gems must be identifiable **without colour**: each colour also gets a unique shape (Red = triangle, Blue = circle, Green = hexagon, Yellow = star) for colour-blind players.

---

## 3. The maths design (the important part)

### 3.1 Principles

- **Maths is the fuel, not a wall.** Answering correctly makes you stronger. Answering wrongly never takes anything away; it just doesn't give the reward, and shows the correct fact.
- **The game pauses while a question is on screen** by default ("Calm mode"), so slower recallers aren't punished in real time. Teachers can switch on "Challenge mode" where the game keeps running at half speed during questions.
- **No public shaming.** Accuracy data is visible to the student and teacher only. Leaderboards show game score, never maths accuracy.
- **Every level is passable by every student.** Retries are unlimited and always use fresh questions.

### 3.2 The five maths touchpoints

| # | Touchpoint | When it happens | What the student does | Reward |
|---|---|---|---|---|
| A | **Mana Well** | Build phase before each wave (and any time the game is paused) | Taps the Well and answers facts | Each correct answer gives mana; a streak of 3+ gives a bonus. Capped per build phase (default 10 questions) so strategy still matters. |
| B | **Gem Forge** | Creating a new gem, or combining two gems | Answers 1 fact. Combining higher-grade gems asks harder facts. | The gem is created / combined. Wrong answer: mana isn't spent, try again with a new fact. |
| C | **Wave Gate** | Before every boss wave (every 5th wave) | Answers 3 facts | 3/3 = "Power Surge" (+25% tower damage for that wave); 2/3 = +10%; fewer = no buff, wave starts normally. |
| D | **Keep Shield** | Once per level, when Keep health drops below 25% | Lightning round of 5 facts | Each correct answer restores 5% Keep health. |
| E | **Level Key** | To unlock the next level on the campaign map, after winning a level | 10-fact challenge on that level's focus tables | Pass mark 8/10 (teacher can change). Fail: see which facts were missed, retry straight away with new facts. |

Touchpoint E is the "you have to answer times tables to get through levels" gate. Touchpoints A–D make the maths part of moment-to-moment play.

### 3.3 Question types

- Multiplication: `7 × 8 = ?`
- Missing factor: `? × 8 = 56` (unlocked from level 4)
- Division (inverse facts): `56 ÷ 8 = ?` (off by default; teacher switch)

Commutative pairs (`7 × 8` and `8 × 7`) are tracked as one fact for mastery, but both orders are shown.

### 3.4 Answer input

- Big on-screen number pad (works on iPads, Chromebook touchscreens, phones) plus physical keyboard input (digits, Backspace, Enter).
- No multiple choice for core facts (it encourages guessing); a teacher option can turn on 4-choice mode for students who need it.
- Show the fact large and clear. Feedback: correct = gem sparkle + sound; wrong = gentle "7 × 8 = 56" shown for 2 seconds, no buzzer.

### 3.5 Adaptive practice engine

Build this as a standalone, framework-free TypeScript module with unit tests (`mathsEngine/`). It must not depend on the game so it can be reused in other hub games later.

- **Fact pool:** tables 1–12. The teacher's settings decide which tables are enabled.
- **Campaign focus tables** (default progression, editable in config):
  - Levels 1–2: ×2, ×5, ×10
  - Levels 3–4: add ×3, ×4
  - Levels 5–6: add ×6, ×8
  - Levels 7–8: add ×7, ×9
  - Levels 9–10: add ×11, ×12, mixed review
- **Question mix:** about 60% current focus tables, 30% review of earlier tables weighted towards weak facts, 10% stretch (next table up).
- **Mastery boxes (Leitner):** each fact sits in box 0–4. Correct and quick (under 5 s) moves it up one box; correct but slow keeps it; wrong drops it to box 1. Lower boxes come up more often.
- **In-session repeat:** a fact answered wrongly comes back within the next 3–6 questions.
- **Fluent** = box 4, reached by being correct and quick on at least 2 different days.
- **Gem Forge difficulty:** combining grade-1 gems asks facts from boxes 3–4 (confidence builders); grade 3+ combinations ask from boxes 0–2 (the student's actual practice edge).
- Track per fact: attempts, correct count, average response time, box, last seen.

### 3.6 Curriculum alignment

Tag each skill pack (multiplication facts, missing factor, division facts) with the relevant NZ Curriculum Mathematics & Statistics codes. James has a curriculum-alignment tool for this, so leave a `curriculumTags: string[]` field on each skill pack with placeholder values for him to fill in.

Design the question provider as a pluggable interface so other skills (addition facts, doubling/halving, place value, fraction of a set) can be dropped in later without touching game code:

```ts
interface SkillPack {
  id: string;                 // "times-tables"
  label: string;              // "Times tables"
  curriculumTags: string[];   // fill in from James's alignment tool
  nextQuestion(ctx: QuestionContext): Question;
  recordAnswer(q: Question, answer: number, ms: number): AnswerResult;
}
```

---

## 4. Game design (v1)

### 4.1 Core loop

1. Campaign map → choose an unlocked level.
2. **Build phase:** place towers, use the Mana Well, forge gems, put gems in towers.
3. Press **Start wave**. Enemies walk the path. Towers fire automatically.
4. Between waves: back to build phase.
5. Boss wave every 5th wave, preceded by the Wave Gate.
6. Win: survive all waves (8–15 per level). Lose: Keep health reaches 0 (retry with no penalty).
7. Win screen → stars (1–3, based on Keep health left) → Level Key challenge to unlock the next level.

### 4.2 Elements

- **Map:** a tile grid (e.g. 16 × 10) with one path in early levels, two paths later. Towers go on buildable tiles only.
- **Enemies (v1):** Walker (normal), Runner (fast, low HP), Brute (slow, high HP), Swarm (many small), Boss (one per boss wave). Enemy HP scales by wave.
- **Towers:** one tower type, holds one gem, 3 upgrade levels (more range and fire rate).
- **Gems:** created at grade 1. Two gems of the same grade combine into the next grade (max grade 5). Combining two different colours makes a mixed gem with both effects at reduced strength (optional stretch goal for v1; can be cut).
- **Mana:** earned from Mana Well answers, from defeating enemies, and a small trickle each wave.
- **Speed controls:** pause, 1×, 2×.

### 4.3 Session length

A level should take 8–12 minutes, so a student can finish one in a typical classroom slot. Save progress at the end of every wave so a closed tab or bell doesn't lose much.

### 4.4 Content for v1

- 10 campaign levels defined as JSON (map layout, path(s), waves, focus tables, starting mana).
- A tiny in-repo level format doc so James can author more levels by hand.

---

## 5. Technical architecture

### 5.1 Stack

- TypeScript inside the existing React + Vite hub app.
- Rendering: **plain Canvas 2D**, no game engine library, to keep the bundle small and load fast on school Chromebooks. (If Phase 0 finds a strong reason otherwise, propose it before adopting.)
- Lazy-loaded route chunk, same pattern as Chess/Checkers.

### 5.2 Structure

- `GameEngine` class owns the simulation and the canvas. It runs outside React state.
- Fixed-timestep update (60 Hz) with `requestAnimationFrame` rendering. Speed control multiplies steps per frame.
- React renders menus, HUD, question modals and the number pad, and talks to the engine through a small typed event emitter (`engine.on('waveStart')`, `engine.pause()`, etc.).
- Auto-pause on `visibilitychange` (tab hidden) and when any question modal opens (Calm mode).
- Logical resolution (e.g. 960 × 600) scaled to fit the screen, with touch and mouse input. Must work in portrait on phones with a "rotate your device" prompt if too narrow.
- Object pooling for projectiles and enemies; aim for steady 60 fps on a low-end Chromebook with 60 enemies on screen.

Suggested folders (match the repo's existing conventions found in Phase 0):

```
src/games/gem-keep/
  engine/        GameEngine, entities, systems (movement, targeting, combat, effects)
  render/        canvas drawing for map, gems, towers, enemies, particles
  levels/        level JSON + loader + validation
  ui/            React screens: campaign map, HUD, build panel, question modal, number pad, results
  config.ts      all tuning numbers
  strings.ts     all student-facing text
src/lib/mathsEngine/
  skillPacks/timesTables.ts
  leitner.ts
  selector.ts
  *.test.ts
```

### 5.3 Data and Supabase (adapt to the existing schema)

Proposed tables, created by migration:

- `gem_keep_progress`: user_id, level_id, best_stars, best_score, unlocked, completed_at
- `fact_stats`: user_id, skill_pack, fact_key (e.g. `mul:7x8`), attempts, correct, avg_ms, box, last_seen
- `gem_keep_settings` (or new columns on `app_settings`, whichever fits the existing pattern): enabled_tables int[], division_enabled bool, missing_factor_enabled bool, question_mode ('calm' | 'challenge'), key_pass_mark int, multiple_choice_mode bool

Row-level security: students read and write only their own rows; teachers (existing teacher role) read all students.

Saving: batch answers and results and send them to a new edge function `save-gem-keep-run` (modelled on `save-bot-game`) at the end of each wave and the end of the level, not per answer. The function sanity-checks the payload (e.g. score within plausible bounds for the level, answer times not impossibly fast) before writing. Keep a local queue so a dropped connection retries on the next save.

Hub integration:
- Game card in the lobby.
- Award points through the existing points / `progress_rules` system (e.g. points per level won, per star, and for Level Keys passed). Propose the values in Phase 5.
- Leaderboard: total stars or campaign score, never maths accuracy.
- Respect `teacher_new_season` resets.

### 5.4 Teacher dashboard additions

- Settings panel: which tables are on, division and missing-factor switches, Calm/Challenge mode, Level Key pass mark, multiple-choice mode.
- Per-student view: a 12 × 12 times-table grid heat map (not tried / learning / secure / fluent), plus levels reached.
- Class view: which facts the class finds hardest (top 10), to inform teaching.

### 5.5 Privacy

Store only what's needed: user id, fact stats, game progress. No free-text input from students anywhere in this game. Keep data handling consistent with the hub's existing approach and the NZ Privacy Act 2020.

---

## 6. Phases and acceptance criteria

### Phase 0 — Recon (no game code)
- Read the hub repo: routing, how Chess/Checkers are structured and lazy-loaded, auth/profile flow, points and progress rules, teacher dashboard, Supabase migrations and edge functions, sound module, styling approach, test setup.
- Write `docs/gem-keep/RECON.md` with findings and any changes to this plan.
- **Done when:** RECON.md exists and lists the exact files/patterns Gem Keep will plug into.

### Phase 1 — Playable prototype (no maths yet)
- One hard-coded level, path, 3 enemy types, towers, 4 gem colours, combining, mana from kills, Keep health, win/lose, pause and 2× speed.
- Reachable at a hidden route (not in the lobby yet).
- **Done when:** a full level can be played start to finish on desktop and iPad; 60 fps with 60 enemies; engine unit tests cover damage, effects and targeting.

### Phase 2 — Maths engine (standalone)
- `mathsEngine` module: times-tables skill pack, Leitner boxes, selector with focus/review/stretch mix, in-session repeat.
- Number pad + question modal components.
- **Done when:** unit tests cover selection weighting, box movement, commutative fact keys and enabled-table filtering; the modal works by touch and keyboard.

### Phase 3 — Maths in the game
- Wire in all five touchpoints (Mana Well, Gem Forge, Wave Gate, Keep Shield, Level Key) with Calm mode pausing.
- Remove the free mana trickle's dominance so maths is the main mana source (tune in config).
- **Done when:** a level can only be won comfortably by engaging with the Mana Well; wrong answers never cost resources; Level Key gate works with retries.

### Phase 4 — Campaign content
- 10 levels in JSON following the focus-table progression in 3.5, campaign map screen, stars.
- Level format doc for James.
- **Done when:** all 10 levels load, validate and are beatable; difficulty rises steadily.

### Phase 5 — Hub integration
- Lobby card, Supabase migrations, `save-gem-keep-run` edge function, points and leaderboard hookup, teacher settings and dashboard views, offline save queue.
- **Done when:** progress persists across devices for a signed-in student; teacher can change enabled tables and see the heat map; a season reset clears Gem Keep progress appropriately.

### Phase 6 — Polish and classroom test
- Sounds via the shared sound module, particles, tutorial for level 1 (show, don't tell), colour-blind gem shapes, reduced-motion setting, sound toggle, readable text sizes.
- Test on the actual school devices.
- **Done when:** a small group of students can start and finish level 1 without adult help.

---

## 7. Decisions to confirm with James (defaults used until told otherwise)

| Question | Default |
|---|---|
| Which year levels will play? | Years 3–6 |
| Main devices? | Chromebooks and iPads |
| Question mode default | Calm (game pauses) |
| Level Key pass mark | 8 / 10 |
| Division facts on by default? | Off |
| Multiplayer? | No, single player only for v1 |
| Game name | Gem Keep (working title) |
| Visual style | Clean, bright, space-for-gems feel that matches the hub's rounded UI |

---

## 8. Stretch ideas (not v1)

- Traps on the path (Gem Keep's version of the reference game's traps).
- More skill packs: addition/subtraction facts, doubling and halving, fractions of a set.
- Daily challenge level with a class-wide goal ("our class answered 2,000 facts this week").
- Te reo Māori UI strings.
- Level editor for students to design maps.
