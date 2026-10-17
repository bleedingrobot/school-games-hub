# LORD Maths: A Faithful Legend of the Red Dragon for Kids

(James's brief, saved 17 Oct 2026. The plan made from it is [../LORD-PLAN.md](../LORD-PLAN.md). It was written as a general brief; the plan explains where the hub does things differently.)

**Working title:** LORD Maths
**Product type:** Browser-based, persistent, turn-limited fantasy RPG with integrated maths practice
**Primary design goal:** Preserve the distinctive feel and daily rhythm of the original *Legend of the Red Dragon* (LORD), while adding short, meaningful maths challenges suitable for school-aged players.
**Implementation reference:** https://github.com/talisto/LORD.ts

> **Important project rule:** Treat `talisto/LORD.ts` as the first technical reference to inspect, not as a vague inspiration. Before building anything, the coding agent must read its README, LICENSE, package metadata, directory structure, game flow, storage layer, web client, tests, and relevant source modules. Then report what can be reused, what should be adapted, and what must be built separately. Do not begin a rewrite until this audit is complete.

---

## 1. Product vision

Make a browser game that feels like logging into a classic BBS door game: a small fantasy world, a handful of daily adventures, memorable characters, amusing random events, a village to visit, rivals to compare yourself with, and a dragon waiting at the end of the progression.

The maths should feel like part of being an adventurer, not like a worksheet bolted onto a game. A player might calculate a monster's weakness, work out how much a potion costs, estimate damage, split treasure, or solve a short challenge to gain a tactical advantage.

The priority order is:

1. **Faithful LORD feel:** daily limits, village locations, forest encounters, progression, humour, rivals, and a final dragon challenge.
2. **A genuinely playable game:** reliable saves, clear feedback, balanced encounters, and a useful experience on a school computer.
3. **Maths that matters:** short, curriculum-aligned challenges that affect gameplay without making every screen feel like a test.
4. **Teacher control:** simple settings for age/ability, skill focus, session length, and review of progress.
5. **Small, maintainable first release:** do not build a sprawling MMO, a full learning-management system, or a real-time multiplayer engine before the core loop works.

## 2. What makes LORD special

### 2.1 Daily turns create anticipation

The original's limited daily actions made each decision matter. The player should have a fixed daily allowance of forest adventures and a smaller number of PvP challenges. The game should reset those allowances once per game day, according to the configured game timezone.

For classroom use, add a teacher-controlled **Practice Mode** that can grant extra practice adventures without changing the main world's competitive balance. Avoid unlimited farming as the default: scarcity is part of the original rhythm.

### 2.2 A compact world with memorable places

Use a village hub with recognisable destinations, presented as a menu rather than a huge explorable map. Locations should feel like distinct little scenes, each with a reason to return.

Suggested locations:

- **The Forest:** main source of encounters, gold, experience, surprises, and danger.
- **The Inn:** humour, gossip, bard events, character interactions, and community announcements.
- **The Shop:** buy and sell equipment and consumables.
- **The Bank:** deposit gold and see savings/interest if that mechanic is enabled.
- **The Healer / Temple:** recover from defeat or spend earned resources.
- **Training Grounds:** level checks, stat progression, and a gatekeeper/master challenge.
- **The Arena:** limited player-versus-player challenges, with a safe asynchronous option.
- **The Dragon's Lair:** locked until the character reaches the required level and is ready for the final challenge.
- **Optional special places:** introduce only after the core loop is stable.

Do not replace this with a generic open-world RPG map. The compact menu-driven structure is a feature, not a limitation.

### 2.3 A playful, slightly cheeky tone

Keep the writing short, characterful, occasionally absurd, and easy for children to understand. Random events should be funny and varied, not relentlessly instructional. Use original dialogue rather than copying large blocks of copyrighted game text.

Examples of the *kind* of humour to aim for (write fresh lines; these are tone examples, not required dialogue):

- A goblin claims the treasure is "for tax purposes" and flees with a single copper coin.
- The village bard rhymes "dragon" with "wagon" and insists it works if sung quickly.
- A shopkeeper charges extra for a sword described as "mostly sharp."
- A suspicious stranger offers a treasure map that turns out to be a very detailed map of the village rubbish tip.

### 2.4 Long-term progression and a visible goal

Players start weak, earn gold and experience, improve equipment and stats, defeat level masters, and ultimately challenge the Red Dragon. The game should make small sessions feel rewarding while retaining a long-term goal.

## 3. Maths integration: meaningful, brief, adjustable

### 3.1 Core principle

Maths should influence the adventure, but a wrong answer should not routinely block all progress or humiliate the player. Use the question to create a choice, a tactical benefit, a bonus, or a recovery opportunity.

**Default rule:** one maths interaction should normally take around 10–45 seconds. Some encounters can be resolved without a question, so the game still feels like an adventure rather than a quiz app.

### 3.2 Where maths appears

| Game moment | Maths skill | Example mechanic |
|---|---|---|
| Forest encounter | Mental arithmetic, operations | Solve a quick challenge to spot a weakness or earn a small combat advantage |
| Combat | Addition, subtraction, multiplication, division | Calculate a damage estimate, potion effect, or remaining health |
| Shop | Money, decimals, percentages | Compare prices, calculate change, decide whether an upgrade is affordable |
| Bank | Percentages, multiplication | Calculate interest or compare saving choices; keep this optional for younger players |
| Treasure | Number sense, place value | Decode a number clue, estimate a reward, or choose between treasure piles |
| Equipment | Arithmetic and comparison | Compare attack/defence values and work out which item is better value |
| Training Grounds | Skill review | Short level-up challenge or optional mastery trial |
| Inn mini-games | Probability, patterns, logic | Guessing games, number sequences, odds, and simple strategy |
| Dragon encounter | Mixed review | A few short, varied challenges that offer tactical choices during the final battle |
| Teacher challenge | Chosen curriculum area | Teacher selects the skill, difficulty, and number of questions |

### 3.3 Do not make maths a repetitive gate

Avoid asking the same type of question before every single attack. Rotate the interactions:

- **Quick question:** answer to earn a bonus.
- **Choice question:** choose the best of two strategies and calculate which is more effective.
- **Optional challenge:** risk a small amount of gold for a reward.
- **Hint-and-retry:** show a worked hint after a mistake.
- **No-question encounter:** some events are resolved by choice, chance, or equipment.
- **Boss trial:** a short sequence of varied questions, with recovery between stages.

### 3.4 Adapt difficulty

Provide a simple profile setting, chosen by the teacher or player where permitted:

- **Level A — Foundations:** number recognition, place value, addition/subtraction, times tables, simple division.
- **Level B — Developing:** multi-step arithmetic, fractions, decimals, measurement, money.
- **Level C — Confident:** larger numbers, fractions/decimals/percentages, ratios, patterns, estimation, and multi-step problems.
- **Custom:** teacher selects skills and number ranges.

These are practical game bands, not claims that a particular band matches a specific school year. Make curriculum mappings configurable for the school's jurisdiction.

Difficulty should adapt gently using recent answers. For example, after repeated success, increase the number range or add a second step; after repeated difficulty, offer a hint or a simpler equivalent. Do not reduce the player's combat stats, publicly rank their maths ability, or permanently penalise them for mistakes.

### 3.5 Question quality and feedback

Each question must have:

- a stable ID;
- skill tags and difficulty;
- question text;
- correct answer and accepted equivalent answers where appropriate;
- an answer normalisation rule;
- a short explanation or worked example;
- a hint;
- an optional misconception tag;
- metadata for curriculum mapping;
- a source/author field if questions are imported.

Use deterministic question generation for arithmetic where possible. Test edge cases, including negative results if enabled, fractions, decimal formatting, equivalent forms, and division remainders. Do not use an LLM as the authority for marking answers. Generated questions must be validated by code before they enter the game.

### 3.6 Reward design

Reward learning without allowing fast guessing to dominate the economy.

Suggested default outcomes:

- Correct on first attempt: full maths bonus.
- Correct after a hint or second attempt: smaller bonus, but normal game progress.
- Incorrect after retries: explain the method, grant a modest participation outcome, and continue the encounter where practical.
- Optional high-risk challenge: a clearly disclosed stake and reward, with a safe default for younger players.

Never award power based solely on response speed. Avoid public leaderboards for raw correctness unless teachers explicitly enable them. Prefer private progress indicators such as "practising fractions" and "improving with multiplication."

## 4. Core gameplay loop

1. Player signs in or chooses a local classroom identity.
2. Player sees the village hub, character stats, current level, gold, equipment, and remaining daily adventures.
3. Player chooses a destination.
4. In the Forest, the game selects an encounter or event.
5. The player chooses an action; some encounters offer a maths challenge.
6. Combat or the event resolves using the game rules and the player's choice, stats, and equipment.
7. The player receives a clear result: experience, gold, loot, damage, or a story event.
8. The player may visit the shop, bank, healer, inn, or training grounds.
9. The player spends remaining daily actions and leaves with progress safely saved.
10. The next game day restores the relevant action allowances and introduces new events.

A typical short session should feel satisfying in 5–10 minutes, with a longer session available when a teacher grants additional practice.

## 5. Character creation and progression

Keep character creation brief. The aim is to start playing quickly.

Suggested fields:

- character name, with child-safe validation;
- class;
- avatar/colour or simple cosmetic choice;
- maths band, if not set by the teacher;
- accessibility preferences.

Preserve the classic class choice and distinct combat identity where practical. The LORD.ts README describes classes such as Death Knight, Mystic, and Thief; inspect the repository's actual rules before deciding how to represent them.

Possible class identities (subject to source audit):

- **Warrior / Death Knight:** stronger physical attacks or a once-per-fight power move.
- **Mystic:** spells, defence, or controlled magical effects.
- **Thief:** dodge, trickery, or a limited chance to steal gold.

Do not tie maths skill or difficulty to class choice. All classes should have a fair chance of progressing.

Progression should include:

- experience and levels;
- level masters or training checks;
- strength, defence, charm, health, or the equivalent stats used by the reference game;
- equipment and consumables;
- limited daily actions;
- a final Red Dragon encounter;
- a clear victory/reset/replay policy.

The exact formulas, thresholds, and combat balance should be taken from the inspected reference implementation where lawful and technically appropriate, not invented from assumptions. Document any intentional changes.

## 6. Combat design

Combat should remain quick, readable, and slightly unpredictable. Use the original combat rules as the baseline wherever feasible.

The interface should show:

- player and enemy names;
- current and maximum health;
- class/equipment effects;
- a short combat log;
- available actions;
- any maths challenge and its immediate consequence;
- a clear result when the encounter ends.

Maths can affect combat in bounded ways, such as:

- correctly calculating an enemy's weakness gives a small opening bonus;
- correctly working out a healing dose gives an extra healing point or a more efficient potion;
- estimating incoming damage helps choose between attacking and defending;
- a boss may present a sequence of different challenge types.

Do not let maths bonuses overwhelm character stats, equipment, or class abilities. A learner who is still developing confidence should still be able to enjoy the game.

Build combat as a deterministic rules module where possible, with randomness supplied through an injectable random-number source. This makes balancing and testing much easier.

## 7. The social world: preserve the BBS spirit safely

The original's community feel matters. For a game used by children, however, unrestricted chat, private messaging, and open player profiles introduce avoidable safeguarding and moderation risks.

Recommended first release:

- asynchronous arena challenges against recorded opponents or NPCs;
- public, system-generated realm announcements;
- preset emotes or short moderated messages;
- NPC rivals that simulate a lively world;
- a school/classroom realm isolated from other realms;
- no open direct messages by default;
- no public display of real names, email addresses, or school details.

If player messaging is ever added, it must have a clear moderation plan, reporting, blocking, rate limits, teacher controls, and appropriate privacy review. Do not build open chat just because the original had social features.

### NPCs and a populated world

Use NPC characters to make the game feel alive even when no other pupils are online. NPCs can:

- appear in the arena;
- leave short in-world announcements;
- win or lose at a believable pace;
- provide rivals for players who are new;
- take part in scripted events.

NPC behaviour should be predictable enough for testing. Do not make fake claims that an NPC is a real child.

## 8. Teacher and classroom mode

Teacher features should be useful but restrained. They should not delay the playable game.

Minimum teacher controls:

- create a classroom/realm;
- generate student aliases or join codes;
- set maths difficulty and skill focus;
- set daily adventure limits and session length;
- enable/disable selected locations or mechanics;
- reset a learner's practice state when appropriate;
- view individual progress on skill tags and recent attempts;
- export a simple CSV report;
- turn leaderboards on or off;
- enable Practice Mode for additional questions without altering the competitive realm.

Teacher reporting should focus on learning signals: attempts, accuracy over time, skills practised, hints used, and common misconceptions. Avoid claiming that a short game session proves mastery.

Data minimisation:

- do not require students to publish their real names;
- collect only data needed to run the game and provide feedback;
- avoid collecting birth dates or precise location;
- keep classroom data separate from public realms;
- provide a clear retention/deletion approach;
- document who can access student progress.

## 9. User interface and visual direction

### 9.1 Visual style

The game should feel like LORD, not a modern action RPG that happens to use the name. Keep the compact menu-based experience, readable text, short narrative screens, and a little old-school charm.

A good visual approach is a **modern BBS-inspired interface**:

- dark, restrained background;
- readable monospace or terminal-inspired headings;
- pixel/ANSI-inspired borders and small illustrations;
- warm, clear text panels;
- simple character/monster portraits;
- subtle animations for hits, treasure, level-ups, and dragon events;
- optional "classic terminal" presentation setting.

Do not make the entire game depend on tiny text or an inaccessible terminal emulator. Modernise readability while retaining the original rhythm.

### 9.2 Main screens

1. **Title / login:** game title, sign-in or classroom join, continue button.
2. **Character creation:** name/alias, class, difficulty selection if permitted.
3. **Village hub:** destinations, stats, daily actions remaining.
4. **Forest:** event text, enemy display, action choices.
5. **Combat:** health, combat log, action controls, optional maths interaction.
6. **Shop:** item list, stats, prices, buy/sell.
7. **Inn:** events, bard, gossip, mini-games.
8. **Bank:** balance, deposit/withdraw, optional interest.
9. **Training grounds:** level requirements and master fight.
10. **Arena:** NPC or asynchronous opponent challenges.
11. **Character sheet:** stats, equipment, history, achievements.
12. **Maths feedback:** answer, hint, short explanation, skill progress.
13. **Teacher dashboard:** classroom settings and learning overview.

### 9.3 Accessibility and classroom realities

- Support keyboard-only play.
- Use clear focus states and large clickable controls.
- Do not communicate correctness using colour alone.
- Keep animations brief and provide reduced-motion support.
- Use readable contrast and scalable text.
- Avoid timers by default; timed challenges should be optional.
- Provide audio controls if sound effects are added.
- Ensure the game is usable on typical school laptops and common browser sizes.
- Save after meaningful actions and handle refreshes gracefully.

## 10. Technical strategy: inspect LORD.ts before choosing the architecture

Reference repository: https://github.com/talisto/LORD.ts

The repository README describes LORD.ts as a TypeScript port of LORD based on the Synchronet BBS version, refactored into modules. It documents a CLI, a WebSocket browser client, a SQLite storage backend, an event system, tests, LDY scripting, and bundled In-Game Modules. It also describes a web client that renders terminal-style output and optional RIPscrip graphics.

This is unusually relevant because it already represents a working LORD implementation with a browser connection. **Do not assume it can be deployed as a static website or that its frontend can simply be copied into a new React app.** The documented browser mode uses a server and WebSockets; the documented setup uses Docker Compose, and the repo requires Node.js 22+ for its listed setup.

### 10.1 Mandatory repository audit

Before coding, the VS Code agent must:

1. Read `README.md` from top to bottom.
2. Read `LICENSE` and identify the exact licence terms and obligations.
3. Read `package.json`, `tsconfig.json`, and build/test scripts.
4. Inspect the whole top-level directory tree.
5. Inspect `src/core/GameContext.ts` and understand how the game is assembled.
6. Map the core gameplay modules: player records, combat, forest, village locations, progression, economy, and daily maintenance.
7. Inspect `src/storage/`, including its storage interfaces and SQLite implementation.
8. Inspect `src/core/GameEvents.ts` and the WebSocket/session flow.
9. Inspect `webclient/`, including how user input and server prompts work.
10. Inspect representative tests under `tests/unit/` and `tests/integration/`.
11. Inspect the relevant `data/` files for settings and content, without editing defaults.
12. Identify which original assets, text, graphics, and third-party components have separate licensing or attribution requirements.
13. Run the documented baseline checks if the environment supports them.
14. Write an audit report before changing source code.

The audit report must answer:

- Can this repository serve as the foundation for the maths game?
- Can the existing browser client be extended, or would a new UI be more practical?
- Which game rules are reusable as-is?
- Where should maths challenges integrate with game events?
- What authentication and student-data changes would be needed?
- What is required to deploy it to the intended hosting environment?
- What are the licence and asset-attribution obligations?
- What are the three biggest technical risks?
- What is the smallest safe vertical slice that can be tested?

### 10.2 Choose one of three paths after the audit

**Path A — Extend LORD.ts directly (preferred if feasible).** Keep its TypeScript game engine, storage abstraction, combat and event model. Add a maths-question module and connect it to selected game events. Extend the existing web client only as much as necessary. This offers the best chance of preserving the original mechanics.

**Path B — Keep the engine, replace or substantially improve the frontend.** Use this only if the existing terminal-style client cannot deliver the needed accessibility, maths interactions, and teacher experience. Preserve the engine's rules behind a clearly defined interface. Do not fork the engine into two competing implementations.

**Path C — Build a separate browser game using LORD.ts as a reference.** Choose this only if the repository's deployment, licence, architecture, or interface makes extension unsuitable. Reimplementing rules creates a risk of drifting away from the original. Record every intentional divergence and test key mechanics against the reference.

Do not automatically choose React, Phaser, or a static-only deployment before the audit. The repository already uses TypeScript and has an established architecture; build on what is there unless evidence shows otherwise.

### 10.3 Licensing and intellectual property

The README describes the project as derived from the GPL-licensed Synchronet version. The exact `LICENSE` file and any asset-specific licences must be read before deciding how code can be reused or distributed. Do not assume that all art, music, text, scripts, and dependencies share one licence.

The original game's name, characters, writing, artwork, and other assets may have rights attached. For a public or commercial release, verify what is permitted and get appropriate advice if needed. If redistributing GPL-covered code, comply with the applicable licence conditions, including source-code and notice obligations where required. If the project needs a permissive licence or closed-source distribution, get that question resolved before basing the product on the repo.

For the maths game, prefer original educational questions, new art, and fresh dialogue. Keep provenance and licence notices for any imported material.

## 11. Suggested code boundaries

Follow the existing repository's patterns after inspection; these names are conceptual, not a demand to create duplicate modules.

- `MathsQuestionService`: selects or generates valid questions.
- `MathsQuestionBank`: curated questions and skill metadata.
- `AnswerChecker`: normalises and validates answers.
- `MathsRewardPolicy`: translates attempts into bounded in-game effects.
- `MathsProgressTracker`: records attempts, hints, skills, and trends.
- `MathsEncounterAdapter`: connects question outcomes to forest/combat/events.
- `TeacherSettings`: stores allowed skills, difficulty, and practice settings.
- `ClassroomReporting`: aggregates safe, minimal learning summaries.

Rules for these boundaries:

- The game engine remains the authority for health, gold, experience, and combat results.
- The question service must not directly edit player stats.
- The reward policy returns a proposed effect; the game engine validates and applies it.
- Question generation and answer checking must be unit-tested.
- Maths attempts must be distinguishable from ordinary game events in telemetry.
- Do not put classroom reporting logic inside combat code.
- Avoid a second source of truth for player state.

## 12. Data model considerations

Adapt to the existing schema rather than blindly adding these exact tables.

**Player maths preferences:** player ID; selected skill band; allowed skill tags; accessibility and feedback preferences.

**Question attempt:** attempt ID; player ID or classroom pseudonymous ID; question ID; skill tags; difficulty; submitted answer in a privacy-conscious form; correctness; attempt count; whether a hint was used; timestamp or game-day bucket; associated encounter/event ID.

**Question content:** stable question ID; skill and difficulty; prompt template or fixed prompt; answer representation; answer normalisation strategy; explanation and hint; validation tests; curriculum tags and provenance.

**Teacher/classroom settings:** classroom ID; join-code hash or equivalent safe representation; enabled skills and difficulty; adventure/session limits; reporting permissions; created/updated metadata.

Do not store unnecessary free-text data from children. Set reasonable retention rules. Avoid storing raw answers longer than needed if an aggregate is sufficient.

## 13. Build plan: staged delivery

**Phase 0 — Repository audit and baseline.** Deliverables: repository audit report; licence/asset risk summary; architecture diagram; baseline test/build results; chosen Path A, B, or C with reasons; a list of small, reviewable implementation steps. Exit criteria: the existing game can be started in the documented development environment, or blockers are recorded; the agent understands how a forest encounter and a player save work; no source changes have been made before the audit is reviewed.

**Phase 1 — Playable faithful baseline.** Player creation/login suitable for local testing; village navigation; one forest adventure; encounter resolution; gold/experience changes; a shop or one other useful destination; save/reload; daily-action counter. Exit criteria: a player can complete the loop, refresh the page, and retain valid state; game rules are covered by tests; maths has not yet complicated the core loop.

**Phase 2 — Maths vertical slice.** Add exactly one well-integrated maths interaction to one event type. Recommended first example: a forest encounter where a player can answer a short arithmetic question to earn a small, bounded combat advantage. A wrong answer shows a hint/explanation and allows the encounter to continue. Exit criteria: questions are valid and answer checking is deterministic; the reward is applied by the game engine, not directly by the question UI; attempts and hints are recorded; the game remains fun if a question is skipped or answered incorrectly; automated tests cover correct, incorrect, hinted, and repeated attempts.

**Phase 3 — Add skills and locations.** Expand to money/shop arithmetic, number patterns, fractions/decimals, and selected inn mini-games. Add difficulty settings and feedback. Do not add every skill category in one large batch. Exit criteria: each skill category has tested questions and explanations; difficulty selection has a real effect; questions do not repeat excessively in a short session; rewards remain balanced.

**Phase 4 — Classroom mode.** Add classroom creation/joining, teacher settings, aliases, basic progress reports, and Practice Mode. Exit criteria: student identities are not exposed publicly; classroom realms are isolated; a teacher can change difficulty and review progress; exports contain only necessary fields; privacy and retention choices are documented.

**Phase 5 — Social systems and polish.** Only after the core is stable, add NPC rivals, asynchronous arena play, achievements, more events, visual polish, sound, and optional extra locations. Exit criteria: NPC activity is testable and does not distort balance; any social features have safety controls; accessibility checks pass; performance is acceptable on typical school devices.

**Phase 6 — Deployment and pilot.** Deploy to a private test environment first. Run a small teacher-led pilot before opening public registration. Check: account/session security; database backups and restore; reset behaviour across timezones; browser refresh/reconnection; concurrent users; logging and error recovery; accessibility and classroom network restrictions; licence notices and asset provenance.

## 14. Test strategy

**Game rules:** forest action counts cannot go below zero; daily reset occurs once per game day; gold cannot become negative through invalid purchases; rewards are applied exactly once; defeated players and recovery follow configured rules; level progression and final-boss access obey requirements; simultaneous actions cannot duplicate rewards.

**Maths engine:** every fixed question has a correct answer; generated questions obey their constraints; answer normalisation accepts intended equivalent answers; division questions do not accidentally produce unsupported answers; hints and explanations correspond to the actual question; difficulty changes affect generated questions; retries do not duplicate rewards; client-side manipulation cannot award extra gold or stats.

**Persistence and safety:** refresh/reconnect preserves a valid state; a player cannot access another student's private progress; classroom join codes are not stored or logged carelessly; reporting endpoints enforce teacher permissions; inputs are validated and output safely rendered; logs do not leak passwords, tokens, or unnecessary student data.

**Usability:** a child can understand the next action without adult explanation; maths feedback is encouraging and clear; the interface works with keyboard navigation; animations respect reduced-motion settings; controls are usable on a small laptop screen; the core loop can be completed in a short session.

## 15. Success measures

Game measures: percentage of players who complete the first adventure; sessions that reach a meaningful reward; return rate across multiple game days; crashes, failed saves, and blocked sessions; whether players use multiple locations.

Learning measures: attempts by skill tag; accuracy trends over time; use of hints and retries; whether players return to skills they found difficult; teacher feedback on relevance and ease of use.

Do not treat raw accuracy alone as learning. A student may improve by using hints, taking more time, or attempting a skill they previously avoided. Any comparison between students should be cautious and teacher-controlled.

## 16. Explicit non-goals for the first release

Do not build these initially: a huge open world; real-time multiplayer combat; unrestricted chat or direct messaging; generative-AI marking of answers; a full school management system; complex analytics dashboards; dozens of mini-games; mobile apps for multiple platforms; a full visual remake of every original screen before the core game works.

The first release should prove that a short LORD-like adventure with one good maths mechanic is fun, reliable, and easy to run.

---

# VS Code coding-agent instructions

(The brief's audit prompt and implementation prompt are summarised here; their rules are already in sections 10–14 above.)

**Audit first.** Read README and LICENSE fully; inspect package.json, tsconfig.json, test scripts, the full tree, and `src/`, `webclient/`, `data/`, `tests/` (especially `src/core/GameContext.ts`, player and combat code, forest and village locations, settings and daily maintenance, `src/storage/`, `src/core/GameEvents.ts` and WebSocket handling, `webclient/`, representative tests). Check asset and third-party licences separately. Run existing checks if feasible and record outcomes. Don't edit upstream files, copy large chunks of original text or art, assume static hosting works, or pick React/Phaser/a new database/a rewrite before assessing the architecture. Write the audit (purpose, component map, session-to-engine flow, forest and combat flow, progression and daily turns, test status, licensing, maths integration points, safeguarding gaps, deployment needs, Path A/B/C comparison and recommendation, first vertical slice and acceptance tests, unknowns needing a human decision). Stop after the audit and ask for approval.

**Then build in small, tested increments.** First vertical slice: create/load a test player, go to the Forest, trigger an encounter, offer one maths challenge, check the answer with deterministic code, give a hint on error, apply a small bounded bonus through the authoritative engine, resolve and show the result, save, and confirm the state survives a refresh. Engineering rules: follow existing style and test framework; keep maths in its own testable module; the engine is authoritative for rewards, gold, exp, health and inventory; never trust the browser on correctness or rewards; typed data and deterministic tests; injectable randomness; few dependencies; small reviewable changes; tests with each change; document every intentional divergence from the original rules; no open child-to-child chat; no unnecessary student data; no secrets in source or logs; keep licence notices. For every stage: state the change and files, implement only that, run tests/typecheck/build, inspect the diff, summarise, and stop on unexpected architecture or licence blockers.

## 17. First decisions to make

Sensible defaults: preserve the menu-driven, daily-turn structure; begin with short arithmetic and add skills incrementally; teacher-configurable difficulty with gentle adaptation; NPCs and asynchronous arena first, no open chat; extend LORD.ts if the audit and licence review support it; decide deployment after checking the hosting target; one playable forest encounter with one maths interaction before expanding.

The key test: if you temporarily removed the maths, would this still feel like LORD? If not, the adaptation has drifted too far. If you removed the fantasy game, would the maths still be a worksheet? If so, the maths has not been integrated deeply enough. Aim for the middle: a recognisable old-school adventure where maths is one of the tools that helps a player succeed.
